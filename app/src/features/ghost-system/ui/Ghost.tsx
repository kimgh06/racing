import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGhostStore } from "../model/ghostStore";

export function Ghost() {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPlaying = useGhostStore((s) => s.isPlaying);
  const getPlayhead = useGhostStore((s) => s.getPlayhead);
  const lastRecording = useGhostStore((s) => s.lastRecording);

  const positions = useMemo(
    () => lastRecording?.positions ?? [],
    [lastRecording]
  );

  useFrame(() => {
    if (!meshRef.current || positions.length === 0) return;
    const elapsed = getPlayhead();

    // Find current segment via linear scan (positions are short; can optimize later)
    let i = 0;
    while (i + 1 < positions.length && positions[i + 1].t <= elapsed) i++;

    const a = positions[i];
    const b = positions[Math.min(i + 1, positions.length - 1)];

    if (b.t === a.t) {
      const [x, y, z] = a.position;
      meshRef.current.position.set(x, y, z);
    } else {
      const f = Math.max(0, Math.min(1, (elapsed - a.t) / (b.t - a.t)));
      const x = a.position[0] + (b.position[0] - a.position[0]) * f;
      const y = a.position[1] + (b.position[1] - a.position[1]) * f;
      const z = a.position[2] + (b.position[2] - a.position[2]) * f;
      meshRef.current.position.set(x, y, z);
    }
  });

  if (!lastRecording) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshBasicMaterial color="#ff00aa" transparent opacity={0.6} />
    </mesh>
  );
}
