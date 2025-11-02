import { useFrame, useThree } from "@react-three/fiber";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import * as THREE from "three";
import { useRef } from "react";

interface UseThirdPersonCameraProps {
  targetId: string;
  distance?: number;
  height?: number;
  smoothness?: number;
}

/**
 * 3인칭 카메라 훅
 * 플레이어를 따라다니는 카메라를 제어합니다.
 */
export function useThirdPersonCamera({
  targetId,
  distance = 6,
  height = 2,
  smoothness = 0.15,
}: UseThirdPersonCameraProps) {
  const { camera } = useThree();
  const physicsEngine = usePhysicsEngineContext();

  // 카메라 회전 상태 (플레이어 회전에 동기화)
  const cameraRotationRef = useRef(0);
  const targetRotationRef = useRef(0);

  // Vector3 객체 재사용 (매 프레임 생성 방지)
  const cameraPositionRef = useRef(new THREE.Vector3());
  const lookAtPositionRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const target = physicsEngine.getObject(targetId);
    if (!target) return;

    // 플레이어의 현재 위치
    const playerPos = physicsEngine.getPosition(targetId);

    // 플레이어의 회전 정보를 가져오기 (즉각 반영)
    if (targetId === "player") {
      const playerState = useCheckPointStore.getState().playerState;
      if (playerState && playerState.rotation !== undefined) {
        targetRotationRef.current = playerState.rotation;
      }
    }

    // 카메라 회전을 타겟 회전에 맞춰 부드럽게 업데이트
    const diff = targetRotationRef.current - cameraRotationRef.current;
    // 각도 차이를 -π ~ π 범위로 정규화 (최단 경로로 회전)
    let angleDiff = diff;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    cameraRotationRef.current += angleDiff * smoothness * 5;

    // 플레이어 위치를 기준으로 카메라 위치 계산 (재사용 객체 사용)
    cameraPositionRef.current.set(
      playerPos.x + Math.sin(cameraRotationRef.current) * distance,
      playerPos.y + height, // 플레이어보다 높게
      playerPos.z + Math.cos(cameraRotationRef.current) * distance
    );

    // 부드러운 카메라 이동
    camera.position.lerp(cameraPositionRef.current, smoothness);

    // 카메라가 플레이어를 바라보도록 설정 (플레이어 중심)
    lookAtPositionRef.current.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
    camera.lookAt(lookAtPositionRef.current);
  });
}
