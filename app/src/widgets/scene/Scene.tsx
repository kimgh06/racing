import { Suspense, createContext, useContext, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Stats } from "@react-three/drei";
import { usePhysicsEngine } from "~/src/shared/lib/physics/physicsEngine";
import { Player } from "~/src/entities/player/Player";
import { RacingTrack } from "~/src/shared/ui/RacingTrack";
import { Checkpoint } from "~/src/entities/checkpoint/Checkpoint";
import { GroundPlane } from "~/src/shared/ui/GroundPlane";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import Panel from "~/src/widgets/panel/Panel";
import { Ghost } from "~/src/features/ghost-system/ui/Ghost";

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
  // 트랙 파라미터와 일관되게 시작점 계산
  const startCenter: [number, number, number] = [22 + 6 / 2, 0.01, 0];
  const cp2: [number, number, number] = [0, 0.01, 15];
  const cp3: [number, number, number] = [-25, 0.01, 0];
  const cpEnd: [number, number, number] = [0, 0.01, -15];

  return (
    <div
      className="w-full h-screen relative"
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
          {/* 바닥 평면 */}
          <GroundPlane />

          {/* 레이싱 트랙 */}
          <RacingTrack />

          {/* 체크포인트 (start → 2 → 3 → end) */}
          <Checkpoint
            index={0}
            center={startCenter}
            width={6}
            nextCenter={cp2}
            start={true}
            end={true}
          />
          <Checkpoint
            index={1}
            center={cp2}
            width={6}
            rotationZ={-Math.PI / 2}
            nextCenter={cp3}
          />
          <Checkpoint
            index={2}
            center={cp3}
            width={6}
            rotationZ={-Math.PI}
            nextCenter={cpEnd}
          />
          <Checkpoint
            index={3}
            center={cpEnd}
            width={6}
            rotationZ={Math.PI / 2}
            nextCenter={startCenter}
          />

          {/* 플레이어 - 트랙 위 적절한 시작 위치 */}
          <Suspense fallback={null}>
            <Player position={[28, 2, 0]} weight={80} />
          </Suspense>
        </PhysicsEngineProvider>

        {/* Ghost playback */}
        <Ghost />
        {/* FPS Overlay */}
        <Stats />
      </Canvas>
      <Panel />
    </div>
  );
}

export default Scene;
