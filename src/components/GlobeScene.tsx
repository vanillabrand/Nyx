import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ADSBTelemetryService } from '../services/ADSBTelemetryService';

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
    controls.minDistance = 150;
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
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const fuselageGeom = new THREE.ConeGeometry(0.3, 2, 4);
    fuselageGeom.rotateX(Math.PI / 2); // Nose points to +Z
    const wingsGeom = new THREE.BoxGeometry(2.5, 0.1, 0.8);
    const tailGeom = new THREE.BoxGeometry(0.1, 0.7, 0.4);

    const createPlaneMesh = () => {
      const plane = new THREE.Group();
      
      const fuselage = new THREE.Mesh(fuselageGeom, planeMaterial);
      plane.add(fuselage);
      
      const wings = new THREE.Mesh(wingsGeom, planeMaterial);
      wings.position.set(0, 0, 0.2); 
      plane.add(wings);

      const tail = new THREE.Mesh(tailGeom, planeMaterial);
      tail.position.set(0, 0.35, 0.8);
      plane.add(tail);
      
      // Scale adjusted for a sharp tactical appearance
      plane.scale.set(0.3, 0.3, 0.3);
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

        // Global Uniform Distribution: Shuffle then slice to prevent regional clustering
        if (flights.length > 400) {
          flights = flights.sort(() => Math.random() - 0.5).slice(0, 400);
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
              planeData.startPos.copy(planeData.mesh.position);
              planeData.targetPos.copy(pos);
              planeData.startTime = now;
              planeData.track = flight.track;
              
              orientPlane(planeData.mesh, planeData.mesh.position, flight.track || 0);
            } else {
              const mesh = createPlaneMesh();
              mesh.position.copy(pos);
              orientPlane(mesh, pos, flight.track || 0);
              mesh.frustumCulled = false;
              flightsGroup.add(mesh);
              
              activePlanes.set(flight.hex, {
                mesh,
                startPos: pos.clone(),
                targetPos: pos.clone(),
                startTime: now,
                track: flight.track || 0
              });
            }
          });

          // Garbage Collection: ONLY remove if the API actually gave us a fresh list
          // This prevents the "disappearing planes" effect on 502 errors
          if (apiSuccess) {
            for (const [hex, data] of activePlanes.entries()) {
              if (!currentHexes.has(hex) && !hex.startsWith('SIM')) {
                flightsGroup.remove(data.mesh);
                activePlanes.delete(hex);
              }
            }
          }
        }
      } catch (error) {
        console.error("ADSB telemetry sync critical failure:", error);
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, TRANSITION_DURATION);

    // Dynamic Animation Loop with Plane Interpolation
    const animate = () => {
      requestAnimationFrame(animate);
      rotationGroup.rotation.y += 0.0005; // Gentle earth rotation
      
      const now = Date.now();
      
      // Interpolate every active plane smoothly between polling ticks
      activePlanes.forEach((data) => {
        if (!data.startPos || !data.targetPos) return;
        const elapsed = now - data.startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        data.mesh.position.lerpVectors(data.startPos, data.targetPos, progress);
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Raycaster Interactivity
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      if (flightsGroupRef.current) {
        // Intersect against the planes to allow clicking them
        const intersects = raycaster.intersectObjects(flightsGroupRef.current.children, true);
        if (intersects.length > 0) {
          const target = intersects[0].object;
          if (target.userData && target.userData.hex) {
            onSelectIncident(target.userData);
          }
        }
      }
    };
    window.addEventListener('click', onMouseClick);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); // Run once

  // 2. Hydrate Static Incidents
  useEffect(() => {
    // Left intentionally empty for now.
  }, [incidents]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default React.memo(GlobeScene);
