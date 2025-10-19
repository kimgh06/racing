import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGravityEngineContext } from "./Scene";
import * as THREE from "three";

interface GroundProps {
  size?: number;
  color?: string;
  wireframe?: boolean;
}

export function Ground({
  size = 20,
  color = "#8B4513",
  wireframe = false,
}: GroundProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gravityEngine = useGravityEngineContext();

  // 바닥 오브젝트를 중력 엔진에 등록
  useEffect(() => {
    const groundObject = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1000, // 매우 큰 질량으로 정적 오브젝트처럼 동작
      restitution: 0.1, // 매우 낮은 반발력
      friction: 0.9, // 바닥 마찰력 증가
      onGround: false,
      size: new THREE.Vector3(size, 1, size), // 바닥 높이를 1로 증가
      isStatic: true, // 정적 오브젝트
      type: "ground" as const,
    };

    gravityEngine.addObject("ground", groundObject);

    return () => {
      gravityEngine.removeObject("ground");
    };
  }, [gravityEngine, size]);

  // 바닥에 격자 패턴 추가
  useFrame((state) => {
    if (meshRef.current) {
      // 바닥이 약간 회전하여 시각적 효과 추가
      meshRef.current.rotation.x = -Math.PI / 2;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// 격자 패턴이 있는 바닥
export function GridGround({
  size = 20,
  divisions = 20,
  color = "#8B4513",
  gridColor = "#654321",
}: {
  size?: number;
  divisions?: number;
  color?: string;
  gridColor?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gravityEngine = useGravityEngineContext();

  // 바닥 오브젝트를 중력 엔진에 등록
  useEffect(() => {
    const groundObject = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1000, // 매우 큰 질량으로 정적 오브젝트처럼 동작
      restitution: 0.1, // 매우 낮은 반발력
      friction: 0.9, // 바닥 마찰력 증가
      onGround: false,
      size: new THREE.Vector3(size, 1, size), // 바닥 높이를 1로 증가
      isStatic: true, // 정적 오브젝트
      type: "ground" as const,
    };

    gravityEngine.addObject("ground", groundObject);

    return () => {
      gravityEngine.removeObject("ground");
    };
  }, [gravityEngine, size]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = -Math.PI / 2;
    }
  });

  return (
    <group>
      {/* 바닥면 */}
      <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>

      {/* 격자선 */}
      <gridHelper
        args={[size, divisions, gridColor, gridColor]}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}
