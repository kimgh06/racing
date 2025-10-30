import { useFrame, useThree } from "@react-three/fiber";
import { usePhysicsEngineContext } from "./Scene";
import * as THREE from "three";
import { useState } from "react";

interface ThirdPersonCameraProps {
  targetId: string;
  distance?: number;
  height?: number;
  smoothness?: number;
}

export function ThirdPersonCamera({
  targetId,
  distance = 6,
  height = 2,
  smoothness = 0.15,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const physicsEngine = usePhysicsEngineContext();

  // 카메라 회전 상태 (플레이어 회전에 동기화)
  const [cameraRotation, setCameraRotation] = useState(0);
  const [targetRotation, setTargetRotation] = useState(0);

  useFrame((state, delta) => {
    const target = physicsEngine.getObject(targetId);
    if (!target) return;

    // 타겟의 현재 위치 (플레이어 중심)
    const targetPosition = physicsEngine.getPosition(targetId);
    targetPosition.y += height; // 카메라 높이 조정

    // 플레이어의 회전 정보를 가져오기 (마우스 입력 사용 안 함)
    if (targetId === "player") {
      const playerState = (window as any).playerState;
      if (playerState) {
        setTargetRotation(playerState.rotation);
      }
    }

    // 카메라 회전을 타겟 회전에 맞춰 부드럽게 업데이트
    setCameraRotation((prev) => {
      const diff = targetRotation - prev;
      return prev + diff * smoothness * 5;
    });

    // 카메라 위치 계산 (플레이어 중심으로 더 잘 보이도록)
    const cameraPosition = new THREE.Vector3();
    const playerPos = physicsEngine.getPosition(targetId);

    // 플레이어 위치를 기준으로 카메라 위치 계산
    cameraPosition.x = playerPos.x + Math.sin(cameraRotation) * distance;
    cameraPosition.y = playerPos.y + height; // 플레이어보다 높게
    cameraPosition.z = playerPos.z + Math.cos(cameraRotation) * distance;

    // 부드러운 카메라 이동
    camera.position.lerp(cameraPosition, smoothness);

    // 카메라가 플레이어를 바라보도록 설정 (플레이어 중심)
    const lookAtPosition = new THREE.Vector3(
      playerPos.x,
      playerPos.y + 0.5,
      playerPos.z
    );
    camera.lookAt(lookAtPosition);
  });

  return null; // 카메라는 렌더링되지 않음
}
