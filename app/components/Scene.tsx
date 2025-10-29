import { Suspense, createContext, useContext } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { usePhysicsEngine } from "~/physicsEngine";
import { Player } from "./Player";
import { CakeGround } from "./CakeGround";
import { ThirdPersonCamera } from "./ThirdPersonCamera";

// 물리 엔진 컨텍스트 생성
const PhysicsEngineContext = createContext<ReturnType<
  typeof usePhysicsEngine
> | null>(null);

// 물리 엔진 프로바이더 컴포넌트
function PhysicsEngineProvider({ children }: { children: React.ReactNode }) {
  const physicsEngine = usePhysicsEngine({
    gravity: 12,
    mapBounds: {
      minX: -100,
      maxX: 100,
      minZ: -100,
      maxZ: 100,
      fallHeight: -50,
    },
  });

  return (
    <PhysicsEngineContext.Provider value={physicsEngine}>
      {children}
    </PhysicsEngineContext.Provider>
  );
}

// 물리 엔진 훅
export function usePhysicsEngineContext() {
  const context = useContext(PhysicsEngineContext);
  if (!context) {
    throw new Error(
      "usePhysicsEngineContext must be used within a PhysicsEngineProvider"
    );
  }
  return context;
}

// 메인 씬 컴포넌트
function Scene() {
  return (
    <div
      className="w-full h-screen"
      style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}
    >
      <Canvas
        camera={{
          position: [0, 5, 10],
          fov: 75,
        }}
        shadows
        style={{ width: "100vw", height: "100vh" }}
      >
        {/* 조명 설정 */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        {/* 환경 설정 */}
        <Environment preset="sunset" />

        {/* 물리 엔진 프로바이더 */}
        <PhysicsEngineProvider>
          {/* 3인칭 카메라 */}
          <ThirdPersonCamera targetId="player" distance={6} height={2} />

          {/* 바닥 */}
          <CakeGround />

          {/* 플레이어 */}
          <Suspense fallback={null}>
            <Player position={[0, 10, 0]} weight={80} />
          </Suspense>
        </PhysicsEngineProvider>

        {/* 궤도 컨트롤 (디버그용) */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
        />
      </Canvas>

      {/* 조작 안내 */}
      <div className="absolute top-6 left-6 bg-black bg-opacity-70 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-bold mb-3">🎮 한손 조작법</h3>
        <div className="space-y-2 text-lg">
          <div>⬆️ I: 전진</div>
          <div>⬇️ K: 후진</div>
          <div>⬅️ J: 좌회전</div>
          <div>➡️ L: 우회전</div>
          <div>🚀 Space: 점프</div>
          <div>🖱️ 마우스 드래그: 카메라 회전</div>
          <div>🔍 휠: 줌 인/아웃</div>
        </div>
        <div className="mt-4 text-sm text-gray-300">
          <div>⚖️ 무게: 80kg (접지력과 비례)</div>
          <div>🔬 물리 엔진: RapierJS</div>
          <div>🎯 기울기 물리: 현실적 무게 중심 기반</div>
        </div>
      </div>
    </div>
  );
}

export default Scene;
