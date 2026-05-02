import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface GlobeSceneProps {
  incidents: any[];
  onSelectIncident: (incident: any) => void;
}

const GlobeScene: React.FC<GlobeSceneProps> = ({ incidents, onSelectIncident }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
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

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 3, 5);
    scene.add(mainLight);

    // --- Globe ---
    const globeRadius = 100;
    const geometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/textures/earth_dark.png');
    
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 2,
      specular: new THREE.Color(0x111111),
      color: 0x222222, // Darken the overall texture
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // --- Atmosphere Glow ---
    const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.01, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xcf142b,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // --- Incident Markers & Arcs ---
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);

    const createArc = (start: THREE.Vector3, end: THREE.Vector3) => {
      const mid = start.clone().lerp(end, 0.5);
      const distance = start.distanceTo(end);
      mid.normalize().multiplyScalar(globeRadius + distance * 0.4);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(50);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: 0xcf142b, 
        transparent: true, 
        opacity: 0.6 
      });
      return new THREE.Line(geometry, material);
    };

    const latLonToVector3 = (lat: number, lon: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    };

    // Placeholder markers if no incidents provided yet
    const dummyPoints = [
      { lat: 40.7128, lon: -74.0060, name: "NYC", source_id: "CR-5389793" },
      { lat: 51.5074, lon: -0.1278, name: "London", source_id: "AC-5362bc2" },
      { lat: 35.6762, lon: 139.6503, name: "Tokyo", source_id: "NW-536954b" },
      { lat: -33.8688, lon: 151.2093, name: "Sydney", source_id: "ALPHA-001" }
    ];

    dummyPoints.forEach((pt, i) => {
      const pos = latLonToVector3(pt.lat, pt.lon, globeRadius);
      const markerGeom = new THREE.SphereGeometry(1.5, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xcf142b });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.copy(pos);
      marker.userData = pt;
      markersGroup.add(marker);

      // Create arcs between sequential points for effect
      if (i > 0) {
        const prevPos = latLonToVector3(dummyPoints[i-1].lat, dummyPoints[i-1].lon, globeRadius);
        scene.add(createArc(prevPos, pos));
      }
    });

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.001;
      glow.rotation.y += 0.001;
      markersGroup.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Interactivity ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersGroup.children);

      if (intersects.length > 0) {
        const target = intersects[0].object;
        onSelectIncident(target.userData);
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
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [incidents]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default GlobeScene;
