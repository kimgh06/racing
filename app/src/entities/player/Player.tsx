import { useRef, useState } from "react";
import * as THREE from "three";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";
import { useThirdPersonCamera } from "~/src/shared/ui/ThirdPersonCamera";
import { InputQueue, InputProcessor } from "./model";
import { useTimeStore } from "~/src/features/checkpoint-system/timeStore";
import { useGhostStore } from "~/src/features/ghost-system/model/ghostStore";
import { useGhostRecorder } from "~/src/features/ghost-system/model/useGhostRecorder";
import { useVehicleStore } from "~/src/features/vehicle/vehicleStore";
import {
  usePlayerVisualRefs,
  usePlayerInitialization,
  usePlayerInputHandlers,
  usePlayerMovementLoop,
} from "./model/playerHooks";
import { PlayerProps, PlayerState } from "./model/playerTypes";

// The previous inline tuning constants and hook definitions have been moved to
// separate modules (playerConfig.ts and playerHooks.ts) for clarity.

export function Player({
  position = [0, 5, 0],
  mass = 1,
  weight = 70, // 기본 무게 70kg
}: PlayerProps) {
  const physicsEngine = usePhysicsEngineContext();
  const { setStartTime, startLap } = useTimeStore();
  const startRecording = useGhostStore((s) => s.startRecording);
  useGhostRecorder("player");
  const vehicleType = useVehicleStore((s) => s.type);
  const motorType = useVehicleStore((s) => s.motorType);

  const { meshRef, headRef, wheelSpinRefs, frontWheelSteerRefs } =
    usePlayerVisualRefs(vehicleType);

  const [isJumping, setIsJumping] = useState(false);

  useThirdPersonCamera({
    targetId: "player",
    distance: 6,
    height: 2,
    smoothness: 0.15,
  });

  const playerStateRef = useRef<PlayerState>({
    rotation: 0,
    wheelRotation: 0,
    wheelRotationSpeed: 0,
    driveSpeedCurrent: 0,
    steerAngle: 0,
    steerAngleTarget: 0,
    tiltX: 0,
    tiltZ: 0,
    tiltVelocityX: 0,
    tiltVelocityZ: 0,
    headTilt: 0,
    headTiltVelocity: 0,
    centerOfMass: new THREE.Vector3(0, 0.5, 0),
    supportPoint: new THREE.Vector3(0, 0, 0),
    linearVelocity: new THREE.Vector3(),
  });

  const inputQueueRef = useRef<InputQueue>(new InputQueue());
  const inputProcessorRef = useRef<InputProcessor>(new InputProcessor());
  const lastUpdateRef = useRef(0);

  const { resetPlayer } = usePlayerInitialization({
    position,
    mass,
    weight,
    physicsEngine,
    meshRef,
    playerStateRef,
    setIsJumping,
    inputQueueRef,
    inputProcessorRef,
    setStartTime,
    startLap,
    startRecording,
  });

  usePlayerInputHandlers(resetPlayer, inputQueueRef);

  usePlayerMovementLoop({
    weight,
    vehicleType,
    motorType,
    physicsEngine,
    isJumping,
    setIsJumping,
    meshRef,
    headRef,
    wheelSpinRefs,
    frontWheelSteerRefs,
    inputQueueRef,
    playerStateRef,
    lastUpdateRef,
  });

  return (
    <mesh ref={meshRef} position={position}>
      {/* 공용 보디(보이지 않는 콜라이더 표현용 박스) */}
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#000000" opacity={0.0} transparent />

      {/* 차량 타입별 비주얼 */}
      {vehicleType === "car" && (
        <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.4, 0.4, 2.2]} />
            <meshStandardMaterial color="#2d3748" />
          </mesh>
          {/* 바퀴 4개 */}
          {[
            [-0.6, -0.2, -0.9], // 왼쪽 앞
            [0.6, -0.2, -0.9], // 오른쪽 앞
            [-0.6, -0.2, 0.9], // 왼쪽 뒤
            [0.6, -0.2, 0.9], // 오른쪽 뒤
          ].map((p, i) => {
            const isFrontWheel = i < 2;
            return (
              <group
                key={i}
                ref={(el) => {
                  if (isFrontWheel) {
                    frontWheelSteerRefs.current[i] = el;
                  }
                }}
                position={p as [number, number, number]}
              >
                <mesh
                  ref={(el) => {
                    wheelSpinRefs.current[i] = el;
                  }}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.28, 0.28, 0.2, 16]} />
                  <meshStandardMaterial color="#111111" />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {vehicleType === "bike" && (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.3, 0.2, 1.2]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {/* 앞뒤 바퀴 */}
          {[
            [0, -0.1, -0.6], // 앞 바퀴
            [0, -0.1, 0.6], // 뒤 바퀴
          ].map((p, i) => {
            const isFrontWheel = i === 0;
            return (
              <group
                key={i}
                ref={(el) => {
                  if (isFrontWheel) {
                    frontWheelSteerRefs.current[i] = el;
                  }
                }}
                position={p as [number, number, number]}
              >
                <mesh
                  ref={(el) => {
                    wheelSpinRefs.current[i] = el;
                  }}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {vehicleType === "mono" && (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <group
            ref={(el) => {
              frontWheelSteerRefs.current[0] = el;
            }}
            position={[0, -0.1, 0]}
          >
            <mesh
              ref={(el) => {
                wheelSpinRefs.current[0] = el;
              }}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.35, 0.35, 0.12, 16]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        </group>
      )}

      {/* 머리 - 모든 차량 타입 위에 표시 */}
      <group ref={headRef}>
        {/* 머리 높이를 차량 타입에 따라 조정 */}
        <group
          position={[
            0,
            vehicleType === "car" ? 0.7 : vehicleType === "bike" ? 0.8 : 0.5,
            0,
          ]}
        >
          {/* 머리 본체 */}
          <mesh>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          {/* 눈 */}
          <mesh position={[0.1, 0.05, 0.2]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[-0.1, 0.05, 0.2]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      </group>
    </mesh>
  );
}
