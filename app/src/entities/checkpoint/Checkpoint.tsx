import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import { useTimeStore } from "~/src/features/checkpoint-system/timeStore";
import { useGhostStore } from "~/src/features/ghost-system/model/ghostStore";

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
    // total은 마지막 체크포인트의 index이어야 함 (0부터 시작하면 최대값)
    const currentTotal = useCheckPointStore.getState().checkpoints.total;
    // index가 현재 total보다 크거나 같으면 업데이트 (0부터 시작하므로 >= 사용)
    if (index >= currentTotal) {
      setCheckpoints({ total: index });
    }

    // start 체크포인트가 생성될 때 초기 리스폰 위치 설정 (화면 로드 시)
    if (start) {
      const state = useCheckPointStore.getState();
      // 리스폰 위치가 아직 설정되지 않았거나, last가 0인 경우 (초기 상태)
      if (state.respawnPosition === null || state.checkpoints.last === 0) {
        setRespawnPosition(
          new THREE.Vector3(center[0], center[1] + 3.0, center[2])
        );
        setRespawnRotation(rotationZ);
        setRespawnRoll(rotationZ);
        setStartIndex(index);
      }
    }

    // RapierJS 센서 타입 충돌체 생성 (물리 반응 없음, 충돌 감지만)
    const timer = setTimeout(() => {
      const checkpointObj = physics.createSensorCheckpoint(
        checkpointId.current,
        new THREE.Vector3(center[0], center[1] + 0.01, center[2]), // 약간 위에 배치
        new THREE.Vector3(length, 3, width), // 높이를 크게 설정하여 인식 용이
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
  }, [index, center, length, width, rotationZ, physics, start]);

  useFrame(() => {
    const player = physics.getObject("player");
    if (!player || !checkpointObjectRef.current) return;

    // RapierJS 충돌 감지 사용
    const inside = physics.hasContact("player", checkpointId.current);

    // useFrame 내에서는 getState() 사용 (리렌더링 방지)
    const state = useCheckPointStore.getState();
    const total: number = state.checkpoints.total || index;
    const last: number = state.checkpoints.last;

    // 다음 체크포인트 계산: 0부터 시작하는 인덱스에 맞게 수정
    // - last가 total이면 다음은 0 (랩 완료 후 처음으로 돌아감)
    // - 그 외에는 last + 1
    // - 단, total이 0이거나 유효하지 않은 경우는 0을 다음으로 (초기 상태)
    const nextIndex =
      total > 0 && last === total ? 0 : total > 0 ? last + 1 : 0;
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
      const last = state.checkpoints.last;
      const total = state.checkpoints.total;

      // 체크포인트 등록 조건:
      // 1. start 체크포인트는 처음 통과할 때 (last === 0 또는 last === total) 무조건 등록
      // 2. 일반적인 경우: last === index - 1 (이전 체크포인트를 통과했는지 확인)
      // 3. 랩이 끝나고 첫 번째 체크포인트로 돌아오는 경우:
      //    - index === 0 && last === total (0부터 시작하는 경우)
      //    - 또는 index === 1 && last === total (1부터 시작하는 경우)
      const isValidSequence =
        (start && (last === 0 || last === total)) || // start 체크포인트 첫 통과
        last === index - 1 || // 순서대로 통과
        (index === 0 && last === total) || // 0부터 시작: 마지막 체크포인트 후 시작점으로 복귀
        (index === 1 && last === total); // 1부터 시작: 마지막 체크포인트 후 시작점으로 복귀

      if (isValidSequence) {
        // 랩 종료 처리: end 체크포인트를 통과했을 때
        // 조건: end=true이고, 이전 체크포인트가 마지막 체크포인트였을 때 (last === total)
        // 단, 처음 시작할 때(last === 0 && index === 0)는 랩을 증가시키지 않음
        // 랩 증가는 last 업데이트 전에 체크해야 함 (이전 last 값 사용)
        const shouldIncrementLap =
          end &&
          last === total &&
          last !== index &&
          !(last === 0 && index === 0);

        // 랩 증가와 last 업데이트를 한 번에 처리
        if (shouldIncrementLap) {
          const newLaps = (state.checkpoints.laps || 0) + 1;
          setCheckpoints({
            laps: newLaps,
            last: index, // 랩 완료 후 현재 체크포인트를 last로 설정
          });
          // 랩 타이밍 기록
          const { completeLap } = useTimeStore.getState();
          completeLap(performance.now());
          // 고스트 녹화 종료 및 즉시 재생 시작
          const ghost = useGhostStore.getState();
          const rec = ghost.stopRecording();
          if (rec && rec.positions.length > 0) {
            ghost.loadRecording(rec);
            ghost.stopPlayback();
            ghost.startPlayback(performance.now());
          }
        } else {
          // 랩이 증가하지 않으면 last만 업데이트
          setCheckpoints({ last: index });
        }

        // 체크포인트 통과 시 리스폰 위치 업데이트
        setRespawnPosition(
          new THREE.Vector3(center[0], center[1] + 3.0, center[2])
        );
        setRespawnRotation(rotationZ);
        setRespawnRoll(rotationZ);

        // start 체크포인트 등록
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
