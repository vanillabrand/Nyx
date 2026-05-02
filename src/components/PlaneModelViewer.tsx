import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const PlaneModelViewer: React.FC<{ themeColor: string }> = ({ themeColor }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(themeColor, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // --- Tactical Plane Model (Procedural) ---
    const planeGroup = new THREE.Group();
    
    const material = new THREE.MeshPhongMaterial({
      color: 0x333333,
      specular: new THREE.Color(themeColor),
      shininess: 100,
      flatShading: true
    });

    // Fuselage
    const fuselageGeom = new THREE.CylinderGeometry(0.5, 0.5, 6, 8);
    fuselageGeom.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeom, material);
    planeGroup.add(fuselage);

    // Wings
    const wingGeom = new THREE.BoxGeometry(6, 0.1, 1.5);
    const wings = new THREE.Mesh(wingGeom, material);
    wings.position.y = -0.1;
    planeGroup.add(wings);

    // Tail Fin
    const tailGeom = new THREE.BoxGeometry(0.1, 1.2, 1.2);
    const tail = new THREE.Mesh(tailGeom, material);
    tail.position.set(0, 0.6, -2.5);
    planeGroup.add(tail);

    scene.add(planeGroup);

    // --- Animation ---
    const animate = () => {
      requestAnimationFrame(animate);
      planeGroup.rotation.y += 0.01;
      planeGroup.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [themeColor]);

  return <div ref={mountRef} style={{ width: '100%', height: '150px' }} />;
};

export default PlaneModelViewer;
