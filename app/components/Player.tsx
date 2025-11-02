import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { usePhysicsEngineContext } from "./Scene";
import { isDynamicObject } from "~/physicsEngine";
import { useCheckPointStore } from "~/store/checkpointStore";
import * as THREE from "three";

interface PlayerProps {
  position?: [number, number, number];
  mass?: number;
  weight?: number; // kg 단위 - 접지력과 비례
}

interface PlayerState {
  rotation: number; // Y축 회전 (라디안)
  angularVelocity: number; // 각속도
  tiltX: number; // X축 기울기 각도
  tiltZ: number; // Z축 기울기 각도
  tiltVelocityX: number; // X축 기울기 속도
  tiltVelocityZ: number; // Z축 기울기 속도
  centerOfMass: THREE.Vector3; // 무게 중심
  supportPoint: THREE.Vector3; // 지지점
}

export function Player({
  position = [0, 5, 0],
  mass = 1,
  weight = 70, // 기본 무게 70kg
}: PlayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isJumping, setIsJumping] = useState(false);
  const physicsEngine = usePhysicsEngineContext();

  // 플레이어 상태 관리
  const playerStateRef = useRef<PlayerState>({
    rotation: 0,
    angularVelocity: 0,
    tiltX: 0,
    tiltZ: 0,
    tiltVelocityX: 0,
    tiltVelocityZ: 0,
    centerOfMass: new THREE.Vector3(0, 0.5, 0),
    supportPoint: new THREE.Vector3(0, 0, 0),
  });

  // 키 입력 상태 관리
  const keys = useRef<Set<string>>(new Set());

  // 디버그용 store 업데이트 throttling
  const lastUpdateRef = useRef(0);

  // 플레이어 오브젝트 생성
  useEffect(() => {
    const timer = setTimeout(() => {
      const playerObject = physicsEngine.createPlayer(
        "player",
        new THREE.Vector3(...position),
        new THREE.Vector3(1, 1, 1),
        mass,
        weight
      );

      if (playerObject && meshRef.current) {
        playerObject.mesh = meshRef.current;
      }

      physicsEngine.setGroundCollisionCallback(
        (objectId: string, impactVelocity: number) => {
          if (objectId === "player") setIsJumping(false);
        }
      );

      // 화면 로드 시 last가 0이면 시작 지점으로 자동 이동
      const checkpointState = useCheckPointStore.getState();
      if (checkpointState.checkpoints.last === 0) {
        // 리스폰 위치가 있으면 그곳으로, 없으면 props로 받은 position 사용
        const spawnPosition = checkpointState.respawnPosition
          ? checkpointState.respawnPosition
          : new THREE.Vector3(...position);

        // 약간의 지연 후 위치 설정 (물리 엔진이 완전히 초기화된 후)
        setTimeout(() => {
          physicsEngine.setPosition("player", spawnPosition);
          physicsEngine.setVelocity("player", new THREE.Vector3(0, 0, 0));

          resetPlayer();
        }, 50);
      }
    }, 100);

    return () => {
      physicsEngine.removeObject("player");
      clearTimeout(timer);
    };
  }, []);

  const resetPlayer = () => {
    const { respawnPosition, respawnRotation, respawnRoll } =
      useCheckPointStore.getState();
    const spawn = respawnPosition
      ? respawnPosition
      : new THREE.Vector3(...position);
    const respYaw = respawnRotation ?? undefined;
    const respRollValue = respawnRoll ?? undefined;
    // 반대 방향: 저장된 yaw에 PI 추가
    const yaw = (typeof respYaw === "number" ? respYaw : 0) + Math.PI;
    const roll = typeof respRollValue === "number" ? respRollValue : 0;

    physicsEngine.setPosition("player", spawn);
    physicsEngine.setVelocity("player", new THREE.Vector3(0, 0, 0));
    // 각종 상태 리셋 및 방향/롤 설정
    playerStateRef.current.rotation = yaw;
    playerStateRef.current.angularVelocity = 0;
    playerStateRef.current.tiltX = 0;
    playerStateRef.current.tiltZ = roll;
    playerStateRef.current.tiltVelocityX = 0;
    playerStateRef.current.tiltVelocityZ = 0;
    // 물리 바디 회전 반영 (Euler: x=0, y=yaw, z=roll)
    physicsEngine.setRotation("player", new THREE.Euler(0, yaw, roll));
    setIsJumping(false);
  };

  // 키 입력 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      // R 키로 플레이어 초기화 (반대 방향으로)
      if (event.code === "KeyR") {
        resetPlayer();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 물리 및 움직임 처리
  useFrame((state, delta) => {
    const playerObj = physicsEngine.getObject("player");
    if (!playerObj || !isDynamicObject(playerObj)) return;
    const player = playerObj; // 타입 가드로 인해 DynamicPhysicsObject로 추론됨

    // 무게에 따른 접지력 계산
    const weightFactor = weight / 70; // 70kg 기준으로 정규화
    const baseMoveSpeed = 10;
    const baseTurnSpeed = 1.5;
    const baseJumpForce = 12;

    // 무게가 클수록 느리고 안정적, 작을수록 빠르고 민첩
    const moveSpeed = baseMoveSpeed * (1 / Math.sqrt(weightFactor));
    const turnSpeed = baseTurnSpeed * (1 / Math.sqrt(weightFactor));
    const jumpForce = baseJumpForce * Math.sqrt(weightFactor);

    // 회전 상태 계산
    let newAngularVelocity = playerStateRef.current.angularVelocity;
    let newRotation = playerStateRef.current.rotation;

    // 기울기 상태 계산
    let newTiltX = playerStateRef.current.tiltX;
    let newTiltZ = playerStateRef.current.tiltZ;
    let newTiltVelocityX = playerStateRef.current.tiltVelocityX;
    let newTiltVelocityZ = playerStateRef.current.tiltVelocityZ;

    // 좌우 회전 처리 (J/L 키) - 플레이어 자체 회전
    if (keys.current.has("KeyJ")) {
      newAngularVelocity = turnSpeed;
    } else if (keys.current.has("KeyL")) {
      newAngularVelocity = -turnSpeed;
    } else {
      // 회전 입력이 없으면 각속도를 매우 빠르게 감소
      newAngularVelocity *= 0.05;
    }

    // 각속도가 매우 작을 때 완전히 멈춤
    if (Math.abs(newAngularVelocity) < 0.1) {
      newAngularVelocity = 0;
    }

    // 현실적인 기울기 물리 계산 (바닥에 있을 때만)
    if (player.onGround) {
      // 가장 가까운 바닥 찾기
      let nearestGround = null;
      let minDistance = Infinity;

      const allObjects = physicsEngine.getObjects();
      for (const [id, obj] of allObjects) {
        if (obj.type === "ground") {
          const distance = Math.abs(
            physicsEngine.getPosition("player").y -
              physicsEngine.getPosition(id).y
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestGround = obj;
          }
        }
      }

      let isNearEdge = false;
      if (nearestGround) {
        const playerPos = physicsEngine.getPosition("player");
        const groundPos = physicsEngine.getPosition(nearestGround.id);
        const groundSize = nearestGround.collider.halfExtents();

        // 가장자리까지의 거리 계산
        const edgeDistanceX =
          Math.abs(playerPos.x - groundPos.x) - groundSize.x;
        const edgeDistanceZ =
          Math.abs(playerPos.z - groundPos.z) - groundSize.z;

        const edgeThreshold = 0.8;
        if (edgeDistanceX < edgeThreshold || edgeDistanceZ < edgeThreshold) {
          isNearEdge = true;

          // 지지점 계산 (가장자리)
          const supportX = Math.sign(playerPos.x - groundPos.x) * groundSize.x;
          const supportZ = Math.sign(playerPos.z - groundPos.z) * groundSize.z;
          playerStateRef.current.supportPoint.set(
            groundPos.x + supportX,
            groundPos.y + groundSize.y,
            groundPos.z + supportZ
          );

          // 무게 중심 (플레이어 중심에서 약간 위)
          playerStateRef.current.centerOfMass.set(
            playerPos.x,
            playerPos.y + 0.5,
            playerPos.z
          );

          // 지렛대 팔 계산
          const leverArm = playerStateRef.current.centerOfMass
            .clone()
            .sub(playerStateRef.current.supportPoint);

          // 토크 계산 (중력에 의한)
          const gravityForce = weight * 9.81; // 중력
          const torqueX = gravityForce * leverArm.z;
          const torqueZ = -gravityForce * leverArm.x;

          // 각가속도 계산
          const momentOfInertia = 1; // 관성 모멘트 (단순화)
          const angularAccelerationX = torqueX / momentOfInertia;
          const angularAccelerationZ = torqueZ / momentOfInertia;

          // 기울기 속도 업데이트
          newTiltVelocityX += angularAccelerationX * delta;
          newTiltVelocityZ += angularAccelerationZ * delta;
        }
      }

      // 가장자리가 아니면 기울기 속도를 매우 강하게 감쇠하여 원래 자세로 복원
      if (!isNearEdge) {
        newTiltVelocityX *= 0.1;
        newTiltVelocityZ *= 0.1;
        newTiltX *= 0.5;
        newTiltZ *= 0.5;
      }

      // 기울기 각도 업데이트
      newTiltX += newTiltVelocityX * delta;
      newTiltZ += newTiltVelocityZ * delta;

      // 기울기 감쇠 (안정화)
      newTiltVelocityX *= 0.95;
      newTiltVelocityZ *= 0.95;

      // 복원력 (원래 자세로 돌아가려는 힘)
      const restoreForce = 0.1;
      newTiltVelocityX -= newTiltX * restoreForce;
      newTiltVelocityZ -= newTiltZ * restoreForce;
    }

    // 회전 업데이트
    newRotation += newAngularVelocity * delta;

    // 플레이어 상태 업데이트
    playerStateRef.current = {
      rotation: newRotation,
      angularVelocity: newAngularVelocity,
      tiltX: newTiltX,
      tiltZ: newTiltZ,
      tiltVelocityX: newTiltVelocityX,
      tiltVelocityZ: newTiltVelocityZ,
      centerOfMass: playerStateRef.current.centerOfMass,
      supportPoint: playerStateRef.current.supportPoint,
    };

    // 이동 처리 (I/K 키) - 앞뒤 이동
    if (player.onGround) {
      if (keys.current.has("KeyI")) {
        // 현재 회전 방향으로 전진
        const forwardX = -Math.sin(newRotation);
        const forwardZ = -Math.cos(newRotation);
        const currentVelocity = physicsEngine.getVelocity("player");
        physicsEngine.setVelocity(
          "player",
          new THREE.Vector3(
            forwardX * moveSpeed,
            currentVelocity.y,
            forwardZ * moveSpeed
          )
        );
      } else if (keys.current.has("KeyK")) {
        // 현재 회전 방향의 반대로 후진
        const backwardX = Math.sin(newRotation);
        const backwardZ = Math.cos(newRotation);
        const currentVelocity = physicsEngine.getVelocity("player");
        physicsEngine.setVelocity(
          "player",
          new THREE.Vector3(
            backwardX * moveSpeed,
            currentVelocity.y,
            backwardZ * moveSpeed
          )
        );
      } else {
        // 전진/후진 입력이 없으면 수평 속도를 무게에 비례하여 감소
        const stopFactor = 0.1 + weightFactor * 0.2; // 무게가 클수록 더 빠르게 정지
        const currentVelocity = physicsEngine.getVelocity("player");
        physicsEngine.setVelocity(
          "player",
          new THREE.Vector3(
            currentVelocity.x * stopFactor,
            currentVelocity.y,
            currentVelocity.z * stopFactor
          )
        );
      }
    } else {
      // 공중에서는 수평 속도를 천천히 감속
      const currentVelocity = physicsEngine.getVelocity("player");
      physicsEngine.setVelocity(
        "player",
        new THREE.Vector3(
          currentVelocity.x * 0.99,
          currentVelocity.y,
          currentVelocity.z * 0.99
        )
      );
    }

    // 점프 처리 (스페이스바)
    if (keys.current.has("Space") && player.onGround && !isJumping) {
      const currentVelocity = physicsEngine.getVelocity("player");
      physicsEngine.setVelocity(
        "player",
        new THREE.Vector3(currentVelocity.x, jumpForce, currentVelocity.z)
      );
      setIsJumping(true);
    }

    // 메시 회전 적용
    if (meshRef.current) {
      meshRef.current.rotation.y = newRotation;
      meshRef.current.rotation.x = newTiltX;
      meshRef.current.rotation.z = newTiltZ;
    }

    // 디버그용 전역 상태 업데이트 (throttled: 10fps로 제한)
    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
      // 100ms마다 업데이트 (약 10fps)
      lastUpdateRef.current = now;
      const { setPlayerState, setPhysicsEngine } =
        useCheckPointStore.getState();
      setPlayerState({
        position: physicsEngine.getPosition("player"),
        velocity: physicsEngine.getVelocity("player"),
        rotation: newRotation,
        onGround: player.onGround,
        tiltX: newTiltX,
        tiltZ: newTiltZ,
        tiltVelocityX: newTiltVelocityX,
        tiltVelocityZ: newTiltVelocityZ,
        centerOfMass: playerStateRef.current.centerOfMass,
        supportPoint: playerStateRef.current.supportPoint,
        weight: weight,
        weightFactor: weightFactor,
      });
      setPhysicsEngine(physicsEngine);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4a90e2" />
    </mesh>
  );
}
