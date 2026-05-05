import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADSBTelemetryService } from '../services/ADSBTelemetryService';
import type { FlightState } from '../services/ADSBTelemetryService';
import FlightTrackingGrid from './FlightTrackingGrid';
import EmergencyAlertBanner, { EMERGENCY_SQUAWKS } from './EmergencyAlertBanner';

interface GlobeSceneProps {
  incidents: any[];
  onSelectIncident: (incident: any) => void;
}

const GlobeScene: React.FC<GlobeSceneProps> = ({ incidents, onSelectIncident }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const flightsGroupRef = useRef<THREE.Group | null>(null);
  const rotationGroupRef = useRef<THREE.Group | null>(null);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 132;  // ~32 units above surface — prevents getting stuck
    controls.maxDistance = 400;
    controls.enablePan = false;   // Ensure it always spins on the centre
    controls.target.set(0, 0, 0);

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
    const rotorMeshes = new Map<string, THREE.Object3D>();

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
          rotorMeshes.set(hex, rotor);
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

    const activePlanes = new Map<string, any>();
    const requestRef = { current: 0 };
    const TRANSITION_DURATION = 30000;

    const fetchLiveFlights = async () => {
      try {
        // Reduced radius to 12000 NM to be gentler on the proxy/API
        const rawFlights = await ADSBTelemetryService.getGlobalFlights();

        const apiSuccess = !!(rawFlights && rawFlights.length > 0);

        if (!apiSuccess) {
          console.warn("[HUD] Telemetry Feed Interrupted (502/Timeout). Preserving last known contacts.");
        }

        // Filter: Keep it simple to avoid string/type mismatches
        let flights = (rawFlights || []).filter((f: any) => {
          const alt = f.alt_geom || f.alt_baro || 0;
          return alt !== 'ground' && alt !== 0;
        });

        // Global Uniform Distribution: Render up to 5000 flights to ensure dense regions like UK/EU are populated
        if (flights.length > 5000) {
          flights = flights.sort(() => Math.random() - 0.5).slice(0, 5000);
        }

        if (!apiSuccess && activePlanes.size === 0) {
          console.log("[HUD] Initializing Global Tactical Simulation (200 contacts)");
          flights = Array.from({ length: 200 }).map((_, i) => ({
            hex: 'SIM' + i, // Persistent ID to prevent teleportation
            flight: 'STEL' + i,
            lat: (Math.random() * 180) - 90,
            lon: (Math.random() * 360) - 180,
            alt_geom: 10000 + Math.random() * 30000,
            alt_baro: 10000 + Math.random() * 30000,
            track: Math.random() * 360,
            gs: 450,
            t: ['A388', 'GLF6', 'EC35', 'A320'][i % 4] // Diversify types for filter testing
          }));
        }

        if (flights && flights.length > 0) {
          const currentHexes = new Set();
          const now = Date.now();

          // --- BALANCED BATCHED PROCESSING ---
          let index = 0;
          const BATCH_SIZE = 150; // Optimized for performance/responsiveness

          const processBatch = () => {
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

              const planeData = activePlanes.get(flight.hex);
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

                activePlanes.set(flight.hex, {
                  mesh,
                  startPos: pos.clone(),
                  targetPos: projectedTarget,
                  startTime: now,
                  startTrack: currentTrack,
                  targetTrack: currentTrack,
                  hasTwoPoints: true,
                  flightData: flight,
                  staleCount: 0
                });
              }
            }

            if (index < flights.length) {
              requestAnimationFrame(processBatch);
            } else {
              // Final cleanup and Emergency Scan after batch completes
              const newEmergencyHexes = new Set<string>();
              const newEmergencyFlights: any[] = [];

              for (const [hex, data] of activePlanes.entries()) {
                // 1. Cleanup stale contacts
                if (apiSuccess && !currentHexes.has(hex) && !hex.startsWith('SIM')) {
                  data.staleCount = (data.staleCount || 0) + 1;
                  if (data.staleCount > 3) {
                    flightsGroup.remove(data.mesh);
                    activePlanes.delete(hex);
                    rotorMeshes.delete(hex);
                    continue;
                  }
                }

                // 2. Emergency Detection
                const sq = String(data.flightData?.squawk ?? '');
                if (EMERGENCY_SQUAWKS[sq]) {
                  newEmergencyFlights.push(data.flightData);
                  newEmergencyHexes.add(hex);
                }
              }

              emergencyHexesRef.current = newEmergencyHexes;
              setEmergencyFlights(newEmergencyFlights);
            }
          };

          processBatch();
        }
      } catch (error) {
        console.error("ADSB telemetry sync critical failure:", error);
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, TRANSITION_DURATION);

    // High-frequency poll: Rotating single-aircraft queue
    // Spreads the load to exactly 1 request per second, which is much safer for residential proxies
    const trackedInterval = setInterval(async () => {
      const hexes = trackedFlightsRef.current.map(f => f.hex).filter(h => !h.startsWith('SIM'));
      if (hexes.length === 0) return;

      // Cycle through the tracked flights one at a time
      if (pollIndexRef.current >= hexes.length) pollIndexRef.current = 0;
      const hex = hexes[pollIndexRef.current];
      pollIndexRef.current++;

      try {
        const fresh = await ADSBTelemetryService.getFlightByHex(hex);
        if (fresh && activePlanes.has(hex)) {
          activePlanes.get(hex).flightData = fresh;

          // Sync state for the instruments
          const synced = trackedFlightsRef.current.map(f => {
            const live = activePlanes.get(f.hex);
            return live ? live.flightData : f;
          });
          trackedFlightsRef.current = synced;
          setTrackedFlights([...synced]);
        }
      } catch (e) {
        // Silent fail for single aircraft drops
      }
    }, 1000); // Constant 1 request per second frequency

    // Dynamic Animation Loop with Plane Interpolation
    let lastTrackedSync = 0;
    const camPosDir = new THREE.Vector3();
    const planeDir = new THREE.Vector3();

    const animate = () => {
      try {
        requestAnimationFrame(animate);
        rotationGroup.rotation.y += 0.0001; // Gentle earth rotation

        const now = Date.now();

        // Dynamic Horizon Culling variables
        camPosDir.copy(camera.position).normalize();

        const r_earth = globeRadius;
        const r_cam = camera.position.length();
        const horizonCos = r_earth / r_cam;
        const cullThreshold = horizonCos - 0.15;

        activePlanes.forEach((data) => {
          try {
            if (!data.hasTwoPoints || !data.targetPos) return;

            // 1. Fast Visibility Culling (Check before any math)
            planeDir.copy(data.mesh.position).normalize();
            let finalVisible = planeDir.dot(camPosDir) >= cullThreshold;

            if (finalVisible) {
              const isEmergency = emergencyHexesRef.current.has(data.flightData.hex);
              const isTracked = trackedFlightsRef.current.some(f => f.hex === data.flightData.hex);
              const type = data.mesh.userData.type;
              const mode = trafficModeRef.current;

              if (mode === 'OFF') finalVisible = isEmergency;
              else if (mode === 'SELECTED') finalVisible = isEmergency || isTracked;
              else if (mode === 'HEAVY') finalVisible = isEmergency || type === 'widebody';
              else if (mode === 'PRIVATE') finalVisible = isEmergency || type === 'privateJet';
              else if (mode === 'HELI') finalVisible = isEmergency || type === 'heli';

              if (finalVisible) {
                // 2. Heavy Math only for visible aircraft
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

                const targetMat = isEmergency ? materials.emergency : (materials[type] || materials.classic);
                if (data.mesh.userData.lastMat !== targetMat) {
                  data.mesh.traverse((child) => { if ((child as any).isMesh) (child as any).material = targetMat; });
                  data.mesh.userData.lastMat = targetMat;
                }

                const rotor = rotorMeshes.get(data.flightData.hex);
                if (rotor) rotor.rotation.y += 0.5;
              }
            }
            data.mesh.visible = finalVisible;

            // Animate rotors if applicable
            const rotor = rotorMeshes.get(data.flightData.hex);
            if (rotor && finalVisible) {
              rotor.rotation.y += 0.5; // High-speed rotation
            }
          } catch (e) {
            // Silently skip individual plane errors to keep the scene running
          }
        });

        // Pulse emergency planes with sine-wave scale
        const pulseScale = 0.2 + Math.abs(Math.sin(now * 0.003)) * 0.18;
        for (const hex of emergencyHexesRef.current) {
          const pd = activePlanes.get(hex);
          if (pd && pd.mesh && pd.mesh.visible) pd.mesh.scale.setScalar(pulseScale);
        }

        // Update tracked planes' screen positions for the SVG tracking lines
        for (const flight of trackedFlightsRef.current) {
          const planeData = activePlanes.get(flight.hex);
          if (!planeData || !planeData.mesh) {
            trackedPositionsRef.current.delete(flight.hex);
            continue;
          }
          const planeWorldPos = new THREE.Vector3();
          planeData.mesh.getWorldPosition(planeWorldPos);
          const planeDir = planeWorldPos.clone().normalize();
          const vector = planeWorldPos.clone();
          vector.project(camera);
          const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
          const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
          const visible = vector.z <= 1 && planeDir.dot(camPosDir) >= cullThreshold;
          trackedPositionsRef.current.set(flight.hex, { x, y, visible });
        }

        // Throttle: re-sync tracked flight telemetry from activePlanes every 1 second
        if (now - lastTrackedSync > 1000 && trackedFlightsRef.current.length > 0) {
          lastTrackedSync = now;
          let changed = false;
          const synced = trackedFlightsRef.current.map(f => {
            const live = activePlanes.get(f.hex);
            if (live && live.flightData !== f) { changed = true; return live.flightData as typeof f; }
            return f;
          });
          if (changed) {
            trackedFlightsRef.current = synced;
            setTrackedFlights([...synced]);
          }
        }

        controls.update();
        renderer.render(scene, camera);
        requestRef.current = requestAnimationFrame(animate);
      } catch (e) {
        console.error("[HUD] Render loop failure:", e);
        requestRef.current = requestAnimationFrame(animate);
      }
    };
    requestRef.current = requestAnimationFrame(animate);

    // Screen-space click interactivity
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      let bestMatch = null;
      // Generous hit radius (~30px on a 1080p screen)
      let minDistance = 0.04;

      const camPosDir = camera.position.clone().normalize();
      const r_earth = globeRadius;
      const r_cam = camera.position.length();
      const horizonCos = r_earth / r_cam;
      const cullThreshold = horizonCos - 0.15;

      // Manual screen-space hit detection (much more reliable than clicking tiny 3D polygons)
      if (flightsGroupRef.current && flightsGroupRef.current.visible) {
        for (const [, data] of activePlanes.entries()) {
          const planeWorldPos = new THREE.Vector3();
          data.mesh.getWorldPosition(planeWorldPos);
          const planeDir = planeWorldPos.clone().normalize();

          // Skip planes on the back of the globe
          if (planeDir.dot(camPosDir) < cullThreshold) continue;

          const vector = planeWorldPos.clone();
          vector.project(camera);

          const dist = Math.sqrt(Math.pow(vector.x - mouse.x, 2) + Math.pow(vector.y - mouse.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = data.flightData;
          }
        }
      }

      if (bestMatch) {
        // Toggle: if already tracked, remove it; otherwise add (max 4)
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
          next = current; // 20 plane limit reached
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
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      clearInterval(trackedInterval);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); // Run once

  // 2. Hydrate Static Incidents
  useEffect(() => {
    // Left intentionally empty for now.
  }, [incidents]);

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
