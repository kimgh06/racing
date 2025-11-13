import { useCallback, useEffect, useRef, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InputQueue, InputAction } from "./inputQueue";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import { isDynamicObject } from "~/src/shared/lib/physics/physicsEngine";
import { PLAYER_TUNING } from "./playerConfig";
import { PlayerState } from "./playerTypes";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";
import { InputProcessor } from "./inputProcessor";

type PhysicsEngineApi = ReturnType<typeof usePhysicsEngineContext>;

export function usePlayerVisualRefs(vehicleType: string) {
  const meshRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const wheelSpinRefs = useRef<(THREE.Object3D | null)[]>([]);
  const frontWheelSteerRefs = useRef<(THREE.Object3D | null)[]>([]);

  useEffect(() => {
    wheelSpinRefs.current = [];
    frontWheelSteerRefs.current = [];
  }, [vehicleType]);

  return { meshRef, headRef, wheelSpinRefs, frontWheelSteerRefs };
}

interface PlayerInitialState {
  position: [number, number, number];
  mass: number;
  weight: number;
  physicsEngine: PhysicsEngineApi;
  meshRef: MutableRefObject<THREE.Mesh | null>;
  playerStateRef: MutableRefObject<PlayerState>;
  setIsJumping: (value: boolean) => void;
  inputQueueRef: MutableRefObject<InputQueue>;
  inputProcessorRef: MutableRefObject<InputProcessor>;
  setStartTime: (value: number) => void;
  startLap: (value: number) => void;
  startRecording: (value: number) => void;
}

export function usePlayerInitialization({
  position,
  mass,
  weight,
  physicsEngine,
  meshRef,
  playerStateRef,
  setIsJumping,
  inputQueueRef,
  inputProcessorRef,
  setStartTime,
  startLap,
  startRecording,
}: PlayerInitialState) {
  const playerState = playerStateRef.current;
  const resetPlayer = useCallback(() => {
    const { respawnPosition, respawnRotation, respawnRoll } =
      useCheckPointStore.getState();
    const spawn = respawnPosition ?? new THREE.Vector3(...position);
    const respYaw = respawnRotation ?? undefined;
    const respRollValue = respawnRoll ?? undefined;
    const yaw = (respYaw ?? 0) + Math.PI;
    const roll = respRollValue ?? 0;

    physicsEngine.setPosition("player", spawn);
    physicsEngine.setVelocity("player", new THREE.Vector3(0, 0, 0));
    playerState.rotation = yaw;
    playerState.wheelRotation = 0;
    playerState.wheelRotationSpeed = 0;
    playerState.driveSpeedCurrent = 0;
    playerState.steerAngle = 0;
    playerState.steerAngleTarget = 0;
    playerState.tiltX = 0;
    playerState.tiltZ = roll;
    playerState.tiltVelocityX = 0;
    playerState.tiltVelocityZ = 0;
    playerState.headTilt = 0;
    playerState.headTiltVelocity = 0;
    playerState.linearVelocity.set(0, 0, 0);
    physicsEngine.setRotation("player", new THREE.Euler(0, yaw, roll));
    setIsJumping(false);

    const activeInputsBeforeReset = inputQueueRef.current.getCurrentInputs();
    inputQueueRef.current.clear();
    inputProcessorRef.current.reset(yaw);
    inputQueueRef.current.setGameStartTime(performance.now());

    activeInputsBeforeReset?.forEach((action) => {
      inputQueueRef.current.addInput(action, true);
    });
    inputProcessorRef.current.setMovementState({
      rotation: yaw,
      angularVelocity: 0,
    });
  }, [
    inputProcessorRef,
    inputQueueRef,
    physicsEngine,
    playerStateRef,
    position,
    setIsJumping,
  ]);

  useEffect(() => {
    inputQueueRef.current.setGameStartTime(performance.now());

    const timer = setTimeout(() => {
      const playerObject = physicsEngine.createPlayer(
        "player",
        new THREE.Vector3(...position),
        new THREE.Vector3(1.1, 1.1, 1.1), // Slightly larger collider to prevent tunneling
        mass,
        weight
      );

      if (playerObject && meshRef.current) {
        playerObject.mesh = meshRef.current;
      }

      physicsEngine.setGroundCollisionCallback((objectId: string) => {
        if (objectId === "player") setIsJumping(false);
      });

      const checkpointState = useCheckPointStore.getState();
      if (checkpointState.checkpoints.last === 0) {
        const spawnPosition = checkpointState.respawnPosition
          ? checkpointState.respawnPosition
          : new THREE.Vector3(...position);

        setTimeout(() => {
          physicsEngine.setPosition("player", spawnPosition);
          physicsEngine.setVelocity("player", new THREE.Vector3(0, 0, 0));

          resetPlayer();
          const now = performance.now();
          setStartTime(now);
          startLap(now);
          startRecording(now);
        }, 50);
      }
    }, 100);

    return () => {
      physicsEngine.removeObject("player");
      clearTimeout(timer);
    };
  }, [
    mass,
    physicsEngine,
    position,
    resetPlayer,
    setIsJumping,
    setStartTime,
    startLap,
    startRecording,
    weight,
    inputQueueRef,
  ]);

  return { resetPlayer };
}

