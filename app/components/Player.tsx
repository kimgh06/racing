import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GravityObject } from "~/gravityEngine";
import { useGravityEngineContext } from "./Scene";
import * as THREE from "three";

interface PlayerProps {
  position?: [number, number, number];
  mass?: number;
  restitution?: number;
  friction?: number;
}

interface PlayerState {
  rotation: number; // 회전 각도 (라디안)
  angularVelocity: number; // 각속도
}

export function Player({
  position = [0, 5, 0],
  mass = 1,
  restitution = 0.2, // 더 낮은 반발력으로 더 안정적인 착지
  friction = 0.95, // 마찰력을 높게 설정하여 미끄러짐 방지
}: PlayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isJumping, setIsJumping] = useState(false);

  // 플레이어 회전 상태 (useRef로 직접 관리)
  const rotationRef = useRef<PlayerState>({
    rotation: 0,
    angularVelocity: 0,
  });

  const gravityEngine = useGravityEngineContext();

  // 플레이어 오브젝트 초기화
  useEffect(() => {
    const playerObject: GravityObject = {
      position: new THREE.Vector3(...position),
      velocity: new THREE.Vector3(0, 0, 0),
      mass,
      restitution,
      friction,
      onGround: false,
      size: new THREE.Vector3(1, 1, 1), // 플레이어 크기
      groundOffset: 0, // 바닥으로부터의 오프셋
      isStatic: false, // 동적 오브젝트
      type: "player" as const,
    };

    gravityEngine.addObject("player", playerObject);
    gravityEngine.setGroundCollisionCallback((objectId, impactVelocity) => {
      if (objectId === "player") {
        setIsJumping(false);
        console.log("Player landed with impact velocity:", impactVelocity);
      }
    });

    return () => {
      gravityEngine.removeObject("player");
    };
  }, [gravityEngine]);

  // 키보드 상태 추적
  const [keys, setKeys] = useState<Set<string>>(new Set());

  // 키보드 입력 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setKeys((prev) => new Set(prev).add(event.code));
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      setKeys((prev) => {
        const newKeys = new Set(prev);
        newKeys.delete(event.code);
        return newKeys;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 통합된 물리 및 움직임 처리
  useFrame((state, delta) => {
    const player = gravityEngine.getObject("player");
    if (!player) return;

    const moveSpeed = 5; // 이동 속도
    const turnSpeed = 2; // 회전 속도 (더 느리게)
    const jumpForce = 10; // 점프력

    // 회전 상태를 직접 계산 (useRef 사용)
    let newAngularVelocity = rotationRef.current.angularVelocity;
    let newRotation = rotationRef.current.rotation;

    // 회전 입력 처리 (A/D 키) - 바닥에 있을 때만
    if (player.onGround) {
      if (keys.has("KeyA") || keys.has("ArrowLeft")) {
        newAngularVelocity = turnSpeed;
      } else if (keys.has("KeyD") || keys.has("ArrowRight")) {
        newAngularVelocity = -turnSpeed;
      } else {
        // 회전 입력이 없으면 각속도를 빠르게 감소
        newAngularVelocity = newAngularVelocity * 0.3;
      }
    } else {
      // 공중에서는 회전도 천천히 감속
      if (keys.has("KeyA") || keys.has("ArrowLeft")) {
        newAngularVelocity = turnSpeed * 0.5; // 공중에서는 회전력 감소
      } else if (keys.has("KeyD") || keys.has("ArrowRight")) {
        newAngularVelocity = -turnSpeed * 0.5; // 공중에서는 회전력 감소
      } else {
        // 공중에서 회전 입력이 없으면 매우 천천히 감속
        newAngularVelocity = newAngularVelocity * 0.9;
      }
    }

    // 각속도가 매우 작을 때 완전히 멈춤
    if (Math.abs(newAngularVelocity) < 0.01) {
      newAngularVelocity = 0;
    }

    // 회전 업데이트
    newRotation = newRotation + newAngularVelocity * delta;

    // useRef에 즉시 반영
    rotationRef.current = {
      rotation: newRotation,
      angularVelocity: newAngularVelocity,
    };

    // 회전 정보를 전역으로 공유
    (window as any).playerRotation = newRotation;

    // 전진/후진 입력 처리 (W/S 키) - 바닥에 있을 때만
    if (player.onGround) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) {
        // 현재 회전 방향으로 전진
        const forwardX = -Math.sin(newRotation);
        const forwardZ = -Math.cos(newRotation);
        player.velocity.x = forwardX * moveSpeed;
        player.velocity.z = forwardZ * moveSpeed;

        // 디버깅 로그
        console.log(
          `W키 - 회전: ${((newRotation * 180) / Math.PI).toFixed(
            1
          )}°, 전진: (${forwardX.toFixed(2)}, ${forwardZ.toFixed(2)})`
        );
      } else if (keys.has("KeyS") || keys.has("ArrowDown")) {
        // 현재 회전 방향의 반대로 후진
        const backwardX = Math.sin(newRotation);
        const backwardZ = Math.cos(newRotation);
        player.velocity.x = backwardX * moveSpeed;
        player.velocity.z = backwardZ * moveSpeed;

        // 디버깅 로그
        console.log(
          `S키 - 회전: ${((newRotation * 180) / Math.PI).toFixed(
            1
          )}°, 후진: (${backwardX.toFixed(2)}, ${backwardZ.toFixed(2)})`
        );
      } else {
        // 전진/후진 입력이 없으면 수평 속도를 점진적으로 감소
        player.velocity.x *= 0.8;
        player.velocity.z *= 0.8;
      }
    } else {
      // 공중에서는 수평 속도를 천천히 감속
      player.velocity.x *= 0.999; // 매우 천천히 감속
      player.velocity.z *= 0.999; // 매우 천천히 감속
    }
    // 수직 속도는 중력에 의해 자동 처리

    // 점프 (바닥에 있을 때만)
    if (keys.has("Space") && player.onGround && !isJumping) {
      player.velocity.y = jumpForce;
      setIsJumping(true);
    }

    // 메시 위치 및 회전 업데이트 (즉시 반영)
    if (meshRef.current) {
      meshRef.current.position.copy(player.position);
      meshRef.current.rotation.y = newRotation; // 계산된 회전을 즉시 적용
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={isJumping ? "#ff6b6b" : "#4ecdc4"} />
    </mesh>
  );
}
