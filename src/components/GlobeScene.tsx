import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADSBTelemetryService } from '../services/ADSBTelemetryService';
import type { FlightState } from '../services/ADSBTelemetryService';
import FlightTrackingGrid from './FlightTrackingGrid';
import EmergencyAlertBanner, { EMERGENCY_SQUAWKS } from './EmergencyAlertBanner';
import type { ManifestCardData } from './ManifestStack';

interface GlobeSceneProps {
  selectedIncident?: ManifestCardData | null;
  onTelemetryMatch?: (matched: boolean) => void;
  onSelectIncident: (incident: any) => void;
}

const GlobeScene: React.FC<GlobeSceneProps> = ({ selectedIncident, onTelemetryMatch, onSelectIncident }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const flightsGroupRef = useRef<THREE.Group | null>(null);
  const rotationGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Multi-plane tracking (up to 4 simultaneous)
  const [trackedFlights, setTrackedFlights] = useState<FlightState[]>([]);
  const trackedFlightsRef = useRef<FlightState[]>([]);
  // Screen-space positions updated each animation frame, read by SVG overlay
  const trackedPositionsRef = useRef<Map<string, { x: number; y: number; visible: boolean }>>(new Map());

  // Emergency flight detection
  const [emergencyFlights, setEmergencyFlights] = useState<FlightState[]>([]);
  const emergencyHexesRef = useRef<Set<string>>(new Set());

  const pollIndexRef = useRef(0);

  const [trafficMode, setTrafficMode] = useState<'OFF' | 'SELECTED' | 'ALL' | 'HEAVY' | 'PRIVATE' | 'HELI'>('ALL');
  const trafficModeRef = useRef(trafficMode);
  useEffect(() => { trafficModeRef.current = trafficMode; }, [trafficMode]);

  const isBatchingRef = useRef(false);
  const batchRequestRef = useRef<number>(0);
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null);

  const activePlanesRef = useRef<Map<string, any>>(new Map());
  const rotorMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const globeRadius = 100;

  // Converts Geocoordinates to 3D Cartesian coordinates
  const latLonToVector3 = (lat: number, lon: number, radius: number, alt: number = 0) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    // Add scaled altitude to the radius
    const r = radius + (alt * 0.00015);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  };

  // 1. Core WebGL Setup (Runs Once to prevent globe-breaking context loss)
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 250;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);
    
    // Global Debug Export
    (window as any).nyxActivePlanes = activePlanesRef.current;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 132;  // ~32 units above surface — prevents getting stuck
    controls.maxDistance = 400;
    controls.enablePan = false;   // Ensure it always spins on the centre
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 3, 5);
    scene.add(mainLight);

    // Globe Construction
    const geometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/textures/earth_grayscale.jpg');

    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 2,
      specular: new THREE.Color(0x111111),
      color: 0xffffff, // Restored full brightness
    });
    const globe = new THREE.Mesh(geometry, material);

    // Master Rotation Group (so markers and planes rotate with the earth)
    const rotationGroup = new THREE.Group();
    rotationGroupRef.current = rotationGroup;
    rotationGroup.add(globe);
    scene.add(rotationGroup);

    // Atmosphere Glow
    const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.01, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xcf142b,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    rotationGroup.add(glow);

    // Dynamic Layers
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    rotationGroup.add(markersGroup);

    const flightsGroup = new THREE.Group();
    flightsGroupRef.current = flightsGroup;
    rotationGroup.add(flightsGroup);

    const materials = {
      classic: new THREE.MeshPhongMaterial({ color: 0xff4d4d, emissive: 0x220000, shininess: 80, specular: 0x444444 }),
      widebody: new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x111111, shininess: 100, specular: 0xffffff }),
      privateJet: new THREE.MeshPhongMaterial({ color: 0x00f2ff, emissive: 0x002222, shininess: 120, specular: 0x00ffff }),
      heli: new THREE.MeshPhongMaterial({ color: 0xffea00, emissive: 0x222200, shininess: 60, specular: 0xffffff }),
      emergency: new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xbb0000, shininess: 150, specular: 0xffffff })
    };

    const createGeometries = () => {
      // 1. Classic (Sleek A320 style)
      const fuselage = new THREE.CylinderGeometry(0.28, 0.22, 2.4, 12);
      fuselage.rotateX(Math.PI / 2);
      const wings = new THREE.BoxGeometry(2.6, 0.04, 0.6);
      wings.translate(0, -0.05, 0);
      const tailFin = new THREE.BoxGeometry(0.04, 0.6, 0.4);
      tailFin.translate(0, 0.4, 1.0);
      const tailHoriz = new THREE.BoxGeometry(0.8, 0.02, 0.3);
      tailHoriz.translate(0, 0, 1.0);
      const classic = BufferGeometryUtils.mergeGeometries([fuselage, wings, tailFin, tailHoriz]);

      // 2. Widebody (Premium 4-Engine Heavy)
      const wFuselage = new THREE.CylinderGeometry(0.45, 0.35, 3.2, 16);
      wFuselage.rotateX(Math.PI / 2);
      const hump = new THREE.SphereGeometry(0.48, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      hump.scale(1.0, 0.5, 1.8);
      hump.translate(0, 0.25, -0.8);
      const wWings = new THREE.BoxGeometry(4.2, 0.08, 0.9);
      wWings.rotateY(Math.PI / 12); // Swept
      const engine = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12);
      engine.rotateX(Math.PI / 2);
      const e1 = engine.clone().translate(0.9, -0.2, -0.1);
      const e2 = engine.clone().translate(1.6, -0.2, 0.2);
      const e3 = engine.clone().translate(-0.9, -0.2, -0.1);
      const e4 = engine.clone().translate(-1.6, -0.2, 0.2);
      const widebody = BufferGeometryUtils.mergeGeometries([wFuselage, hump, wWings, e1, e2, e3, e4, tailFin.clone().scale(1.5, 1.5, 1.5).translate(0, 0.2, 0.5)]);

      // 3. Private Jet (Superior T-Tail)
      const pFuselage = new THREE.CylinderGeometry(0.2, 0.15, 2.0, 10);
      pFuselage.rotateX(Math.PI / 2);
      const pWings = new THREE.BoxGeometry(2.2, 0.03, 0.5);
      pWings.rotateY(Math.PI / 6); // High sweep
      pWings.translate(0, -0.05, 0.2);
      const tTailVert = new THREE.BoxGeometry(0.04, 0.7, 0.4);
      tTailVert.translate(0, 0.35, 0.9);
      const tTailHoriz = new THREE.BoxGeometry(1.0, 0.02, 0.3);
      tTailHoriz.translate(0, 0.7, 0.9);
      const pEngine = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
      pEngine.rotateX(Math.PI / 2);
      const pe1 = pEngine.clone().translate(0.3, 0.15, 0.7);
      const pe2 = pEngine.clone().translate(-0.3, 0.15, 0.7);
      const privateJet = BufferGeometryUtils.mergeGeometries([pFuselage, pWings, tTailVert, tTailHoriz, pe1, pe2]);

      // 4. Helicopter (Skids & Body)
      const hBody = new THREE.CapsuleGeometry(0.35, 0.6, 4, 12);
      hBody.rotateX(Math.PI / 2);
      const skid = new THREE.BoxGeometry(0.04, 0.04, 1.2);
      const s1 = skid.clone().translate(0.25, -0.4, 0);
      const s2 = skid.clone().translate(-0.25, -0.4, 0);
      const hTail = new THREE.CylinderGeometry(0.05, 0.02, 1.0);
      hTail.rotateX(Math.PI / 2);
      hTail.translate(0, 0, 0.8);
      const heliBody = BufferGeometryUtils.mergeGeometries([hBody, s1, s2, hTail]);

      return { classic, widebody, privateJet, heliBody };
    };

    const geometries = createGeometries();

    const getPlaneType = (typeCode?: string): keyof typeof materials => {
      if (!typeCode) return 'classic';
      const t = typeCode.toUpperCase();
      if (['A388', 'B744', 'B748', 'A359', 'A35K', 'B77L', 'B77W', 'B772', 'B773', 'B788', 'B789', 'B78X', 'A332', 'A333', 'A343', 'A346', 'MD11'].includes(t)) return 'widebody';
      if (['GLF5', 'GLF6', 'C560', 'C25B', 'LJ35', 'LJ60', 'CL30', 'CL60', 'E55P', 'HA42', 'C172', 'C182', 'P28A', 'SR22'].includes(t)) return 'privateJet';
      if (['EC35', 'EC45', 'B06', 'R44', 'R66', 'H135', 'H145', 'A109', 'A139', 'MI8', 'UH60', 'H60'].includes(t)) return 'heli';
      return 'classic';
    };

    const createPlaneMesh = (hex: string, typeCode?: string) => {
      try {
        const type = getPlaneType(typeCode);
        const mat = materials[type] || materials.classic;
        const group = new THREE.Group();
        group.userData.type = type;

        if (type === 'heli') {
          const body = new THREE.Mesh(geometries.heliBody, mat);
          const rotor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.15), mat);
          rotor.position.y = 0.45;
          rotorMeshesRef.current.set(hex, rotor);
          group.add(body, rotor);
          group.scale.set(0.35, 0.35, 0.35);
        } else {
          const m = new THREE.Mesh(geometries[type as keyof typeof geometries] || geometries.classic, mat);
          group.add(m);
          if (type === 'widebody') group.scale.set(0.45, 0.45, 0.45);
          else if (type === 'privateJet') group.scale.set(0.2, 0.2, 0.2);
          else group.scale.set(0.3, 0.3, 0.3);
        }

        group.userData.lastMat = mat;
        return group;
      } catch (e) {
        const fallback = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.classic);
        const g = new THREE.Group();
        g.add(fallback);
        return g;
      }
    };

    const scratchNormal = new THREE.Vector3();
    const scratchWorldUp = new THREE.Vector3(0, 1, 0);
    const scratchEast = new THREE.Vector3();
    const scratchNorth = new THREE.Vector3();
    const scratchDir = new THREE.Vector3();
    const scratchTarget = new THREE.Vector3();

    const orientPlane = (mesh: THREE.Object3D, pos: THREE.Vector3, track: number) => {
      scratchNormal.copy(pos).normalize();
      mesh.up.copy(scratchNormal);

      const trackRad = (track || 0) * (Math.PI / 180);

      // Robust tangent calculation using scratchpad
      if (Math.abs(scratchNormal.y) > 0.999) {
        scratchEast.set(1, 0, 0);
      } else {
        scratchEast.crossVectors(scratchWorldUp, scratchNormal).normalize();
      }
      scratchNorth.crossVectors(scratchNormal, scratchEast).normalize();

      scratchDir.set(0, 0, 0)
        .addScaledVector(scratchNorth, Math.cos(trackRad))
        .addScaledVector(scratchEast, Math.sin(trackRad));

      scratchTarget.copy(pos).add(scratchDir);
      mesh.lookAt(scratchTarget);
    };

    const requestRef = { current: 0 };
    const TRANSITION_DURATION = 30000;

    const fetchLiveFlights = async () => {
      if (isBatchingRef.current) return;
      isBatchingRef.current = true;

      try {
        const rawFlights = await ADSBTelemetryService.getGlobalFlights();
        const apiSuccess = !!(rawFlights && rawFlights.length > 0);

        if (!apiSuccess) {
          console.warn("[HUD] Telemetry Feed Interrupted. Preserving last known contacts.");
        }

        let flights = (rawFlights || []).filter((f: any) => {
          const alt = f.alt_geom || f.alt_baro || 0;
          return alt !== 'ground' && alt !== 0;
        });

        // Sticky Quota Management: If > 5000, prioritize existing, tracked, and emergency planes
        if (flights.length > 5000) {
          const trackedHexes = new Set(trackedFlightsRef.current.map(f => f.hex));
          const critical = flights.filter((f: any) => 
            EMERGENCY_SQUAWKS[String(f.squawk)] || trackedHexes.has(f.hex)
          );
          const existing = flights.filter((f: any) => activePlanesRef.current.has(f.hex) && !EMERGENCY_SQUAWKS[String(f.squawk)] && !trackedHexes.has(f.hex));
          const newOnes = flights.filter((f: any) => !activePlanesRef.current.has(f.hex) && !EMERGENCY_SQUAWKS[String(f.squawk)] && !trackedHexes.has(f.hex));
          
          flights = [...critical, ...existing, ...newOnes].slice(0, 5000);
        }

        // Initialize simulation if feed is empty and we have no data
        if (!apiSuccess && activePlanesRef.current.size === 0) {
          flights = Array.from({ length: 200 }).map((_, i) => ({
            hex: 'SIM' + i,
            flight: 'STEL' + i,
            lat: (Math.random() * 180) - 90,
            lon: (Math.random() * 360) - 180,
            alt_geom: 10000 + Math.random() * 30000,
            alt_baro: 10000 + Math.random() * 30000,
            track: Math.random() * 360,
            gs: 450,
            t: ['A388', 'GLF6', 'EC35', 'A320'][i % 4]
          }));
        }

        if (flights && flights.length > 0) {
          const currentHexes = new Set();
          const now = Date.now();
          let index = 0;
          const BATCH_SIZE = 50;

          const processBatch = () => {
            try {
              const end = Math.min(index + BATCH_SIZE, flights.length);
              for (; index < end; index++) {
                const flight = flights[index];
                if (!flight.hex || flight.lat === undefined || flight.lon === undefined) continue;
                currentHexes.add(flight.hex);

                const alt = Number(flight.alt_geom || flight.alt_baro || 0);
                const pos = latLonToVector3(flight.lat, flight.lon, globeRadius, alt);
                const currentTrack = Number(flight.track || 0);
                const gs = Number(flight.gs || 450);

                const trackRad = currentTrack * (Math.PI / 180);
                const dist = (gs * 60) / 3600;
                const dLat = (Math.cos(trackRad) * dist) / 60;
                const dLon = (Math.sin(trackRad) * dist) / (60 * Math.cos(flight.lat * Math.PI / 180));
                const projectedTarget = latLonToVector3(flight.lat + dLat, flight.lon + dLon, globeRadius, alt);

                const planeData = activePlanesRef.current.get(flight.hex);
                if (planeData) {
                  planeData.startPos.copy(planeData.mesh.position);
                  planeData.targetPos.copy(projectedTarget);
                  planeData.startTime = now;
                  planeData.startTrack = Number(planeData.mesh.userData.currentTrack) || currentTrack;
                  planeData.targetTrack = currentTrack;
                  planeData.flightData = flight;
                  planeData.staleCount = 0;
                } else {
                  const mesh = createPlaneMesh(flight.hex, flight.t);
                  mesh.position.copy(pos);
                  mesh.visible = false;
                  flightsGroup.add(mesh);

                  activePlanesRef.current.set(flight.hex, {
                    mesh,
                    startPos: pos.clone(),
                    targetPos: projectedTarget,
                    startTime: now,
                    startTrack: currentTrack,
                    targetTrack: currentTrack,
                    flightData: flight,
                    staleCount: 0,
                    hasTwoPoints: true
                  });
                }
              }

              if (index < flights.length) {
                batchRequestRef.current = requestAnimationFrame(processBatch);
              } else {
                isBatchingRef.current = false;
                
                // Cleanup stale contacts and scan for emergencies
                const newEmergencyHexes = new Set<string>();
                const newEmergencyFlights: any[] = [];

                for (const [hex, data] of activePlanesRef.current.entries()) {
                  if (apiSuccess && !currentHexes.has(hex) && !hex.startsWith('SIM')) {
                    data.staleCount = (data.staleCount || 0) + 1;
                    if (data.staleCount > 3) {
                      flightsGroup.remove(data.mesh);
                      activePlanesRef.current.delete(hex);
                      rotorMeshesRef.current.delete(hex);
                      continue;
                    }
                  }

                  const sq = String(data.flightData?.squawk ?? '');
                  if (EMERGENCY_SQUAWKS[sq]) {
                    newEmergencyFlights.push(data.flightData);
                    newEmergencyHexes.add(hex);
                  }
                }

                emergencyHexesRef.current = newEmergencyHexes;
                setEmergencyFlights(newEmergencyFlights);
              }
            } catch (err) {
              console.error("[HUD] Batching error:", err);
              isBatchingRef.current = false;
            }
          };
          processBatch();
        } else {
          isBatchingRef.current = false;
        }
      } catch (error) {
        console.error("[HUD] Telemetry Sync Failure:", error);
        isBatchingRef.current = false;
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, TRANSITION_DURATION);

    const trackedInterval = setInterval(async () => {
      const hexes = trackedFlightsRef.current.map(f => f.hex).filter(h => !h.startsWith('SIM'));
      if (hexes.length === 0) return;

      if (pollIndexRef.current >= hexes.length) pollIndexRef.current = 0;
      const hex = hexes[pollIndexRef.current];
      pollIndexRef.current++;

      try {
        const fresh = await ADSBTelemetryService.getFlightByHex(hex);
        if (fresh && activePlanesRef.current.has(hex)) {
          activePlanesRef.current.get(hex).flightData = fresh;

          const synced = trackedFlightsRef.current.map(f => {
            const live = activePlanesRef.current.get(f.hex);
            return live ? live.flightData : f;
          });
          trackedFlightsRef.current = synced;
          setTrackedFlights([...synced]);
        }
      } catch (e) {
      }
    }, 1000);

    // Pre-allocated scratchpad for high-frequency loops
    const scrPos = new THREE.Vector3();
    const scrPDir = new THREE.Vector3();
    const scrVec = new THREE.Vector3();
    const camPosDir = new THREE.Vector3();
    const planeDir = new THREE.Vector3();

    const animate = () => {
      try {
        requestRef.current = requestAnimationFrame(animate);
        rotationGroup.rotation.y += 0.0001;

        const now = Date.now();
        camPosDir.copy(camera.position).normalize();
        
        // Cache tracked hexes for this frame to avoid repeated lookups
        const trackedSet = new Set(trackedFlightsRef.current.map(f => f.hex));
        
        const r_earth = globeRadius;
        const r_cam = camera.position.length();
        const horizonCos = r_earth / r_cam;
        const cullThreshold = horizonCos - 0.15;

        activePlanesRef.current.forEach((data) => {
          try {
            if (!data.hasTwoPoints || !data.targetPos) return;

            planeDir.copy(data.mesh.position).normalize();
            let finalVisible = planeDir.dot(camPosDir) >= cullThreshold;

            if (finalVisible) {
              const hex = data.flightData.hex;
              const isEmergency = emergencyHexesRef.current.has(hex);
              const isTracked = trackedSet.has(hex);
              const type = data.mesh.userData.type;
              const mode = trafficModeRef.current;

              if (mode === 'OFF') finalVisible = isEmergency;
              else if (mode === 'SELECTED') finalVisible = isEmergency || isTracked;
              else if (mode === 'HEAVY') finalVisible = isEmergency || type === 'widebody';
              else if (mode === 'PRIVATE') finalVisible = isEmergency || type === 'privateJet';
              else if (mode === 'HELI') finalVisible = isEmergency || type === 'heli';

              if (finalVisible) {
                data.mesh.position.lerp(data.targetPos, 0.015);
                const currentRad = data.mesh.position.length();
                const targetRad = data.targetPos.length();
                const nextRad = THREE.MathUtils.lerp(currentRad, targetRad, 0.05);
                data.mesh.position.normalize().multiplyScalar(nextRad);

                const targetT = Number(data.targetTrack) || 0;
                const currentT = data.mesh.userData.currentTrack || targetT;
                let diffT = targetT - currentT;
                if (diffT > 180) diffT -= 360;
                if (diffT < -180) diffT += 360;
                const newTrack = currentT + (diffT * 0.05);

                orientPlane(data.mesh, data.mesh.position, newTrack);
                data.mesh.userData.currentTrack = newTrack;

                const targetMat = isEmergency ? materials.emergency : ((materials as any)[type] || materials.classic);
                if (data.mesh.userData.lastMat !== targetMat) {
                  data.mesh.traverse((child: any) => { if (child.isMesh) child.material = targetMat; });
                  data.mesh.userData.lastMat = targetMat;
                }

                const rotor = rotorMeshesRef.current.get(data.flightData.hex);
                if (rotor) rotor.rotation.y += 0.5;
              }
            }
            data.mesh.visible = finalVisible;
          } catch (e) {
            // Skip individual errors
          }
        });

        // Pulse emergency planes with sine-wave scale
        const pulseScale = 0.2 + Math.abs(Math.sin(now * 0.003)) * 0.18;
        for (const hex of emergencyHexesRef.current) {
          const pd = activePlanesRef.current.get(hex);
          if (pd && pd.mesh && pd.mesh.visible) pd.mesh.scale.setScalar(pulseScale);
        }

        // Update tracked planes' screen positions for the SVG tracking lines
        for (const flight of trackedFlightsRef.current) {
          const planeData = activePlanesRef.current.get(flight.hex);
          if (!planeData || !planeData.mesh) {
            trackedPositionsRef.current.delete(flight.hex);
            continue;
          }
          planeData.mesh.getWorldPosition(scrPos);
          scrPDir.copy(scrPos).normalize();
          scrVec.copy(scrPos);
          scrVec.project(camera);
          
          const x = (scrVec.x * 0.5 + 0.5) * window.innerWidth;
          const y = (scrVec.y * -0.5 + 0.5) * window.innerHeight;
          const visible = scrVec.z <= 1 && scrPDir.dot(camPosDir) >= cullThreshold;
          trackedPositionsRef.current.set(flight.hex, { x, y, visible });
        }

        // Smooth Camera Follow
        if (targetCameraPosRef.current && cameraRef.current) {
          cameraRef.current.position.lerp(targetCameraPosRef.current, 0.05);
          if (cameraRef.current.position.distanceTo(targetCameraPosRef.current) < 1) {
            targetCameraPosRef.current = null;
          }
        }

        controls.update();
        renderer.render(scene, camera);
      } catch (e) {
        console.error("[HUD] Render loop failure:", e);
      }
    };
    // Initial start
    requestRef.current = requestAnimationFrame(animate);

    // Screen-space click interactivity
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      let bestMatch = null;
      let minDistance = 0.04;

      // Reuse vectors to prevent allocation hiccup
      const curCamPos = camera.position.clone().normalize(); 
      const r_earth = globeRadius;
      const r_cam = camera.position.length();
      const horizonCos = r_earth / r_cam;
      const clickCull = horizonCos - 0.15;

      if (flightsGroupRef.current && flightsGroupRef.current.visible) {
        for (const [, data] of activePlanesRef.current.entries()) {
          data.mesh.getWorldPosition(scrPos);
          scrPDir.copy(scrPos).normalize();

          if (scrPDir.dot(curCamPos) < clickCull) continue;

          scrVec.copy(scrPos).project(camera);
          const dist = Math.sqrt(Math.pow(scrVec.x - mouse.x, 2) + Math.pow(scrVec.y - mouse.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = data.flightData;
          }
        }
      }

      if (bestMatch) {
        const hex = bestMatch.hex;
        const current = trackedFlightsRef.current;
        const alreadyTracked = current.findIndex(f => f.hex === hex);
        let next: FlightState[];
        if (alreadyTracked >= 0) {
          next = current.filter(f => f.hex !== hex);
          trackedPositionsRef.current.delete(hex);
        } else if (current.length < 20) {
          next = [...current, bestMatch];
        } else {
          next = current; 
        }
        trackedFlightsRef.current = next;
        setTrackedFlights([...next]);
        onSelectIncident(bestMatch);
      }
    };
    window.addEventListener('click', onMouseClick);

    // Double-click anywhere on the canvas to reset camera to default position
    const onDblClick = () => {
      camera.position.set(0, 0, 250);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    renderer.domElement.addEventListener('dblclick', onDblClick);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current);
      cancelAnimationFrame(batchRequestRef.current);
      isBatchingRef.current = false;
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      clearInterval(trackedInterval);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); // Run once

  // 2. Hydrate Static Incidents & Handle Incident-to-Telemetry Tracking
  useEffect(() => {
    if (!selectedIncident) {
      onTelemetryMatch?.(false);
      return;
    }

    const reg = selectedIncident.registration?.toUpperCase();
    const callsign = selectedIncident.callsign?.toUpperCase();
    const flightId = selectedIncident.source_id?.toUpperCase();
    
    // Search activePlanesRef for a match
    let matchedFlight: FlightState | null = null;
    
    for (const [, data] of activePlanesRef.current.entries()) {
      const live = data.flightData as FlightState;
      const liveReg = (live.r || '').toUpperCase();
      const liveFlight = (live.flight || '').toUpperCase();
      
      // Match on registration, callsign, or hex (if available)
      if (
        (reg && liveReg === reg) || 
        (reg && liveFlight === reg) || 
        (callsign && liveFlight === callsign) || 
        (callsign && liveReg === callsign) ||
        (flightId && liveFlight === flightId)
      ) {
        matchedFlight = live;
        break;
      }
    }

    if (matchedFlight) {
      // Force track this flight
      const current = trackedFlightsRef.current;
      if (!current.some(f => f.hex === matchedFlight!.hex)) {
        const next = [...current, matchedFlight].slice(-20);
        trackedFlightsRef.current = next;
        setTrackedFlights([...next]);
      }

      // Set camera target for smooth follow
      const pos = latLonToVector3(matchedFlight.lat, matchedFlight.lon, globeRadius + 60);
      targetCameraPosRef.current = pos;

      onTelemetryMatch?.(true);
    } else {
      onTelemetryMatch?.(false);
      targetCameraPosRef.current = null;
    }
  }, [selectedIncident, onTelemetryMatch]);

  // 3. Sync Traffic Visibility
  useEffect(() => {
    if (flightsGroupRef.current) {
      // Group itself stays visible so we can control individual plane visibility in the animate loop
      flightsGroupRef.current.visible = true;
    }
  }, [trafficMode]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Tactical Gradient Fades (Left/Right) - Below UI panels, above Globe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '580px', height: '100%',
        background: 'linear-gradient(to right, #030304 35%, transparent 100%)',
        zIndex: 5, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '480px', height: '100%',
        background: 'linear-gradient(to left, #030304 35%, transparent 100%)',
        zIndex: 5, pointerEvents: 'none'
      }} />

      {/* Emergency alert banner — bottom centre, always on top */}
      <EmergencyAlertBanner flights={emergencyFlights} />

      {/* 2×2 multi-plane tracking grid + SVG tracking lines */}
      {(trafficMode === 'SELECTED' || trafficMode === 'ALL') && (
        <FlightTrackingGrid
          trackedFlights={trackedFlights}
          trackedPositionsRef={trackedPositionsRef}
          onRemove={(hex) => {
            const next = trackedFlightsRef.current.filter(f => f.hex !== hex);
            trackedFlightsRef.current = next;
            trackedPositionsRef.current.delete(hex);
            setTrackedFlights([...next]);
          }}
        />
      )}

      {/* Tactical Air Traffic Toggle + Reset View */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        zIndex: 20,
        display: 'flex',
        gap: '8px',
        pointerEvents: 'all'
      }}>
        <button
          onClick={() => {
            const modes: any[] = ['OFF', 'SELECTED', 'ALL', 'HEAVY', 'PRIVATE', 'HELI'];
            const nextIdx = (modes.indexOf(trafficMode) + 1) % modes.length;
            setTrafficMode(modes[nextIdx]);
          }}
          style={{
            background: trafficMode !== 'OFF' ? 'rgba(207, 20, 43, 0.2)' : 'rgba(0, 0, 0, 0.5)',
            border: `1px solid ${trafficMode !== 'OFF' ? 'var(--rose-red)' : 'rgba(255, 255, 255, 0.2)'}`,
            color: trafficMode !== 'OFF' ? 'var(--rose-red)' : 'rgba(255, 255, 255, 0.5)',
            padding: '10px 20px',
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            minWidth: '180px',
            textAlign: 'center',
            backdropFilter: 'blur(4px)',
            boxShadow: trafficMode !== 'OFF' ? '0 0 15px rgba(207, 20, 43, 0.3)' : 'none'
          }}
        >
          {trafficMode === 'OFF' && 'TRAFFIC: OFF'}
          {trafficMode === 'SELECTED' && 'TRAFFIC: SELECTED'}
          {trafficMode === 'ALL' && 'TRAFFIC: ALL'}
          {trafficMode === 'HEAVY' && 'TRAFFIC: HEAVY ONLY'}
          {trafficMode === 'PRIVATE' && 'TRAFFIC: PRIVATE ONLY'}
          {trafficMode === 'HELI' && 'TRAFFIC: HELI ONLY'}
        </button>
        <button
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={() => {
            // Fire the dblclick on the canvas to trigger the reset handler
            mountRef.current?.querySelector('canvas')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          }}
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.4)',
            padding: '10px 16px',
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: '4px',
            backdropFilter: 'blur(4px)',
          }}
          title="Reset camera to default position"
        >
          ⌖ RESET VIEW
        </button>
      </div>
    </div>
  );
};

export default React.memo(GlobeScene);
