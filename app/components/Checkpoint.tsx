import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePhysicsEngineContext } from "./Scene";

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
  length = 0.6,
  color = "#00d1b2",
  rotationZ = 0,
  nextCenter,
  start = false,
  end = false,
}: CheckpointProps) {
  const physics = usePhysicsEngineContext();
  const planeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tileMatRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const bboxHalf = useRef({ halfX: length / 2, halfZ: width / 2 });

  useEffect(() => {
    const w = window as any;
    if (!w.checkpoints) {
      w.checkpoints = { total: 0, last: 0, laps: 0 };
    }
    if (!w._cpInside) {
      w._cpInside = {} as Record<number, boolean>;
    }
    // 동적으로 총 개수 갱신 (가장 큰 인덱스)
    w.checkpoints.total = Math.max(w.checkpoints.total || 0, index);
  }, [index]);

  useFrame(() => {
    const player = physics.getObject("player");
    if (!player) return;
    const p = physics.getPosition("player");

    const dx = Math.abs(p.x - center[0]);
    const dz = Math.abs(p.z - center[2]);
    const inside =
      dx <= bboxHalf.current.halfX + 0.4 && dz <= bboxHalf.current.halfZ + 0.4;

    const w = window as any;
    if (!w.checkpoints) return;
    if (!w._cpInside) w._cpInside = {} as Record<number, boolean>;

    const total: number = w.checkpoints.total || index;
    const last: number = w.checkpoints.last || 0;
    const nextIndex = (last % total || 0) + 1;
    const isActive = nextIndex === index;

    const activeColor = new THREE.Color(color);
    const inactiveColor = new THREE.Color("#ffffff");
    if (planeMatRef.current) {
      planeMatRef.current.color.copy(isActive ? activeColor : inactiveColor);
      planeMatRef.current.opacity = isActive ? 0.65 : 0.35;
      planeMatRef.current.needsUpdate = true;
    }
    tileMatRefs.current.forEach((m) => {
      if (!m) return;
      m.color.copy(isActive ? activeColor : inactiveColor);
      m.opacity = isActive ? 0.9 : 0.7;
      m.needsUpdate = true;
    });

    const wasInside = !!w._cpInside[index];
    if (inside && !wasInside) {
      if (w.checkpoints.last === index - 1) {
        w.checkpoints.last = index;
        w.respawnPosition = new THREE.Vector3(
          center[0],
          center[1] + 1.5,
          center[2]
        );
        (w as any).respawnRotation = rotationZ;
        (w as any).respawnRoll = rotationZ;
        if (end) {
          w.checkpoints.laps = (w.checkpoints.laps || 0) + 1;
          w.checkpoints.last = 0;
        }
        if (start) {
          w.startIndex = index;
        }
      }
      w._cpInside[index] = true;
    } else if (!inside && wasInside) {
      w._cpInside[index] = false;
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
          <planeGeometry args={[width, length]} />
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
                position={[t.pos.x, t.pos.y, t.pos.z]}
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
