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
  rotation?: [number, number, number];
  nextCenter?: [number, number, number]; // 다음 체크포인트 위치 (방향 표시용)
}

export function Checkpoint({
  index,
  center,
  width,
  length = 0.6,
  rotation = [-Math.PI / 2, 0, 0],
  color = "#00d1b2",
  nextCenter,
}: CheckpointProps) {
  const physics = usePhysicsEngineContext();
  const planeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tileMatRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const bboxHalf = useRef({ halfX: length / 2, halfZ: width / 2 });

  useEffect(() => {
    // Initialize global checkpoint state once
    const w = window as any;
    if (!w.checkpoints) {
      w.checkpoints = { total: 3, last: 0, laps: 0 };
    }
    if (!w._cpInside) {
      w._cpInside = {} as Record<number, boolean>;
    }
  }, []);

  // overlap detection and sequential progress + active color update
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

    // Determine which checkpoint should be active (tinted)
    const nextIndex = (w.checkpoints.last % w.checkpoints.total) + 1;
    const isActive = nextIndex === index;

    // Update materials to reflect active state
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
      // Entered checkpoint
      // Sequential check: must match next expected index
      if (w.checkpoints.last === index - 1) {
        w.checkpoints.last = index;
        // Save respawn to checkpoint center
        w.respawnPosition = new THREE.Vector3(
          center[0],
          center[1] + 1.5,
          center[2]
        );
        // Save respawn rotation (yaw) to align forward with track direction (toward next)
        if (nextCenter) {
          const dirX = nextCenter[0] - center[0];
          const dirZ = nextCenter[2] - center[2];
          const directionToNext = Math.atan2(dirX, dirZ); // arrow direction
          // player forward vector is [-sin(r), -cos(r)] → align to (dirX, dirZ)
          const heading = directionToNext + Math.PI;
          (w as any).respawnRotation = heading;
        }
        // Also store roll (Z axis) from ground rotation
        (w as any).respawnRoll = Array.isArray(rotation) ? rotation[2] ?? 0 : 0;
        // If this was the final checkpoint, increment lap and reset sequence
        if (index === w.checkpoints.total) {
          w.checkpoints.laps = (w.checkpoints.laps || 0) + 1;
          w.checkpoints.last = 0;
        }
      }
      w._cpInside[index] = true;
    } else if (!inside && wasInside) {
      // Exited checkpoint - allow retrigger later
      w._cpInside[index] = false;
    }
  });

  // Calculate direction to next checkpoint (local yaw for tiles)
  const direction = nextCenter
    ? Math.atan2(nextCenter[0] - center[0], nextCenter[2] - center[2])
    : 0;

  // Chevron tile config (local +Z)
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
    // Parent applies ground rotation and center position so tiles inherit it
    <group position={center} rotation={rotation}>
      {/* 체크포인트 평면 */}
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

      {/* >>> 타일: additional yaw (direction) inside rotated ground space */}
      {nextCenter && (
        <group rotation={[0, direction, 0]}>
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
      )}
    </group>
  );
}
