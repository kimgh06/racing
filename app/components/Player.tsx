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

export function Player({
  position = [0, 5, 0],
  mass = 1,
  restitution = 0.2, // 더 낮은 반발력으로 더 안정적인 착지
  friction = 0.95, // 마찰력을 높게 설정하여 미끄러짐 방지
}: PlayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isJumping, setIsJumping] = useState(false);

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

  // 움직임 처리 (useFrame에서)
  useFrame(() => {
    const player = gravityEngine.getObject("player");
    if (!player) return;

    const moveSpeed = 5; // 이동 속도
    const jumpForce = 10; // 점프력

    // 키보드 입력에 따른 움직임 - 직접 속도 설정
    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      player.velocity.z = -moveSpeed;
    }
    if (keys.has("KeyS") || keys.has("ArrowDown")) {
      player.velocity.z = moveSpeed;
    }
    if (keys.has("KeyA") || keys.has("ArrowLeft")) {
      player.velocity.x = -moveSpeed;
    }
    if (keys.has("KeyD") || keys.has("ArrowRight")) {
      player.velocity.x = moveSpeed;
    }
    if (keys.has("Space") && player.onGround && !isJumping) {
      player.velocity.y = jumpForce;
      setIsJumping(true);
    }
  });

  // 물리 업데이트
  useFrame(() => {
    const player = gravityEngine.getObject("player");
    if (player && meshRef.current) {
      meshRef.current.position.copy(player.position);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={isJumping ? "#ff6b6b" : "#4ecdc4"} />
    </mesh>
  );
}
