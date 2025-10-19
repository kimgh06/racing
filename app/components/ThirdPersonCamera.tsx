import { useFrame, useThree } from "@react-three/fiber";
import { useGravityEngineContext } from "./Scene";
import * as THREE from "three";

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

  useFrame(() => {
    const target = gravityEngine.getObject(targetId);
    if (!target) return;

    // 타겟의 현재 위치
    const targetPosition = target.position.clone();
    targetPosition.y += height; // 카메라 높이 조정

    // 카메라가 있어야 할 위치 계산
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(targetPosition);
    cameraPosition.z += distance; // 뒤쪽으로 거리만큼 이동

    // 부드러운 카메라 이동
    camera.position.lerp(cameraPosition, smoothness);

    // 카메라가 타겟을 바라보도록 설정
    camera.lookAt(targetPosition);
  });

  return null; // 카메라는 렌더링되지 않음
}
