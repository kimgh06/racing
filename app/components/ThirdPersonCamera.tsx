import { useFrame, useThree } from "@react-three/fiber";
import { useGravityEngineContext } from "./Scene";
import * as THREE from "three";
import { useState, useEffect } from "react";

interface ThirdPersonCameraProps {
  targetId: string;
  distance?: number;
  height?: number;
  smoothness?: number;
}

export function ThirdPersonCamera({
  targetId,
  distance = 5,
  height = 3,
  smoothness = 0.1,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const gravityEngine = useGravityEngineContext();

  // 카메라 회전 상태
  const [cameraRotation, setCameraRotation] = useState(0);
  const [targetRotation, setTargetRotation] = useState(0);

  useFrame((state, delta) => {
    const target = gravityEngine.getObject(targetId);
    if (!target) return;

    // 타겟의 현재 위치
    const targetPosition = target.position.clone();
    targetPosition.y += height; // 카메라 높이 조정

    // 플레이어의 회전 정보를 가져오기
    if (targetId === "player") {
      const playerRotation = (window as any).playerRotation || 0;
      setTargetRotation(playerRotation);
    }

    // 카메라 회전을 타겟 회전에 맞춰 부드럽게 업데이트
    setCameraRotation((prev) => {
      const diff = targetRotation - prev;
      return prev + diff * smoothness * 5;
    });

    // 카메라 위치 계산 (타겟 뒤쪽, 회전 고려)
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(targetPosition);

    // 회전을 고려한 카메라 위치
    cameraPosition.x += Math.sin(cameraRotation) * distance;
    cameraPosition.z += Math.cos(cameraRotation) * distance;

    // 부드러운 카메라 이동
    camera.position.lerp(cameraPosition, smoothness);

    // 카메라가 타겟을 바라보도록 설정
    camera.lookAt(targetPosition);
  });

  return null; // 카메라는 렌더링되지 않음
}
