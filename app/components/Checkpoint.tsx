import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePhysicsEngineContext } from "./Scene";
import { useCheckPointStore } from "~/store/checkpointStore";

interface CheckpointProps {
  index: number; // 1..N
  center: [number, number, number];
  width: number; // across track
  length?: number; // along track
  color?: string;
  rotationZ?: number; // 커스텀 가능한 Z축 회전만 노출
  nextCenter?: [number, number, number]; // 유지(화살표는 더 이상 참조하지 않음)
  start?: boolean; // 랩 시작 지점 여부
  end?: boolean; // 랩 종료 지점 여부 (통과 시 랩 증가)
}

export function Checkpoint({
  index,
  center,
  width,
  length = 3,
  color = "#00d1b2",
  rotationZ = 0,
  nextCenter,
  start = false,
  end = false,
}: CheckpointProps) {
  const physics = usePhysicsEngineContext();
  const planeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tileMatRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const checkpointId = useRef(`checkpoint-${index}`);
  const checkpointObjectRef = useRef<any>(null);

  // Color 객체 재사용 (매 프레임 생성 방지)
  const activeColorRef = useRef(new THREE.Color(color));
  const inactiveColorRef = useRef(new THREE.Color("#ffffff"));
  const lastActiveStateRef = useRef(false);

  // 액션 함수들은 변하지 않으므로 한 번만 구독
  const setCheckpoints = useCheckPointStore((state) => state.setCheckpoints);
  const setCpInside = useCheckPointStore((state) => state.setCpInside);
  const setStartIndex = useCheckPointStore((state) => state.setStartIndex);
  const setRespawnPosition = useCheckPointStore(
    (state) => state.setRespawnPosition
  );
  const setRespawnRotation = useCheckPointStore(
    (state) => state.setRespawnRotation
  );
  const setRespawnRoll = useCheckPointStore((state) => state.setRespawnRoll);

  // useFrame 내에서만 필요한 값들은 getState()로 읽기 (매 프레임 최적화)

  useEffect(() => {
    // 동적으로 총 개수 갱신 (가장 큰 인덱스)
    const currentTotal = useCheckPointStore.getState().checkpoints.total;
    if (index > currentTotal) {
      setCheckpoints({ total: index });
    }

    // RapierJS 센서 타입 충돌체 생성 (물리 반응 없음, 충돌 감지만)
    const timer = setTimeout(() => {
      const checkpointObj = physics.createSensorCheckpoint(
        checkpointId.current,
        new THREE.Vector3(center[0], center[1] + 0.01, center[2]), // 약간 위에 배치
        new THREE.Vector3(length, 0.5, width), // 높이는 작게 설정
        rotationZ
      );
      checkpointObjectRef.current = checkpointObj;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (checkpointObjectRef.current) {
        physics.removeObject(checkpointId.current);
      }
    };
  }, [index, center, length, width, rotationZ, physics]);

  useFrame(() => {
    const player = physics.getObject("player");
    if (!player || !checkpointObjectRef.current) return;

    // RapierJS 충돌 감지 사용
    const inside = physics.hasContact("player", checkpointId.current);

    // useFrame 내에서는 getState() 사용 (리렌더링 방지)
    const state = useCheckPointStore.getState();
    const total: number = state.checkpoints.total || index;
    const last: number = state.checkpoints.last;
    const nextIndex = (last % total) + 1;
    const isActive = nextIndex === index;

    // 색상이 변경된 경우에만 업데이트 (불필요한 업데이트 방지)
    if (isActive !== lastActiveStateRef.current) {
      lastActiveStateRef.current = isActive;
      const targetColor = isActive
        ? activeColorRef.current
        : inactiveColorRef.current;
      const targetOpacity = isActive ? 0.65 : 0.35;

      if (planeMatRef.current) {
        planeMatRef.current.color.copy(targetColor);
        planeMatRef.current.opacity = targetOpacity;
        planeMatRef.current.needsUpdate = true;
      }

      const tileOpacity = isActive ? 0.9 : 0.7;
      tileMatRefs.current.forEach((m) => {
        if (!m) return;
        m.color.copy(targetColor);
        m.opacity = tileOpacity;
        m.needsUpdate = true;
      });
    }

    const wasInside = !!state.cpInside[index];
    if (inside && !wasInside) {
      // 체크포인트 등록 조건:
      // 1. 일반적인 경우: last === index - 1 (이전 체크포인트를 통과했는지 확인)
      // 2. 랩이 끝나고 첫 번째 체크포인트로 돌아오는 경우: index === 1 && last === total
      const isValidSequence =
        state.checkpoints.last === index - 1 ||
        (index === 1 && state.checkpoints.last === total);

      if (isValidSequence) {
        setCheckpoints({ last: index });
        setRespawnPosition(
          new THREE.Vector3(center[0], center[1] + 1.5, center[2])
        );
        setRespawnRotation(rotationZ);
        setRespawnRoll(rotationZ);
        if (end && last !== 0) {
          setCheckpoints({
            laps: (state.checkpoints.laps || 0) + 1,
            last: 0,
          });
        }
        if (start) {
          setStartIndex(index);
        }
      }
      setCpInside(index, true);
    } else if (!inside && wasInside) {
      setCpInside(index, false);
    }
  });

  // >>> 타일(체브론) 구성: 오직 rotationZ만 참조 (뱅크), 진행 Yaw는 리셋 방향 사용
  const chevronCount = 3;
  const tilesPerChevron = 2;
  const tileLength = 0.6;
  const tileWidth = 0.22;
  const chevronSpacing = 0.7;
  const chevronAngle = (35 * Math.PI) / 180;

  const chevrons = Array.from({ length: chevronCount }).map((_, i) => {
    const baseZ = 0.5 + i * chevronSpacing;
    return [
      { pos: new THREE.Vector3(-0.24, 0.03, baseZ), rotY: -chevronAngle },
      { pos: new THREE.Vector3(0.24, 0.03, baseZ), rotY: chevronAngle },
    ];
  });

  return (
    <group position={center}>
      {/* 바닥 평면: X축 -PI/2 + Z축 rotationZ */}
      <group rotation={[-Math.PI / 2, 0, rotationZ]}>
        <mesh>
          <boxGeometry args={[width, length, 0.5]} />
          <meshBasicMaterial
            ref={planeMatRef}
            color="#ffffff"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* >>> 타일도 동일하게 Z축만 적용 */}
      <group rotation={[0, rotationZ, 0]}>
        {chevrons.map((pair, idx) => (
          <group key={idx}>
            {pair.map((t, k) => (
              <mesh
                key={k}
                position={[t.pos.x, t.pos.y + 0.5, t.pos.z]}
                rotation={[0, t.rotY, 0]}
              >
                <planeGeometry args={[tileLength, tileWidth]} />
                <meshBasicMaterial
                  ref={(m) => {
                    if (m) tileMatRefs.current[idx * tilesPerChevron + k] = m;
                  }}
                  color="#ffffff"
                  transparent
                  opacity={0.7}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
