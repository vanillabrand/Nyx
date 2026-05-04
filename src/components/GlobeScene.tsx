import React, { useRef, useEffect } from 'react';
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
  const [trackedFlights, setTrackedFlights] = React.useState<FlightState[]>([]);
  const trackedFlightsRef = useRef<FlightState[]>([]);
  // Screen-space positions updated each animation frame, read by SVG overlay
  const trackedPositionsRef = useRef<Map<string, { x: number; y: number; visible: boolean }>>(new Map());

  // Emergency flight detection
  const [emergencyFlights, setEmergencyFlights] = React.useState<FlightState[]>([]);
  const emergencyHexesRef = useRef<Set<string>>(new Set());

  const [showTraffic, setShowTraffic] = React.useState<boolean>(false);

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

    // 3. Live Telemetry Polling via ADSB.lol
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x8B0A14 });
    const emergencyMaterial = new THREE.MeshBasicMaterial({ color: 0xff2020 });

    const fuselageGeom = new THREE.ConeGeometry(0.3, 2, 4);
    fuselageGeom.rotateX(-Math.PI / 2); // Nose points to -Z for correct lookAt orientation

    const wingsGeom = new THREE.BoxGeometry(2.5, 0.1, 0.8);
    wingsGeom.translate(0, 0, 0.2);

    const tailGeom = new THREE.BoxGeometry(0.1, 0.7, 0.4);
    tailGeom.translate(0, 0.35, 0.8);

    const planeGeom = BufferGeometryUtils.mergeGeometries([fuselageGeom, wingsGeom, tailGeom]);

    const createPlaneMesh = () => {
      const plane = new THREE.Mesh(planeGeom, planeMaterial);
      // Scale adjusted for a sharp tactical appearance
      plane.scale.set(0.2, 0.2, 0.2);
      return plane;
    };

    const orientPlane = (mesh: THREE.Object3D, pos: THREE.Vector3, track: number) => {
      const normal = pos.clone().normalize();
      mesh.up.copy(normal);

      const trackRad = (track || 0) * (Math.PI / 180);
      const worldUp = new THREE.Vector3(0, 1, 0);

      // Robust tangent calculation
      const east = Math.abs(normal.y) > 0.999
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3().crossVectors(worldUp, normal).normalize();
      const north = new THREE.Vector3().crossVectors(normal, east).normalize();

      const dir = new THREE.Vector3()
        .addScaledVector(north, Math.cos(trackRad))
        .addScaledVector(east, Math.sin(trackRad));

      mesh.lookAt(pos.clone().add(dir));
    };

    const activePlanes = new Map<string, any>();
    const TRANSITION_DURATION = 30000;

    const fetchLiveFlights = async () => {
      try {
        // Reduced radius to 12000 NM to be gentler on the proxy/API
        let rawFlights = await ADSBTelemetryService.getGlobalFlights();

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

        // If API fails completely, show a global simulation so the world isn't empty
        if (!apiSuccess && activePlanes.size === 0) {
          console.log("[HUD] Initializing Global Tactical Simulation (200 contacts)");
          flights = Array.from({ length: 200 }).map(() => ({
            hex: 'SIM' + Math.floor(Math.random() * 100000),
            flight: 'STEL' + Math.floor(Math.random() * 1000),
            lat: (Math.random() * 180) - 90,
            lon: (Math.random() * 360) - 180,
            alt_geom: 10000 + Math.random() * 30000,
            alt_baro: 10000 + Math.random() * 30000,
            track: Math.random() * 360,
            gs: 450
          }));
        }

        if (flights && flights.length > 0) {
          const currentHexes = new Set();
          const now = Date.now();

          flights.forEach((flight: any) => {
            if (!flight.hex || flight.lat === undefined || flight.lon === undefined) return;
            currentHexes.add(flight.hex);

            let alt = 5000;
            if (typeof flight.alt_geom === 'number') alt = flight.alt_geom;
            else if (typeof flight.alt_baro === 'number') alt = flight.alt_baro;
            else if (flight.alt_geom === 'ground' || flight.alt_baro === 'ground') alt = 0;

            const pos = latLonToVector3(flight.lat, flight.lon, globeRadius, alt);
            if (Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(pos.z)) return;

            if (activePlanes.has(flight.hex)) {
              const planeData = activePlanes.get(flight.hex);

              // Only start transitioning once we have a second true point
              if (!planeData.hasTwoPoints) {
                planeData.hasTwoPoints = true;
                planeData.mesh.visible = true;
                planeData.startPos.copy(planeData.targetPos);
                planeData.startTrack = planeData.targetTrack;
              } else {
                planeData.startPos.copy(planeData.targetPos);
                planeData.startTrack = planeData.targetTrack;
              }

              planeData.targetPos.copy(pos);
              planeData.startTime = now;
              planeData.targetTrack = flight.track || 0;
              planeData.flightData = flight;
            } else {
              const mesh = createPlaneMesh();
              mesh.position.copy(pos);
              mesh.visible = false; // Wait until we get a second coordinate
              flightsGroup.add(mesh);

              activePlanes.set(flight.hex, {
                mesh,
                startPos: pos.clone(),
                targetPos: pos.clone(),
                startTime: now,
                startTrack: flight.track || 0,
                targetTrack: flight.track || 0,
                hasTwoPoints: false,
                flightData: flight
              });
            }
          });

          // Garbage Collection: ONLY remove if the API actually gave us a fresh list
          if (apiSuccess) {
            for (const [hex, data] of activePlanes.entries()) {
              if (!currentHexes.has(hex) && !hex.startsWith('SIM')) {
                flightsGroup.remove(data.mesh);
                activePlanes.delete(hex);
              }
            }
          }

          // Emergency Squawk Detection: scan all active planes
          const newEmergencyHexes = new Set<string>();
          const newEmergencyFlights: FlightState[] = [];
          for (const [hex, data] of activePlanes.entries()) {
            const sq = String(data.flightData?.squawk ?? '');
            if (EMERGENCY_SQUAWKS[sq]) {
              newEmergencyFlights.push(data.flightData);
              newEmergencyHexes.add(hex);
              // Switch to red emergency material
              data.mesh.material = emergencyMaterial;
            } else if (emergencyHexesRef.current.has(hex)) {
              // Was emergency, no longer is — restore normal material
              data.mesh.material = planeMaterial;
            }
          }
          emergencyHexesRef.current = newEmergencyHexes;
          setEmergencyFlights(newEmergencyFlights);
        }
      } catch (error) {
        console.error("ADSB telemetry sync critical failure:", error);
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, TRANSITION_DURATION);

    // High-frequency poll: refresh tracked aircraft individually every 5s
    // Uses per-hex endpoint so we get fresh telemetry without waiting 30s
    const trackedInterval = setInterval(async () => {
      const hexes = trackedFlightsRef.current.map(f => f.hex);
      if (hexes.length === 0) return;
      await Promise.allSettled(hexes.map(async (hex) => {
        const fresh = await ADSBTelemetryService.getFlightByHex(hex);
        if (fresh && activePlanes.has(hex)) {
          activePlanes.get(hex).flightData = fresh;
        }
      }));
      // Immediately sync state so instruments update
      const synced = trackedFlightsRef.current.map(f => {
        const live = activePlanes.get(f.hex);
        return live ? live.flightData : f;
      });
      trackedFlightsRef.current = synced;
      setTrackedFlights([...synced]);
    }, 5000);

    // Dynamic Animation Loop with Plane Interpolation
    let lastTrackedSync = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      rotationGroup.rotation.y += 0.0001; // Gentle earth rotation

      const now = Date.now();

      // Dynamic Horizon Culling variables
      const camPosDir = camera.position.clone().normalize();
      const r_earth = globeRadius;
      const r_cam = camera.position.length();
      // Calculate the cosine of the angle to the visible horizon
      const horizonCos = r_earth / r_cam;
      // Add a generous 0.15 buffer so planes don't pop instantly at the edge
      const cullThreshold = horizonCos - 0.15;

      // Interpolate every active plane smoothly between polling ticks
      activePlanes.forEach((data) => {
        if (!data.hasTwoPoints || !data.startPos || !data.targetPos) return;

        const elapsed = now - data.startTime;
        // Allow up to 20% extrapolation (progress 1.2) so planes keep moving if API is slow
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1.2);

        // Efficient Spherical Interpolation: linear lerp then re-project to sphere surface
        data.mesh.position.lerpVectors(data.startPos, data.targetPos, progress);

        // Interpolate altitude radius
        const startRad = data.startPos.length();
        const targetRad = data.targetPos.length();
        const currentRadius = startRad + (targetRad - startRad) * progress;

        data.mesh.position.normalize().multiplyScalar(currentRadius);

        // Smoothly interpolate track to avoid snapping
        let diff = data.targetTrack - data.startTrack;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const currentTrack = data.startTrack + diff * progress;

        // Continuously orient the plane as it curves around the sphere
        orientPlane(data.mesh, data.mesh.position, currentTrack);

        // Horizon Culling: Convert local position to world space for accurate dot product
        const planeWorldPos = new THREE.Vector3();
        data.mesh.getWorldPosition(planeWorldPos);
        const planeDir = planeWorldPos.normalize();

        if (planeDir.dot(camPosDir) < cullThreshold) {
          data.mesh.visible = false;
        } else {
          data.mesh.visible = true;
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
        if (!planeData || !planeData.mesh) continue;
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
      // This keeps instruments fresh without hammering React with 60fps re-renders
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
    };
    animate();

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
        for (const [_, data] of activePlanes.entries()) {
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
      flightsGroupRef.current.visible = showTraffic;
    }
    // Also clear tracking grid if traffic turned off
    if (!showTraffic) {
      trackedFlightsRef.current = [];
      setTrackedFlights([]);
      trackedPositionsRef.current.clear();
    }
  }, [showTraffic]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Emergency alert banner — bottom centre, always on top */}
      <EmergencyAlertBanner flights={emergencyFlights} />

      {/* 2×2 multi-plane tracking grid + SVG tracking lines */}
      {showTraffic && (
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
          onClick={() => setShowTraffic(!showTraffic)}
          style={{
            background: showTraffic ? 'rgba(207, 20, 43, 0.2)' : 'rgba(0, 0, 0, 0.5)',
            border: `1px solid ${showTraffic ? 'var(--rose-red)' : 'rgba(255, 255, 255, 0.2)'}`,
            color: showTraffic ? 'var(--rose-red)' : 'rgba(255, 255, 255, 0.5)',
            padding: '10px 20px',
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(4px)',
            boxShadow: showTraffic ? '0 0 15px rgba(207, 20, 43, 0.3)' : 'none'
          }}
        >
          {showTraffic ? 'GLOBAL TRAFFIC: ON' : 'GLOBAL TRAFFIC: OFF'}
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
