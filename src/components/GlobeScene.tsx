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
  onFlightsLoaded?: () => void;
}

const GlobeScene: React.FC<GlobeSceneProps> = ({ selectedIncident, onTelemetryMatch, onSelectIncident, onFlightsLoaded }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const flightsGroupRef = useRef<THREE.Group | null>(null);
  const rotationGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Multi-plane tracking
  const [trackedFlights, setTrackedFlights] = useState<FlightState[]>([]);
  const trackedFlightsRef = useRef<FlightState[]>([]);
  const trackedPositionsRef = useRef<Map<string, { x: number; y: number; visible: boolean }>>(new Map());

  // Emergency flight detection
  const [emergencyFlights, setEmergencyFlights] = useState<FlightState[]>([]);
  const emergencyHexesRef = useRef<Set<string>>(new Set());

  const pollIndexRef = useRef(0);

  const [trafficMode, setTrafficMode] = useState<'OFF' | 'SELECTED' | 'ALL' | 'HEAVY' | 'TACTICAL' | 'CRITICAL' | 'PRIVATE' | 'HELI'>('TACTICAL');
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
    const r = radius + (alt * 0.00015);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  };

  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState<'GLOBAL' | 'TRAIL'>('GLOBAL');
  const [povIndex, setPovIndex] = useState(0);

  const viewModeRef = useRef(viewMode);
  const povIndexRef = useRef(povIndex);
  const selectedIncidentRef = useRef(selectedIncident);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { povIndexRef.current = povIndex; }, [povIndex]);
  useEffect(() => { selectedIncidentRef.current = selectedIncident; }, [selectedIncident]);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 132;
    controls.maxDistance = 400;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 3, 5);
    scene.add(mainLight);

    // Globe
    const geometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const earthTexture = new THREE.TextureLoader().load('/textures/earth_grayscale.jpg');
    const material = new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 2, specular: 0x111111 });
    const globe = new THREE.Mesh(geometry, material);

    const rotationGroup = new THREE.Group();
    rotationGroupRef.current = rotationGroup;
    rotationGroup.add(globe);
    scene.add(rotationGroup);

    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    rotationGroup.add(markersGroup);

    const flightsGroup = new THREE.Group();
    flightsGroupRef.current = flightsGroup;
    rotationGroup.add(flightsGroup);

    const materials = {
      classic: new THREE.MeshPhongMaterial({ color: 0xff4d4d, emissive: 0x220000, shininess: 80, specular: 0x444444, side: THREE.DoubleSide }),
      widebody: new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x111111, shininess: 100, specular: 0xffffff, side: THREE.DoubleSide }),
      privateJet: new THREE.MeshPhongMaterial({ color: 0x00f2ff, emissive: 0x002222, shininess: 120, specular: 0x00ffff, side: THREE.DoubleSide }),
      heli: new THREE.MeshPhongMaterial({ color: 0xffea00, emissive: 0x222200, shininess: 60, specular: 0xffffff, side: THREE.DoubleSide }),
      emergency: new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xbb0000, shininess: 150, specular: 0xffffff, side: THREE.DoubleSide })
    };

    const createGeometries = () => {
      const createSweptWing = (span: number, rootChord: number, tipChord: number, sweep: number) => {
        const shape = new THREE.Shape();
        shape.moveTo(0, rootChord / 2);
        shape.lineTo(span / 2, tipChord / 2 - sweep);
        shape.lineTo(span / 2, -tipChord / 2 - sweep);
        shape.lineTo(0, -rootChord / 2);
        shape.lineTo(-span / 2, -tipChord / 2 - sweep);
        shape.lineTo(-span / 2, tipChord / 2 - sweep);
        shape.lineTo(0, rootChord / 2);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(Math.PI / 2);
        return geom;
      };

      const cFuselage = new THREE.CylinderGeometry(0.12, 0.35, 2.6, 6);
      cFuselage.rotateX(Math.PI / 2);
      const cWings = createSweptWing(2.8, 0.7, 0.35, 0.4);
      cWings.translate(0, -0.05, -0.1);
      const cTailFin = new THREE.BoxGeometry(0.05, 0.8, 0.5);
      cTailFin.translate(0, 0.4, -1.1);
      const cTailHoriz = createSweptWing(1.1, 0.4, 0.2, 0.2);
      cTailHoriz.translate(0, 0.1, -1.1);
      const classic = BufferGeometryUtils.mergeGeometries([cFuselage, cWings, cTailFin, cTailHoriz]);

      const wFuselage = new THREE.CylinderGeometry(0.25, 0.55, 3.8, 8);
      wFuselage.rotateX(Math.PI / 2);
      const wHump = new THREE.BoxGeometry(0.6, 0.3, 1.5);
      wHump.translate(0, 0.4, 1.0);
      const wWings = createSweptWing(5.0, 1.2, 0.5, 0.8);
      wWings.translate(0, -0.1, -0.2);
      const engine = new THREE.CylinderGeometry(0.22, 0.2, 0.7, 6);
      engine.rotateX(Math.PI / 2);
      const e1 = engine.clone().translate(1.1, -0.3, -0.15);
      const e2 = engine.clone().translate(2.0, -0.3, -0.5);
      const e3 = engine.clone().translate(-1.1, -0.3, -0.15);
      const e4 = engine.clone().translate(-2.0, -0.3, -0.5);
      const wTailFin = new THREE.BoxGeometry(0.08, 1.2, 0.7);
      wTailFin.translate(0, 0.6, -1.8);
      const wTailHoriz = createSweptWing(1.8, 0.6, 0.3, 0.3);
      wTailHoriz.translate(0, 0.2, -1.8);
      const widebody = BufferGeometryUtils.mergeGeometries([wFuselage, wHump, wWings, e1, e2, e3, e4, wTailFin, wTailHoriz]);

      const pFuselage = new THREE.CylinderGeometry(0.1, 0.25, 2.4, 5);
      pFuselage.rotateX(Math.PI / 2);
      const pWings = createSweptWing(2.5, 0.6, 0.3, 0.4);
      pWings.translate(0, -0.05, -0.2);
      const pTailVert = new THREE.BoxGeometry(0.05, 0.9, 0.4);
      pTailVert.translate(0, 0.45, -1.1);
      const pTailHoriz = createSweptWing(1.2, 0.3, 0.15, 0.15);
      pTailHoriz.translate(0, 0.9, -1.1);
      const pEngine = new THREE.CylinderGeometry(0.18, 0.15, 0.6, 5);
      pEngine.rotateX(Math.PI / 2);
      const pe1 = pEngine.clone().translate(0.45, 0.2, -0.8);
      const pe2 = pEngine.clone().translate(-0.45, 0.2, -0.8);
      const privateJet = BufferGeometryUtils.mergeGeometries([pFuselage, pWings, pTailVert, pTailHoriz, pe1, pe2]);

      const hBody = new THREE.SphereGeometry(0.5, 8, 8);
      hBody.scale(1, 0.8, 1.4);
      const hs1 = new THREE.BoxGeometry(0.05, 0.05, 1.4).translate(0.3, -0.5, 0);
      const hs2 = new THREE.BoxGeometry(0.05, 0.05, 1.4).translate(-0.3, -0.5, 0);
      const hTail = new THREE.CylinderGeometry(0.08, 0.03, 1.4, 4);
      hTail.rotateX(Math.PI / 2).translate(0, 0.1, -1.0);
      const hTailFin = new THREE.BoxGeometry(0.05, 0.4, 0.3).translate(0, 0.3, -1.6);
      const heliBody = BufferGeometryUtils.mergeGeometries([hBody, hs1, hs2, hTail, hTailFin]);

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
          const g = geometries[type as keyof typeof geometries] || geometries.classic;
          const m = new THREE.Mesh(g, mat);
          group.add(m);
          if (type === 'widebody') group.scale.set(0.35, 0.35, 0.35);
          else if (type === 'privateJet') group.scale.set(0.15, 0.15, 0.15);
          else group.scale.set(0.25, 0.25, 0.25);
        }
        group.userData.lastMat = mat;
        return group;
      } catch (e) {
        return new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.classic));
      }
    };

    const orientPlane = (mesh: THREE.Object3D, pos: THREE.Vector3, track: number) => {
      const normal = pos.clone().normalize();
      const trackRad = (track || 0) * (Math.PI / 180);
      const worldUp = new THREE.Vector3(0, 1, 0);
      const east = (Math.abs(normal.y) > 0.999) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(worldUp, normal).normalize();
      const north = new THREE.Vector3().crossVectors(normal, east).normalize();
      const forward = new THREE.Vector3().addScaledVector(north, Math.cos(trackRad)).addScaledVector(east, Math.sin(trackRad)).normalize();
      const side = new THREE.Vector3().crossVectors(forward, normal).normalize();
      const up = new THREE.Vector3().crossVectors(side, forward).normalize();
      const matrix = new THREE.Matrix4().makeBasis(side, up, forward);
      mesh.quaternion.setFromRotationMatrix(matrix);
    };

    let lastFrameTime = Date.now();
    const TRANSITION_DURATION = 30000;

    const fetchLiveFlights = async () => {
      if (isBatchingRef.current) return;
      isBatchingRef.current = true;
      try {
        const rawFlights = await ADSBTelemetryService.getGlobalFlights();
        const apiSuccess = !!(rawFlights && rawFlights.length > 0);
        let flights = rawFlights || [];

        const currentHexes = new Set();
        const now = Date.now();
        
        // Priority Sort: Emergency > Tracked > Heavy > Others
        const sortedFlights = [...flights].sort((a, b) => {
          const isEmA = a.squawk && EMERGENCY_SQUAWKS[a.squawk] ? 1 : 0;
          const isEmB = b.squawk && EMERGENCY_SQUAWKS[b.squawk] ? 1 : 0;
          if (isEmA !== isEmB) return isEmB - isEmA;
          
          const isTrackA = trackedFlightsRef.current.some(f => f.hex === a.hex) ? 1 : 0;
          const isTrackB = trackedFlightsRef.current.some(f => f.hex === b.hex) ? 1 : 0;
          if (isTrackA !== isTrackB) return isTrackB - isTrackA;

          return 0;
        });

        const CHUNK_SIZE = 50;
        let index = 0;

        const processChunk = () => {
          const end = Math.min(index + CHUNK_SIZE, sortedFlights.length);
          for (; index < end; index++) {
            const f = sortedFlights[index];
            if (!f.hex) continue;
            currentHexes.add(f.hex);
            
            const pos = latLonToVector3(f.lat, f.lon, globeRadius, f.alt_geom || f.alt_baro || 0);
            const gs = Number(f.gs || 450);
            const distDeg = gs / 7200;
            const trackRad = (f.track || 0) * (Math.PI / 180);
            const projectedTarget = latLonToVector3(
              f.lat + Math.cos(trackRad) * distDeg, 
              f.lon + (Math.sin(trackRad) * distDeg) / Math.cos(f.lat * Math.PI / 180), 
              globeRadius, 
              f.alt_geom || f.alt_baro || 0
            );

            const planeData = activePlanesRef.current.get(f.hex);
            if (planeData) {
              planeData.startPos.copy(planeData.mesh.position);
              planeData.targetPos.copy(projectedTarget);
              planeData.startTime = now;
              planeData.targetTrack = f.track || 0;
              planeData.flightData = f;
            } else {
              const mesh = createPlaneMesh(f.hex, f.t);
              mesh.position.copy(pos);
              flightsGroup.add(mesh);
              activePlanesRef.current.set(f.hex, { 
                mesh, 
                startPos: pos.clone(), 
                targetPos: projectedTarget, 
                startTime: now, 
                targetTrack: f.track || 0, 
                flightData: f, 
                hasTwoPoints: true 
              });
            }
          }

          if (index < sortedFlights.length) {
            requestAnimationFrame(processChunk);
          } else {
            // Cleanup stale planes after all chunks are processed
            activePlanesRef.current.forEach((data, hex) => {
              if (apiSuccess && !currentHexes.has(hex)) {
                data.staleCount = (data.staleCount || 0) + 1;
                if (data.staleCount > 3) {
                  flightsGroup.remove(data.mesh);
                  activePlanesRef.current.delete(hex);
                  rotorMeshesRef.current.delete(hex);
                }
              }
            });

            // Scan for emergencies
            const currentEmergencyFlights = Array.from(activePlanesRef.current.values())
              .map(d => d.flightData)
              .filter(f => f.squawk && EMERGENCY_SQUAWKS[f.squawk]);
            setEmergencyFlights(currentEmergencyFlights);
            emergencyHexesRef.current = new Set(currentEmergencyFlights.map(f => f.hex));

            // Call match callback if selected plane is found
            if (selectedIncidentRef.current) {
              const match = activePlanesRef.current.has(selectedIncidentRef.current.flight_hex?.toLowerCase() || '');
              onTelemetryMatch?.(match);
            }
            onFlightsLoaded?.();
            isBatchingRef.current = false;
          }
        };

        processChunk();
      } catch (e) {
        console.error('Failed to fetch live incidents:', e);
        isBatchingRef.current = false;
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, TRANSITION_DURATION);

    const trackedInterval = setInterval(async () => {
      const hexes = trackedFlightsRef.current.map(f => f.hex);
      if (hexes.length === 0) return;
      if (pollIndexRef.current >= hexes.length) pollIndexRef.current = 0;
      const hex = hexes[pollIndexRef.current];
      pollIndexRef.current++;
      try {
        const fresh = await ADSBTelemetryService.getFlightByHex(hex);
        if (fresh && activePlanesRef.current.has(hex)) {
          activePlanesRef.current.get(hex).flightData = fresh;
          const synced = trackedFlightsRef.current.map(f => activePlanesRef.current.get(f.hex)?.flightData || f);
          trackedFlightsRef.current = synced;
          setTrackedFlights([...synced]);
        }
      } catch (e) {}
    }, 1000);

    const animate = () => {
      batchRequestRef.current = requestAnimationFrame(animate);
      const now = Date.now();
      const deltaMs = now - lastFrameTime;
      const deltaSec = deltaMs / 1000;
      const camPosDir = camera.position.clone().normalize();
      const horizonCos = globeRadius / camera.position.length();

      activePlanesRef.current.forEach((data) => {
        const hex = data.flightData.hex;
        const type = data.mesh.userData.type;
        const mode = trafficModeRef.current;
        const isTracked = trackedFlightsRef.current.some(f => f.hex === hex);
        const isEmergency = !!(data.flightData.squawk && EMERGENCY_SQUAWKS[data.flightData.squawk]);

        let visible = data.mesh.position.clone().normalize().dot(camPosDir) >= (horizonCos - 0.2);
        if (visible) {
          if (mode === 'OFF') visible = false;
          else if (mode === 'SELECTED') visible = isTracked;
          else if (mode === 'CRITICAL') visible = isEmergency;
          else if (mode === 'TACTICAL') visible = isEmergency || isTracked || type === 'widebody';
          else if (mode === 'HEAVY') visible = type === 'widebody';
          else if (mode === 'PRIVATE') visible = type === 'privateJet';
          else if (mode === 'HELI') visible = type === 'heli';
          
          // Emergency and Tracked always override visibility if in view
          if (isEmergency || isTracked) visible = data.mesh.position.clone().normalize().dot(camPosDir) >= (horizonCos - 0.2);
        }
        data.mesh.visible = visible;

        if (visible) {
          const t = (now - data.startTime) / TRANSITION_DURATION;
          data.mesh.position.lerpVectors(data.startPos, data.targetPos, t);
          const altR = globeRadius + ((data.flightData.alt_geom || 0) * 0.00015);
          data.mesh.position.normalize().multiplyScalar(altR);

          const targetT = data.targetTrack;
          let currentT = data.mesh.userData.currentTrack || targetT;
          let diffT = targetT - currentT;
          if (diffT > 180) diffT -= 360; if (diffT < -180) diffT += 360;
          currentT += Math.sign(diffT) * Math.min(Math.abs(diffT), 45 * deltaSec);
          data.mesh.userData.currentTrack = currentT;
          orientPlane(data.mesh, data.mesh.position, currentT);

          const mat = isEmergency ? materials.emergency : (materials[type as keyof typeof materials] || materials.classic);
          if (data.mesh.userData.lastMat !== mat) {
            data.mesh.traverse((c: any) => { if (c.isMesh) c.material = mat; });
            data.mesh.userData.lastMat = mat;
          }
          const rotor = rotorMeshesRef.current.get(hex);
          if (rotor) rotor.rotation.y += 5 * deltaSec;
        }

        // Pulse emergency planes
        if (isEmergency && data.mesh.visible) {
          const pulse = 0.2 + Math.abs(Math.sin(now * 0.003)) * 0.18;
          data.mesh.scale.setScalar(pulse);
        }
      });

      // Update screen positions for tracking overlay
      trackedFlightsRef.current.forEach(f => {
        const d = activePlanesRef.current.get(f.hex);
        if (d && d.mesh) {
          const p = d.mesh.position.clone().project(camera);
          trackedPositionsRef.current.set(f.hex, {
            x: (p.x * 0.5 + 0.5) * window.innerWidth,
            y: (p.y * -0.5 + 0.5) * window.innerHeight,
            visible: p.z <= 1 && d.mesh.position.clone().normalize().dot(camPosDir) >= (horizonCos - 0.2)
          });
        } else {
          trackedPositionsRef.current.delete(f.hex);
        }
      });

      // POV / Trail Mode
      let followedHex = null;
      if (selectedIncidentRef.current) {
        const hex = selectedIncidentRef.current.flight_hex?.toLowerCase();
        if (hex && activePlanesRef.current.has(hex)) followedHex = hex;
      }
      if (!followedHex && trackedFlightsRef.current.length > 0) followedHex = trackedFlightsRef.current[povIndexRef.current]?.hex;

      if (viewModeRef.current === 'TRAIL' && followedHex) {
        const lead = activePlanesRef.current.get(followedHex);
        if (lead) {
          const pPos = lead.mesh.position;
          const track = lead.mesh.userData.currentTrack || 0;
          const tRad = track * (Math.PI / 180);
          const norm = pPos.clone().normalize();
          const east = (Math.abs(norm.y) > 0.999) ? new THREE.Vector3(1,0,0) : new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), norm).normalize();
          const north = new THREE.Vector3().crossVectors(norm, east).normalize();
          const fwd = new THREE.Vector3().addScaledVector(north, Math.cos(tRad)).addScaledVector(east, Math.sin(tRad)).normalize();
          camera.position.copy(pPos).addScaledVector(fwd, 1.4).addScaledVector(norm, 0.4);
          camera.lookAt(pPos.clone().addScaledVector(fwd, 30));
        }
      } else {
        if (targetCameraPosRef.current) {
          camera.position.lerp(targetCameraPosRef.current, 0.05);
          controls.target.lerp(new THREE.Vector3(0,0,0), 0.05);
          if (camera.position.distanceTo(targetCameraPosRef.current) < 1) targetCameraPosRef.current = null;
        }
        controls.update();
      }

      renderer.render(scene, camera);
      lastFrameTime = now;
    };
    animate();

    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownTime = 0;

    const onPointerDown = (event: PointerEvent) => {
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      pointerDownTime = Date.now();
    };

    const onPointerUp = (event: PointerEvent) => {
      // Prevent selection if user clicked on HTML overlays, buttons, or panels
      if (event.target !== renderer.domElement) return;

      const deltaX = Math.abs(event.clientX - pointerDownX);
      const deltaY = Math.abs(event.clientY - pointerDownY);
      const deltaTime = Date.now() - pointerDownTime;

      // Ignore selection if the user was dragging/rotating (delta > 5px) or long pressing (> 300ms)
      if (deltaX > 5 || deltaY > 5 || deltaTime > 300) return;

      const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      let best: FlightState | null = null; 
      let minDist = 0.05;
      activePlanesRef.current.forEach((data) => {
        const sPos = data.mesh.position.clone().project(camera);
        const d = Math.sqrt((sPos.x - mouse.x)**2 + (sPos.y - mouse.y)**2);
        if (d < minDist) { minDist = d; best = data.flightData; }
      });
      if (best) {
        const selectedFlight = best as FlightState;
        const hex = selectedFlight.hex;
        setTrackedFlights(prev => {
          const isTracked = prev.some(f => f.hex === hex);
          const next = isTracked 
            ? prev.filter(f => f.hex !== hex) 
            : (prev.length < 20 ? [...prev, selectedFlight] : prev);
          trackedFlightsRef.current = next;
          return next;
        });
        onSelectIncident(selectedFlight);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      clearInterval(trackedInterval);
      cancelAnimationFrame(batchRequestRef.current);
      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('pointerdown', onPointerDown);
        rendererRef.current.domElement.removeEventListener('pointerup', onPointerUp);
      }
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const cycleTrafficMode = () => {
    const modes: ('ALL' | 'TACTICAL' | 'CRITICAL' | 'OFF' | 'SELECTED' | 'HEAVY' | 'PRIVATE' | 'HELI')[] = ['TACTICAL', 'CRITICAL', 'ALL', 'OFF', 'SELECTED', 'HEAVY', 'PRIVATE', 'HELI'];
    const nextIdx = (modes.indexOf(trafficMode) + 1) % modes.length;
    setTrafficMode(modes[nextIdx]);
  };

  const togglePov = () => {
    if (viewMode === 'GLOBAL') {
      if (trackedFlights.length > 0) {
        setPovIndex(0);
        setViewMode('TRAIL');
      }
    } else {
      // Cycle through tracked flights if multiple exist
      if (trackedFlights.length > 1 && povIndex < trackedFlights.length - 1) {
        setPovIndex(prev => prev + 1);
      } else {
        // Exit to global if at the end of the list or only 1 flight
        setViewMode('GLOBAL');
        setPovIndex(0);
        targetCameraPosRef.current = new THREE.Vector3(0, 40, 200);
      }
    }
  };

  const resetView = () => {
    setViewMode('GLOBAL');
    targetCameraPosRef.current = new THREE.Vector3(0, 0, 250);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {/* Emergency Overlays */}
      <EmergencyAlertBanner flights={emergencyFlights} />
      
      {/* Instrument Overlays */}
      <FlightTrackingGrid 
        trackedFlights={trackedFlights} 
        trackedPositionsRef={trackedPositionsRef} 
        onRemove={(hex) => setTrackedFlights(prev => {
          const next = prev.filter(f => f.hex !== hex);
          trackedFlightsRef.current = next;
          return next;
        })}
      />

      {/* Bottom Controls */}
      <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 40, display: 'flex', gap: '8px' }}>
        <button onClick={cycleTrafficMode} className="hud-button" style={{ width: '160px', color: trafficMode === 'ALL' ? 'var(--rose-red)' : 'white' }}>
          TRAFFIC: {trafficMode}
        </button>
        <button onClick={togglePov} className="hud-button" style={{ color: viewMode === 'TRAIL' ? 'var(--rose-red)' : 'white' }}>
          » POV MODE
        </button>
        <button onClick={() => { setIsLocating(true); setTimeout(() => setIsLocating(false), 2000); }} className="hud-button">
          ⊕ LOCATE
        </button>
        <button onClick={resetView} className="hud-button">
          ⋄ RESET VIEW
        </button>
      </div>

      {/* Locate Pulse */}
      {isLocating && (
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '100px', height: '100px', border: '2px solid var(--rose-red)', borderRadius: '50%',
          animation: 'locatePulse 1s infinite', pointerEvents: 'none', zIndex: 50
        }} />
      )}
    </div>
  );
};

export default GlobeScene;
