import { Suspense, createContext, useContext, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Stats } from "@react-three/drei";
import { Player } from "./Player";
import { Ground, GridGround } from "./Ground";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { useGravityEngine, GravityObject } from "~/gravityEngine";
import * as THREE from "three";

// 중력 엔진 컨텍스트 생성
const GravityEngineContext = createContext<ReturnType<
  typeof useGravityEngine
> | null>(null);

// 중력 엔진 프로바이더 컴포넌트
function GravityEngineProvider({ children }: { children: React.ReactNode }) {
  const gravityEngine = useGravityEngine({
    gravity: 9.8,
    groundY: 0,
    airResistance: 0.01,
    bounceThreshold: 0.01, // 매우 민감한 반발 임계값
    frictionMultiplier: 2, // 마찰 배수 증가
  });

  return (
    <GravityEngineContext.Provider value={gravityEngine}>
      {children}
    </GravityEngineContext.Provider>
  );
}

// 중력 엔진 훅
export function useGravityEngineContext() {
  const context = useContext(GravityEngineContext);
  if (!context) {
    throw new Error(
      "useGravityEngineContext must be used within GravityEngineProvider"
    );
  }
  return context;
}

// 테스트용 장애물 컴포넌트
function TestObstacle({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gravityEngine = useGravityEngineContext();
  const obstacleId = `obstacle_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    const obstacleObject: GravityObject = {
      position: new THREE.Vector3(...position),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 2, // 플레이어보다 무거움
      restitution: 0.3,
      friction: 0.7, // 장애물 마찰력 증가
      onGround: false,
      size: new THREE.Vector3(...size),
      isStatic: false, // 동적 오브젝트
      type: "obstacle" as const,
    };

    gravityEngine.addObject(obstacleId, obstacleObject);

    return () => {
      gravityEngine.removeObject(obstacleId);
    };
  }, [gravityEngine, obstacleId]);

  useFrame(() => {
    const obstacle = gravityEngine.getObject(obstacleId);
    if (obstacle && meshRef.current) {
      meshRef.current.position.copy(obstacle.position);
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function Scene() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [0, 5, 10],
          fov: 75,
        }}
        shadows
      >
        <GravityEngineProvider>
          {/* 조명 설정 */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />

          {/* 환경 설정 */}
          <Environment preset="sunset" />

          {/* 3인칭 카메라 */}
          <ThirdPersonCamera targetId="player" distance={8} height={4} />

          {/* 바닥 */}
          <GridGround size={30} divisions={30} />

          {/* 플레이어 */}
          <Suspense fallback={null}>
            <Player position={[0, 5, 0]} />
          </Suspense>

          {/* 추가 장식용 오브젝트들 - 충돌 테스트용 */}
          <TestObstacle position={[5, 1, 5]} size={[1, 1, 1]} color="#ff6b6b" />
          <TestObstacle
            position={[-5, 1, -5]}
            size={[1, 1, 1]}
            color="#4ecdc4"
          />
          <TestObstacle position={[0, 1, 8]} size={[1, 1, 1]} color="#45b7d1" />

          {/* 성능 모니터링 */}
          <Stats />
        </GravityEngineProvider>
      </Canvas>

      {/* 조작 안내 */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "white",
          background: "rgba(0,0,0,0.7)",
          padding: "15px",
          borderRadius: "8px",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "#4ecdc4" }}>조작법</h3>
        <div>W/S: 전진/후진 (바닥에서만)</div>
        <div>A/D: 좌회전/우회전 (바퀴처럼)</div>
        <div>스페이스바: 점프 (바닥에 있을 때만)</div>
        <div>마우스: 카메라 회전 (OrbitControls)</div>
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#ccc" }}>
          빨간색: 점프 중 | 청록색: 착지 상태 | 바퀴처럼 회전하며 이동
        </div>
      </div>
    </div>
  );
}
