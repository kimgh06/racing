import { useEffect, useRef } from "react";
import { usePhysicsEngineContext } from "./Scene";
import * as THREE from "three";

interface GroundPlaneProps {
  size?: [number, number, number]; // width, height, depth
  y?: number; // center Y
  color?: string;
}

export function GroundPlane({
  size = [400, 2, 400],
  y = -2,
  color = "#808080",
}: GroundPlaneProps) {
  const physics = usePhysicsEngineContext();
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const pos = new THREE.Vector3(0, y, 0);
      const sz = new THREE.Vector3(...size);
      const ground = physics.createStaticGround("ground_base", pos, sz);
      if (ground && meshRef.current) ground.mesh = meshRef.current;
    }, 50);

    return () => {
      physics.removeObject("ground_base");
      clearTimeout(timer);
    };
  }, [y, size[0], size[1], size[2]]);

  return (
    <mesh ref={meshRef} position={[0, y, 0]} receiveShadow>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
