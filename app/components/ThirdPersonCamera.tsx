import { useFrame, useThree } from "@react-three/fiber";
import { usePhysicsEngineContext } from "./Scene";
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
  distance = 6,
  height = 2,
  smoothness = 0.15,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const physicsEngine = usePhysicsEngineContext();

  // 카메라 회전 상태
  const [cameraRotation, setCameraRotation] = useState(0);
  const [targetRotation, setTargetRotation] = useState(0);

  // 마우스 입력 상태
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);

  // 마우스 이벤트 리스너
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        // 왼쪽 마우스 버튼
        setIsMouseDown(true);
        setLastMouseX(event.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMouseDown) {
        const deltaX = event.clientX - lastMouseX;
        const rotationSpeed = 0.01;
        setTargetRotation((prev) => prev + deltaX * rotationSpeed);
        setLastMouseX(event.clientX);
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isMouseDown, lastMouseX]);

  useFrame((state, delta) => {
    const target = physicsEngine.getObject(targetId);
    if (!target) return;

    // 타겟의 현재 위치 (플레이어 중심)
    const targetPosition = physicsEngine.getPosition(targetId);
    targetPosition.y += height; // 카메라 높이 조정

    // 플레이어의 회전 정보를 가져오기
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
