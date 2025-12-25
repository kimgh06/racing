import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useRef, useMemo } from "react";
import { Box } from "@react-three/drei";
import { MeshStandardMaterial, DoubleSide } from "three";

export type SavePointData = {
  // R 키로 리셋할 때 사용할 월드 좌표
  position: [number, number, number];
  // R 키로 리셋할 때 사용할 Y축 회전 (라디안)
  rotationY: number;
};

type SavePointProps = {
  position: [number, number, number];
  size?: [number, number, number]; // [width, height, depth]
  onSave?: (data: SavePointData) => void;
  visible?: boolean; // 시각적으로 보일지 여부
  color?: string; // 색상
  // R 키로 리셋될 때 적용할 위치/방향 (미리 설정된 값)
  resetPosition?: [number, number, number];
  resetRotationY?: number;
};

/**
 * 세이브 포인트 컴포넌트
 * 차량이 지나가면 \"미리 설정한\" 위치/방향을 onSave로 알려줍니다.
 */
export default function SavePoint({
  position = [0, 0, 0],
  size = [2, 2, 2],
  onSave,
  visible = true,
  color = "#00ff00",
  resetPosition,
  resetRotationY = 0, // 기본 방향: 월드 Z-축 기준
}: SavePointProps) {
  const hasTriggered = useRef(false);
  const triggerCooldown = useRef(0);

  // Material 메모이제이션
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        transparent: true,
        opacity: visible ? 0.3 : 0,
        side: DoubleSide,
      }),
    [color, visible]
  );

  return (
    <RigidBody
      type="fixed"
      position={position}
      sensor // 센서 모드: 물리 충돌 없이 감지만
      onIntersectionEnter={(event) => {
        // 쿨다운 중이면 무시
        if (hasTriggered.current || triggerCooldown.current > 0) {
          return;
        }

        // 차량인지 확인 (동적 RigidBody만)
        const otherBody = event.other.rigidBody;
        if (!otherBody || otherBody.isFixed()) {
          return;
        }

        // 차량의 현재 상태가 아니라, \"미리 설정한\" 위치/방향을 사용
        const finalPosition = resetPosition ?? position;
        const saveData: SavePointData = {
          position: finalPosition,
          rotationY: resetRotationY,
        };

        // 콜백 호출
        if (onSave) {
          onSave(saveData);
        }

        // 트리거 쿨다운 설정 (1초)
        hasTriggered.current = true;
        triggerCooldown.current = 1.0;

        // 쿨다운 타이머 (1초 후 리셋)
        setTimeout(() => {
          hasTriggered.current = false;
          triggerCooldown.current = 0;
        }, 1000);
      }}
    >
      <CuboidCollider args={size} />
      {visible && <Box args={size} material={material} />}
    </RigidBody>
  );
}

