import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { usePhysicsEngineContext } from "./Scene";
import * as THREE from "three";

interface StartFinishLineProps {
  center: [number, number, number]; // x, y, z of center
  rotation?: [number, number, number];
  width: number; // along track width (across driving direction)
  length?: number; // small thickness along driving direction
  color?: string;
}

export function StartFinishLine({
  center,
  rotation = [-Math.PI / 2, 0, 0],
  width,
  length = 0.6,
  color = "#ffffff",
}: StartFinishLineProps) {
  const physics = usePhysicsEngineContext();
  const meshRef = useRef<THREE.Mesh>(null);
  const bboxHalf = useRef({ halfX: length / 2, halfZ: width / 2 });

  useEffect(() => {
    // static thin ground so player stands on it if needed
    const timer = setTimeout(() => {
      const pos = new THREE.Vector3(center[0], center[1], center[2]);
      const size = new THREE.Vector3(length, 0.05, width);
      const line = physics.createStaticGround("start_finish_line", pos, size);
      if (line && meshRef.current) line.mesh = meshRef.current;
      bboxHalf.current = { halfX: length / 2, halfZ: width / 2 };
    }, 50);

    return () => {
      physics.removeObject("start_finish_line");
      clearTimeout(timer);
    };
  }, [center[0], center[1], center[2], width, length]);

  // simple overlap detection to set respawn point at line center
  useFrame(() => {
    const player = physics.getObject("player");
    if (!player) return;
    const p = physics.getPosition("player");

    const dx = Math.abs(p.x - center[0]);
    const dz = Math.abs(p.z - center[2]);
    if (
      dx <= bboxHalf.current.halfX + 0.4 &&
      dz <= bboxHalf.current.halfZ + 0.4
    ) {
      (window as any).respawnPosition = new THREE.Vector3(
        center[0],
        center[1] + 1.5,
        center[2]
      );
      // Track forward at the start line is along +Z → heading = Math.PI
      (window as any).respawnRotation = Math.PI;
      // Also roll with the ground
      (window as any).respawnRoll = Array.isArray(rotation)
        ? rotation[2] ?? 0
        : 0;
    }
  });

  return (
    <mesh ref={meshRef} position={center} rotation={rotation}>
      <planeGeometry args={[width, length]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}
