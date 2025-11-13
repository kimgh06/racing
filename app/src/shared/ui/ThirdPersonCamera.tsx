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
 * 카트 뒤를 따라다니는 단순한 카메라입니다.
 */
export function useThirdPersonCamera({
  targetId,
  distance = 6,
  height = 2,
  smoothness = 0.15,
}: UseThirdPersonCameraProps) {
  const { camera } = useThree();
  const physicsEngine = usePhysicsEngineContext();

  // Vector3 객체 재사용 (매 프레임 생성 방지)
  const cameraPositionRef = useRef(new THREE.Vector3());
  const lookAtPositionRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const target = physicsEngine.getObject(targetId);
    if (!target) return;

    // 플레이어의 현재 위치
    const playerPos = physicsEngine.getPosition(targetId);

    // 플레이어의 회전 정보 가져오기
    let playerRotation = 0;
    if (targetId === "player") {
      const playerState = useCheckPointStore.getState().playerState;
      if (playerState && playerState.rotation !== undefined) {
        playerRotation = playerState.rotation;
      }
    }

    // 카트의 앞쪽 방향 계산 (카트가 보는 방향)
    const forwardX = -Math.sin(playerRotation);
    const forwardZ = -Math.cos(playerRotation);

    // 카트 뒤쪽 위치 계산 (앞쪽 방향의 반대, 즉 -forward)
    cameraPositionRef.current.set(
      playerPos.x - forwardX * distance, // 뒤쪽
      playerPos.y + height,
      playerPos.z - forwardZ * distance // 뒤쪽
    );

    // 부드러운 카메라 이동
    camera.position.lerp(cameraPositionRef.current, smoothness);

    // 카메라가 플레이어를 바라보도록 설정
    lookAtPositionRef.current.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
    camera.lookAt(lookAtPositionRef.current);
  });
}