export function usePlayerInputHandlers(
  resetPlayer: () => void,
  inputQueueRef: MutableRefObject<InputQueue>
) {
  useEffect(() => {
    const keyToAction: Record<string, InputAction> = {
      KeyI: "forward",
      KeyK: "backward",
      KeyJ: "turnLeft",
      KeyL: "turnRight",
      Space: "jump",
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = keyToAction[event.code];
      if (action) {
        inputQueueRef.current.addInput(action, true);
      }
      if (event.code === "KeyR") {
        resetPlayer();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = keyToAction[event.code];
      if (action) inputQueueRef.current.addInput(action, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [inputQueueRef, resetPlayer]);
}

export function usePlayerMovementLoop({
  weight,
  vehicleType,
  motorType,
  physicsEngine,
  isJumping,
  setIsJumping,
  meshRef,
  headRef,
  wheelSpinRefs,
  frontWheelSteerRefs,
  inputQueueRef,
  playerStateRef,
  lastUpdateRef,
}: {
  weight: number;
  vehicleType: string;
  motorType: string;
  physicsEngine: PhysicsEngineApi;
  isJumping: boolean;
  setIsJumping: (value: boolean) => void;
  meshRef: MutableRefObject<THREE.Mesh | null>;
  headRef: MutableRefObject<THREE.Group | null>;
  wheelSpinRefs: MutableRefObject<(THREE.Object3D | null)[]>;
  frontWheelSteerRefs: MutableRefObject<(THREE.Object3D | null)[]>;
  inputQueueRef: MutableRefObject<InputQueue>;
  playerStateRef: MutableRefObject<PlayerState>;
  lastUpdateRef: MutableRefObject<number>;
}) {
  const playerState = playerStateRef.current;
  useFrame((_, delta) => {
    const playerObj = physicsEngine.getObject("player");
    if (!playerObj || !isDynamicObject(playerObj)) return;
    const player = playerObj;

    const weightFactor = weight / 70;
    const vehicleTuning =
      PLAYER_TUNING.vehicle[vehicleType as keyof typeof PLAYER_TUNING.vehicle];
    const baseWheelSpeed = vehicleTuning.baseWheelSpeed;
    const baseTurnSpeed = vehicleTuning.baseTurnSpeed;
    const baseJumpForce = vehicleTuning.baseJumpForce;
    const wheelRadius = vehicleTuning.wheelRadius;
    const tiltRestore = vehicleTuning.tiltRestore;
    const wheelbase = vehicleTuning.wheelbase;
    const maxSteerAngle = vehicleTuning.maxSteerAngle;
    const steerSpeed = vehicleTuning.steerSpeed;

    const RPM_TO_RAD_PER_SEC = (2 * Math.PI) / 60;
    const RAD_PER_SEC_TO_RPM = 60 / (2 * Math.PI);

    const wheelSpeedBaseRPM =
      baseWheelSpeed * RAD_PER_SEC_TO_RPM * (1 / Math.sqrt(weightFactor));
    const wheelSpeedBase = wheelSpeedBaseRPM * RPM_TO_RAD_PER_SEC;

    const motorTuning =
      PLAYER_TUNING.motor[motorType as keyof typeof PLAYER_TUNING.motor];
    const driveMaxSpeed = motorTuning.maxRPM * RPM_TO_RAD_PER_SEC;
    const driveAccel = motorTuning.accelRPM * RPM_TO_RAD_PER_SEC;
    const driveDecel = motorTuning.decelRPM * RPM_TO_RAD_PER_SEC;
    const turnSpeed = baseTurnSpeed * (1 / Math.sqrt(weightFactor));
    const jumpForce = baseJumpForce * Math.sqrt(weightFactor);

    const currentInputs = inputQueueRef.current.getCurrentInputs();
    const onGround = player.onGround;

    let targetWheelSpeed = 0;
    if (currentInputs.has("forward")) {
      targetWheelSpeed = wheelSpeedBase;
    } else if (currentInputs.has("backward")) {
      targetWheelSpeed = -wheelSpeedBase;
    }
    if (!onGround) {
      targetWheelSpeed = playerState.wheelRotationSpeed;
    }

    const wheelAccel = PLAYER_TUNING.wheelVisualAccelRPM * RPM_TO_RAD_PER_SEC;
    const wheelDecel = PLAYER_TUNING.wheelVisualDecelRPM * RPM_TO_RAD_PER_SEC;
    const currentWheelSpeed = playerState.wheelRotationSpeed;
    if (targetWheelSpeed > currentWheelSpeed) {
      playerState.wheelRotationSpeed = Math.min(
        targetWheelSpeed,
        currentWheelSpeed + wheelAccel * delta
      );
    } else if (targetWheelSpeed < currentWheelSpeed) {
      playerState.wheelRotationSpeed = Math.max(
        targetWheelSpeed,
        currentWheelSpeed - wheelDecel * delta
      );
    }

    playerState.wheelRotation += playerState.wheelRotationSpeed * delta;

    const targetDriveSpeed = currentInputs.has("forward")
      ? driveMaxSpeed
      : currentInputs.has("backward")
      ? -driveMaxSpeed
      : 0;
    const driveSpeedCurrent = playerState.driveSpeedCurrent ?? 0;
    let effectiveTargetDriveSpeed = targetDriveSpeed;
    if (!onGround) {
      effectiveTargetDriveSpeed = driveSpeedCurrent;
    }
    let newDriveSpeed = driveSpeedCurrent;
    const gripCoeff =
      PLAYER_TUNING.gripCoeff[
        vehicleType as keyof typeof PLAYER_TUNING.gripCoeff
      ] ?? 1.0;
    const onGroundGripScale = onGround ? 1.0 : PLAYER_TUNING.airGripScale;
    const tractionAccel = onGround
      ? driveAccel * gripCoeff * onGroundGripScale
      : 0;
    const tractionDecel = onGround ? driveDecel : 0;

    if (effectiveTargetDriveSpeed > driveSpeedCurrent) {
      newDriveSpeed = Math.min(
        effectiveTargetDriveSpeed,
        driveSpeedCurrent + tractionAccel * delta
      );
    } else if (effectiveTargetDriveSpeed < driveSpeedCurrent) {
      newDriveSpeed = Math.max(
        effectiveTargetDriveSpeed,
        driveSpeedCurrent - tractionDecel * delta
      );
    }
    playerState.driveSpeedCurrent = newDriveSpeed;

    // Allow inertia: always move using current drive speed, but keys only affect when on ground.
    let rotationChange = 0;

    if (currentInputs.has("turnLeft"))
      playerState.steerAngleTarget = maxSteerAngle;
    else if (currentInputs.has("turnRight"))
      playerState.steerAngleTarget = -maxSteerAngle;
    else playerState.steerAngleTarget = 0;

    const steerDiff = playerState.steerAngleTarget - playerState.steerAngle;
    playerState.steerAngle += steerDiff * steerSpeed * delta;

    const speed = onGround
      ? Math.abs(newDriveSpeed * wheelRadius)
      : Math.abs(newDriveSpeed * wheelRadius);
    if (speed > 0.01) {
      const turnRadius = Math.abs(
        wheelbase / Math.tan(Math.abs(playerState.steerAngle) + 0.001)
      );
      const driveDir = Math.sign(newDriveSpeed) || 1;
      const angularVelocity =
        (speed / turnRadius) * Math.sign(playerState.steerAngle) * driveDir;
      rotationChange = angularVelocity * delta;
      playerState.rotation += rotationChange;
    }

    const linearSpeed = newDriveSpeed * wheelRadius;
    playerState.linearVelocity.set(
      -Math.sin(playerState.rotation) * linearSpeed,
      0,
      -Math.cos(playerState.rotation) * linearSpeed
    );

    // Use velocity-based movement instead of direct position setting
    // This allows the physics engine to properly detect collisions via CCD
    const currentVelocity = physicsEngine.getVelocity("player");

    // 충돌 체크: 장애물과 충돌했는지 확인 (체크포인트는 제외)
    const allObjects = physicsEngine.getObjects();
    let hasCollision = false;
    for (const [objId, obj] of allObjects.entries()) {
      // 체크포인트는 센서이므로 충돌 처리 제외
      if (objId.includes("checkpoint")) continue;

      if (objId !== "player" && obj.type === "obstacle") {
        // 센서인지 확인 (센서는 충돌 처리 안 함)
        if (obj.collider.isSensor()) continue;

        if (
          physicsEngine.hasContact &&
          physicsEngine.hasContact("player", objId)
        ) {
          hasCollision = true;
          break;
        }
      }
    }

    physicsEngine.setVelocity(
      "player",
      new THREE.Vector3(
        playerState.linearVelocity.x,
        currentVelocity.y, // Preserve Y velocity (gravity, jumping)
        playerState.linearVelocity.z
      )
    );

    // 충돌이 감지되면 driveSpeedCurrent를 반전시키고 에너지 손실 적용
    if (hasCollision && Math.abs(playerState.driveSpeedCurrent ?? 0) > 0.1) {
      const collisionLoss = PLAYER_TUNING.collisionEnergyLoss;
      // 속도를 반전시키고 에너지 손실 적용
      playerState.driveSpeedCurrent =
        -(playerState.driveSpeedCurrent ?? 0) * collisionLoss;
      // linearVelocity도 즉시 반전하고 에너지 손실 적용
      playerState.linearVelocity.x =
        -playerState.linearVelocity.x * collisionLoss;
      playerState.linearVelocity.z =
        -playerState.linearVelocity.z * collisionLoss;
      // 물리 엔진의 velocity는 handleWallCollisions에서 이미 처리됨
    }

    if (currentInputs.has("jump") && onGround && !isJumping) {
      const currentVelocity = physicsEngine.getVelocity("player");
      physicsEngine.setVelocity(
        "player",
        new THREE.Vector3(currentVelocity.x, jumpForce, currentVelocity.z)
      );
      setIsJumping(true);
    }

    physicsEngine.setRotation(
      "player",
      new THREE.Euler(0, playerState.rotation, 0)
    );

    const newRotation = playerState.rotation;
    let newTiltX = playerState.tiltX;
    let newTiltZ = playerState.tiltZ;
    let newTiltVelocityX = playerState.tiltVelocityX;
    let newTiltVelocityZ = playerState.tiltVelocityZ;
    let newHeadTilt = playerState.headTilt;
    let newHeadTiltVelocity = playerState.headTiltVelocity;

    const headInputs = inputQueueRef.current.getCurrentInputs();
    const maxHeadTilt = Math.PI / 6;
    let targetHeadTilt = 0;
    if (headInputs.has("turnLeft")) {
      targetHeadTilt = maxHeadTilt;
    } else if (headInputs.has("turnRight")) {
      targetHeadTilt = -maxHeadTilt;
    }

    const headTiltSpring = 80.0;
    const headTiltDamping = 0.8;
    const headTiltError = targetHeadTilt - newHeadTilt;
    newHeadTiltVelocity += headTiltError * headTiltSpring * delta;
    newHeadTiltVelocity *= headTiltDamping;
    newHeadTilt += newHeadTiltVelocity * delta;
    newHeadTilt = Math.max(-maxHeadTilt, Math.min(maxHeadTilt, newHeadTilt));

    if (onGround) {
      let nearestGround: any = null;
      let minDistance = Infinity;
      const allObjects = physicsEngine.getObjects();
      for (const [id, obj] of allObjects) {
        if (obj.type === "ground") {
          const distanceY = Math.abs(
            physicsEngine.getPosition("player").y -
              physicsEngine.getPosition(id).y
          );
          if (distanceY < minDistance) {
            minDistance = distanceY;
            nearestGround = obj;
          }
        }
      }

      let isNearEdge = false;
      if (nearestGround) {
        const playerPos = physicsEngine.getPosition("player");
        const groundPos = physicsEngine.getPosition(nearestGround.id);
        const groundSize = nearestGround.collider.halfExtents();
        const edgeDistanceX =
          Math.abs(playerPos.x - groundPos.x) - groundSize.x;
        const edgeDistanceZ =
          Math.abs(playerPos.z - groundPos.z) - groundSize.z;
        const edgeThreshold = 0.8;
        if (edgeDistanceX < edgeThreshold || edgeDistanceZ < edgeThreshold) {
          isNearEdge = true;
          const supportX = Math.sign(playerPos.x - groundPos.x) * groundSize.x;
          const supportZ = Math.sign(playerPos.z - groundPos.z) * groundSize.z;
          playerState.supportPoint.set(
            groundPos.x + supportX,
            groundPos.y + groundSize.y,
            groundPos.z + supportZ
          );
          playerState.centerOfMass.set(
            playerPos.x,
            playerPos.y + 0.5,
            playerPos.z
          );
          const leverArm = playerState.centerOfMass
            .clone()
            .sub(playerState.supportPoint);
          const gravityForce = weight * 9.81;
          const torqueX = gravityForce * leverArm.z;
          const torqueZ = -gravityForce * leverArm.x;
          const momentOfInertia = 1;
          const angularAccelerationX = torqueX / momentOfInertia;
          const angularAccelerationZ = torqueZ / momentOfInertia;
          newTiltVelocityX += angularAccelerationX * delta;
          newTiltVelocityZ += angularAccelerationZ * delta;
        }
      }

      if (!isNearEdge) {
        newTiltVelocityX *= 0.1;
        newTiltVelocityZ *= 0.1;
        newTiltX *= 0.5;
        newTiltZ *= 0.5;
      }

      newTiltX += newTiltVelocityX * delta;
      newTiltZ += newTiltVelocityZ * delta;
      newTiltVelocityX *= 0.95;
      newTiltVelocityZ *= 0.95;
      newTiltVelocityX -= newTiltX * tiltRestore;
      newTiltVelocityZ -= newTiltZ * tiltRestore;
    }

    playerState.tiltX = newTiltX;
    playerState.tiltZ = newTiltZ;
    playerState.tiltVelocityX = newTiltVelocityX;
    playerState.tiltVelocityZ = newTiltVelocityZ;
    playerState.headTilt = newHeadTilt;
    playerState.headTiltVelocity = newHeadTiltVelocity;

    if (meshRef.current) {
      meshRef.current.rotation.y = playerState.rotation;
      meshRef.current.rotation.x = playerState.tiltX;
      meshRef.current.rotation.z = playerState.tiltZ;
    }

    if (headRef.current) {
      headRef.current.rotation.z = playerState.headTilt;
    }

    wheelSpinRefs.current.forEach((wheel) => {
      if (wheel) {
        wheel.rotation.x += playerState.wheelRotationSpeed * delta;
      }
    });

    frontWheelSteerRefs.current.forEach((steerGroup) => {
      if (steerGroup) {
        steerGroup.rotation.y = playerState.steerAngle;
      }
    });

    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now;
      const { setPlayerState, setPhysicsEngine } =
        useCheckPointStore.getState();
      setPlayerState({
        position: physicsEngine.getPosition("player"),
        velocity: playerState.linearVelocity.clone(),
        rotation: playerState.rotation,
        onGround: player.onGround,
        tiltX: playerState.tiltX,
        tiltZ: playerState.tiltZ,
        tiltVelocityX: playerState.tiltVelocityX,
        tiltVelocityZ: playerState.tiltVelocityZ,
        centerOfMass: playerState.centerOfMass,
        supportPoint: playerState.supportPoint,
        weight: weight,
        weightFactor: weight / 70,
      });
      setPhysicsEngine(physicsEngine);
    }
  });
}
