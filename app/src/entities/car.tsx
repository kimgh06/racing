import { useFrame } from "@react-three/fiber";
import { RigidBody, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Ray } from "@dimforge/rapier3d-compat";
import {
  forwardRef,
  RefObject,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  Object3D,
  Vector3,
  Quaternion,
  Euler,
  Shape,
  ExtrudeGeometry,
  Mesh,
} from "three";
import { useCarStore } from "~/src/shared/store/carStore";

type CarProps = {
  position?: [number, number, number];
  keyQueue?: RefObject<Record<string, boolean>>; // 입력 큐
  maxHeight?: number; // 최대 높이 제한 (Y 좌표)
};

export type CarHandle = {
  rigidBodyRef: RefObject<RapierRigidBody>;
  followTarget: Object3D;
};

/**
 * Car 컴포넌트 - 차량 본체
 * @param position - 차량의 초기 위치
 */

const Car = forwardRef<CarHandle, CarProps>(function Car(
  { position = [0, 0, 0], keyQueue, maxHeight },
  ref
) {
  const { world } = useRapier();

  // ===============================
  // 카트 튜닝용 상수 (가속/조향/드리프트 등)
  // 여기 숫자들만 바꿔서 전체 핸들링을 쉽게 조절할 수 있음
  // ===============================
  const CAR_TUNING = {
    // 전진/후진 가속
    FORWARD: {
      BASE_ACCEL: 2.5, // 기본 가속도 (클수록 초반 가속이 강해짐)
      MAX_SPEED_FOR_ACCEL: 10.0, // 이 속도 근처에서 가속도 감소
      MAX_ACCEL_FACTOR_AT_MAX_SPEED: 0.7, // 최고 속도에서의 가속도 비율 (1에 가까울수록 고속에서 더 잘 붙음)
    },

    // 드리프트 관련
    DRIFT: {
      SPEED_THRESHOLD: 15.0, // 15 m/s 이하면 드리프트 비활성 (입력 무시)
      ACCEL_MULTIPLIER: 0.2, // 드리프트 중 추진력 배율 (0.2면 20%만 남김)
    },

    // 옆 미끄러짐(사이드 프릭션)
    SIDE_FRICTION: {
      BASE: 0.05, // 직진 시 옆 속도 유지 비율 (0이면 레일달리기, 1이면 완전 미끄럼)
      STEER: 0.1, // 조향 중 옆 속도 유지 비율
      DRIFT: 0.6, // 드리프트 중 옆 속도 유지 비율
    } as {
      BASE: number;
      STEER: number;
      DRIFT: number;
    },

    // 조향 토크/드리프트 회전
    STEER: {
      TORQUE_MULTIPLIER: 2.0, // 기본 조향 토크 배율 (클수록 전체 회전이 강해짐)
      DRIFT_TORQUE_MULTIPLIER: 5.0, // 드리프트 중 추가 회전 배율
      MAX_TORQUE: {
        NORMAL: {
          LOW_SPEED: 5.0,
          HIGH_SPEED: 3.0,
        },
        DRIFT: {
          LOW_SPEED: 8.0,
          HIGH_SPEED: 6.0,
        },
      },
    },
  } as const;

  // 물리적 키 위치 기반 매핑 (한/영 상태 무관)
  const KEY_ALIAS = {
    FORWARD: ["KeyI"], // I 키
    BACKWARD: ["KeyK"], // K 키
    LEFT: ["KeyJ"], // J 키
    RIGHT: ["KeyL"], // L 키
    DRIFT: ["KeyD"], // D 키
  } as const;

  const isKeyPressed = (
    keys: Record<string, boolean>,
    aliases: readonly string[]
  ) => aliases.some((k) => keys[k]);

  const cartbodyRef = useRef<RapierRigidBody>(null);
  const followTarget = useRef(new Object3D()).current;
  const steerAngle = useRef(0);
  const targetSpeed = useRef(0);
  const prevTargetSpeed = useRef(0); // 이전 프레임의 targetSpeed (방향 전환 감지용)
  const canJump = useRef(true); // 점프 가능 여부
  const jumpCooldown = useRef(0); // 점프 쿨다운

  // 충돌 감지 상태
  const objectHit = useRef(false); // 어떤 물체와든 현재 접촉 중인지
  const contactCount = useRef(0); // 어떤 물체와든 현재 접촉 중인 개수
  const groundContactCount = useRef(0); // 바닥 충돌만 카운트

  const groundNormal = useRef({ x: 0, y: 1, z: 0 });
  const groundContactPoint = useRef<{ x: number; y: number; z: number } | null>(
    null
  );

  // 드리프트 게이지 계산용
  const driftStartTime = useRef<number | null>(null); // 드리프트 시작 시간
  const prevSpeed = useRef(0); // 이전 프레임의 속도 (가속도 계산용)
  const driftGaugeValue = useRef(0); // 드리프트 게이지 누적 값

  // Zustand store
  const {
    setPosition,
    setSpeed,
    setCollision,
    setDriftMode,
    setScore,
    setDriftGauge,
    setDetectedDistance,
    setDetectedObject,
    incrementScore,
  } = useCarStore();

  // 잡기 감지 관련 상태
  const detectedObject = useRef<RapierRigidBody | null>(null); // 감지된 오브젝트

  // 잡기 감지 설정
  const GRAB_DETECTION = {
    MAX_DISTANCE: 2.0, // 최대 감지 거리 (2m)
    ANGLE: (120 * Math.PI) / 180, // 120도 (라디안)
  } as const;

  // 호버보드 설정
  const GROUND_OFFSET = 0.05; // 바닥에서의 오프셋 (더 낮게 띄우기 위해 기존 0.05 → 0.03)
  const MAX_HEIGHT = maxHeight ?? Infinity; // 최대 높이 제한
  const MAX_HEIGHT_DIFF = 2.0; // 최대 높이 차이 (이 이상 차이나면 힘 제한)

  // followTarget 위치 설정
  followTarget.position.set(0, 0.5, 0);

  // 부채꼴 시각화용 ref
  const sectorRef = useRef<Mesh>(null);

  // 카트바디 초기화: 위치와 속도 명시적 설정 (Joint 생성 타이밍 문제 해결)
  const initFrameCount = useRef(0);
  useEffect(() => {
    if (cartbodyRef.current) {
      // 초기 위치 명시적 설정
      cartbodyRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );

      // 초기 속도/각속도 0으로 설정
      cartbodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      cartbodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, [position]);

  // ===============================
  // 물리 로직 함수들
  // ===============================

  // 1. 호버보드 로직: 바닥/벽 충돌 시 높이 유지
  const handleHoverboardLogic = (delta: number) => {
    if (
      !cartbodyRef.current ||
      !objectHit.current ||
      jumpCooldown.current > 0
    ) {
      return;
    }

    const currentPos = cartbodyRef.current.translation();
    const isGround = groundNormal.current.y > 0.7;

    let targetY: number;
    if (isGround && groundContactPoint.current) {
      targetY = groundContactPoint.current.y + GROUND_OFFSET;
    } else {
      targetY = currentPos.y + GROUND_OFFSET;
    }

    const heightDiff = targetY - currentPos.y;

    if (heightDiff > -0.05) {
      const clampedHeightDiff = Math.min(
        Math.max(heightDiff, 0),
        MAX_HEIGHT_DIFF
      );

      const forceStrength = Math.max(
        clampedHeightDiff * delta * 200,
        2.0 * delta
      );

      if (MAX_HEIGHT === Infinity || currentPos.y < MAX_HEIGHT) {
        let impulse: Vector3;

        if (isGround) {
          const normalLength = Math.sqrt(
            groundNormal.current.x ** 2 +
              groundNormal.current.y ** 2 +
              groundNormal.current.z ** 2
          );

          if (normalLength > 0.01) {
            const normalizedNormal = {
              x: groundNormal.current.x / normalLength,
              y: groundNormal.current.y / normalLength,
              z: groundNormal.current.z / normalLength,
            };

            impulse = new Vector3(
              normalizedNormal.x * forceStrength,
              normalizedNormal.y * forceStrength,
              normalizedNormal.z * forceStrength
            );
          } else {
            impulse = new Vector3(0, forceStrength, 0);
          }
        } else {
          impulse = new Vector3(0, forceStrength, 0);
        }

        cartbodyRef.current.applyImpulse(impulse, true);
      }
    }

    const linvel = cartbodyRef.current.linvel();
    if (linvel.y > 3.0) {
      cartbodyRef.current.setLinvel({ x: linvel.x, y: 3.0, z: linvel.z }, true);
    }
  };

  // 2. 입력 처리: 가속, 조향, 점프
  const handleInput = (delta: number) => {
    if (!keyQueue?.current) return;

    const keys = keyQueue.current;

    // 공중에 떠 있으면 앞뒤 조작 불가
    if (!objectHit.current) {
      targetSpeed.current *= 0.9;
    } else {
      const isForward = isKeyPressed(keys, KEY_ALIAS.FORWARD);
      const isBackward = isKeyPressed(keys, KEY_ALIAS.BACKWARD);

      if (isForward) {
        targetSpeed.current = 10.0;
      } else if (isBackward) {
        targetSpeed.current = -5.0;
      } else {
        targetSpeed.current *= 0.9;
      }
    }

    // 조향 입력
    const isSteeringLeft = isKeyPressed(keys, KEY_ALIAS.LEFT);
    const isSteeringRight = isKeyPressed(keys, KEY_ALIAS.RIGHT);

    if (isSteeringLeft) {
      steerAngle.current += 3.0 * delta;
    } else if (isSteeringRight) {
      steerAngle.current -= 3.0 * delta;
    } else {
      // 조향 키를 누르지 않으면 0으로 복귀
      steerAngle.current = 0;
    }

    // 점프 입력 처리
    const isJumpPressed = keys["Space"]; // Space 키 (물리적 키 위치)

    if (jumpCooldown.current > 0) {
      jumpCooldown.current -= delta;
    } else {
      canJump.current = true;
    }

    if (
      isJumpPressed &&
      objectHit.current &&
      canJump.current &&
      jumpCooldown.current <= 0 &&
      cartbodyRef.current
    ) {
      const JUMP_FORCE = 5.0;
      cartbodyRef.current.applyImpulse({ x: 0, y: JUMP_FORCE, z: 0 }, true);

      jumpCooldown.current = 0.5;
      canJump.current = false;
    }

    const MAX_STEER = Math.PI / 4;
    steerAngle.current = Math.max(
      -MAX_STEER,
      Math.min(MAX_STEER, steerAngle.current)
    );
  };

  // 3. 방향 전환 처리: 갑작스런 반대 방향 입력 시 속도 전환
  const handleDirectionReversal = (forward: Vector3) => {
    if (!objectHit.current || !cartbodyRef.current) return;

    const wasMovingForward = prevTargetSpeed.current > 0.1;
    const wasMovingBackward = prevTargetSpeed.current < -0.1;
    const isReversing = targetSpeed.current < -0.1;
    const isForwarding = targetSpeed.current > 0.1;

    const vel = cartbodyRef.current.linvel();
    const speedForward = vel.x * forward.x + vel.z * forward.z;

    if (wasMovingForward && isReversing && speedForward > 1.0) {
      const reverseSpeed = -speedForward * 0.3;
      const newVel = {
        x: vel.x - forward.x * speedForward + forward.x * reverseSpeed,
        y: vel.y,
        z: vel.z - forward.z * speedForward + forward.z * reverseSpeed,
      };
      cartbodyRef.current.setLinvel(newVel, true);
    }

    if (wasMovingBackward && isForwarding && speedForward < -1.0) {
      const forwardSpeed = -speedForward * 0.5;
      const newVel = {
        x: vel.x - forward.x * speedForward + forward.x * forwardSpeed,
        y: vel.y,
        z: vel.z - forward.z * speedForward + forward.z * forwardSpeed,
      };
      cartbodyRef.current.setLinvel(newVel, true);
    }

    prevTargetSpeed.current = targetSpeed.current;
  };

  // 4. 횡방향 마찰 처리
  // 경사면에서는 Y 성분 손실을 방지하기 위해 평평한 바닥에서만 작동
  const handleSideFriction = (forward: Vector3) => {
    if (
      !objectHit.current ||
      groundNormal.current.y < 0.95 || // 평평한 바닥에서만 작동 (경사면 제외)
      !cartbodyRef.current
    ) {
      return;
    }

    const vel = cartbodyRef.current.linvel();
    const speedForward = vel.x * forward.x + vel.z * forward.z;
    const velForward = {
      x: forward.x * speedForward,
      y: 0,
      z: forward.z * speedForward,
    };
    const velSide = {
      x: vel.x - velForward.x,
      y: 0,
      z: vel.z - velForward.z,
    };

    const isSteeringActive =
      keyQueue?.current &&
      (isKeyPressed(keyQueue.current, KEY_ALIAS.LEFT) ||
        isKeyPressed(keyQueue.current, KEY_ALIAS.RIGHT));

    const isDriftModeSide =
      objectHit.current &&
      Math.sqrt(vel.x ** 2 + vel.z ** 2) > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
      keyQueue?.current &&
      isKeyPressed(keyQueue.current, KEY_ALIAS.DRIFT);

    const baseSideFriction = CAR_TUNING.SIDE_FRICTION.BASE;
    let sideFriction = baseSideFriction;
    if (isDriftModeSide) {
      sideFriction = CAR_TUNING.SIDE_FRICTION.DRIFT;
    } else if (isSteeringActive) {
      sideFriction = CAR_TUNING.SIDE_FRICTION.STEER;
    }

    let newVel = {
      x: velForward.x + velSide.x * sideFriction,
      y: vel.y,
      z: velForward.z + velSide.z * sideFriction,
    };

    // 드리프트 중에는 전후 속도에 추가 감속을 걸어 더 빠르게 감속
    if (isDriftModeSide) {
      const driftBrakeFactor = 0.995; // 값이 작을수록 더 강한 감속 (0.995이면 매 프레임 0.5% 감소)
      newVel = {
        x: newVel.x * driftBrakeFactor,
        y: newVel.y,
        z: newVel.z * driftBrakeFactor,
      };
    }

    cartbodyRef.current.setLinvel(newVel, true);
  };

  // 5. 이동 힘 계산 및 적용
  const handleMoveForce = (forward: Vector3, delta: number) => {
    if (!cartbodyRef.current) return;

    const velForAccel = cartbodyRef.current.linvel();
    const speedForAccel = Math.sqrt(velForAccel.x ** 2 + velForAccel.z ** 2);

    const isDriftModeAccel =
      objectHit.current &&
      speedForAccel > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
      keyQueue?.current &&
      isKeyPressed(keyQueue.current, KEY_ALIAS.DRIFT);

    let effectiveSpeed = targetSpeed.current;
    if (isDriftModeAccel) {
      effectiveSpeed *= CAR_TUNING.DRIFT.ACCEL_MULTIPLIER;
    }

    // 경사면(평평하지 않은 바닥)에서는 가속을 줄이기
    // groundNormal.y가 1에 가까울수록 평지, 0.7~0.99 사이를 경사면으로 간주
    const isOnSlope =
      objectHit.current &&
      groundNormal.current.y > 0.7 &&
      groundNormal.current.y < 0.99;
    if (isOnSlope) {
      // 경사면에서는 가속을 더 강하게 줄이기 (경사 심할수록 더 약하게)
      const rawFactor = groundNormal.current.y * 0.6; // 기본적으로 60%로 축소
      const slopeFactor = Math.max(0.25, rawFactor); // 최소 0.25까지 떨어뜨림
      effectiveSpeed *= slopeFactor;
    }

    const baseAccel = CAR_TUNING.FORWARD.BASE_ACCEL;
    const maxSpeedFactor = CAR_TUNING.FORWARD.MAX_ACCEL_FACTOR_AT_MAX_SPEED;
    const speedRatio = Math.min(
      speedForAccel / CAR_TUNING.FORWARD.MAX_SPEED_FOR_ACCEL,
      1.0
    );
    const accelFactor = baseAccel * (1.0 - speedRatio * (1.0 - maxSpeedFactor));

    const moveForce = new Vector3(
      forward.x * effectiveSpeed * accelFactor,
      0,
      forward.z * effectiveSpeed * accelFactor
    );

    cartbodyRef.current.applyImpulse(
      {
        x: moveForce.x * delta,
        y: moveForce.y * delta,
        z: moveForce.z * delta,
      },
      true
    );
  };

  // 6. 스텝 스냅: 낮은 계단 오르기
  const handleStepSnap = (forward: Vector3) => {
    if (
      !targetSpeed.current ||
      !objectHit.current ||
      !groundContactPoint.current ||
      groundNormal.current.y <= 0.7 ||
      !cartbodyRef.current
    ) {
      return;
    }

    const currentPos = cartbodyRef.current.translation();
    const frontPos = {
      x: currentPos.x + forward.x * 0.6,
      y: currentPos.y + 0.01,
      z: currentPos.z + forward.z * 0.6,
    };
    const downDir = { x: 0.0, y: -1.0, z: 0.0 };

    const stepRay = new Ray(frontPos, downDir);
    const stepHit = world.castRay(stepRay, 1.0, true);

    if (stepHit) {
      const hitY = frontPos.y + downDir.y * stepHit.timeOfImpact;
      const currentGroundY = groundContactPoint.current.y;
      const stepHeight = hitY - currentGroundY;
      const MAX_STEP_HEIGHT = 0.1;

      if (stepHeight > 0 && stepHeight < MAX_STEP_HEIGHT) {
        const linvel = cartbodyRef.current.linvel();
        cartbodyRef.current.setTranslation(
          {
            x: currentPos.x,
            y: hitY + GROUND_OFFSET,
            z: currentPos.z,
          },
          true
        );
        // 경사면에서는 Y 속도를 보존 (평평한 바닥에서만 Y 속도를 0으로)
        if (groundNormal.current.y > 0.95) {
          // 평평한 바닥: Y 속도를 0으로 설정
          cartbodyRef.current.setLinvel(
            { x: linvel.x, y: 0, z: linvel.z },
            true
          );
        } else {
          // 경사면: Y 속도 보존 (경사면을 올라가는 속도 유지)
          cartbodyRef.current.setLinvel(
            { x: linvel.x, y: linvel.y, z: linvel.z },
            true
          );
        }
      }
    }
  };

  // 7. 조향 토크 처리 (단순화 버전)
  // - 속도/드리프트별 토크 계산 제거
  // - 단순히 steerAngle과 진행 방향(전진/후진)에 따라 Y축 각속도만 설정
  const handleSteeringTorque = (currentQuat: Quaternion, delta: number) => {
    if (!cartbodyRef.current) return;

    const angvel = cartbodyRef.current.angvel();
    const currentVel = cartbodyRef.current.linvel();
    const currentSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);

    const isSteeringActive =
      keyQueue?.current &&
      (isKeyPressed(keyQueue.current, KEY_ALIAS.LEFT) ||
        isKeyPressed(keyQueue.current, KEY_ALIAS.RIGHT));

    // 조향 키가 없으면 Y축 회전을 서서히 감쇠
    if (!isSteeringActive || Math.abs(steerAngle.current) < 0.01) {
      cartbodyRef.current.setAngvel(
        {
          x: angvel.x,
          y: angvel.y * 0.8, // 부드럽게 감쇠
          z: angvel.z,
        },
        true
      );
      return;
    }

    // 단순 조향 속도: steerAngle에 비례
    // 기본 회전 상수를 키워 전체적으로 더 잘 꺾이도록 조정
    const baseYawSpeed = 1.0; // 기본 회전 속도 (값이 클수록 더 빠르게 회전)

    // 속도의 로그에 반비례하는 계수 (일반 주행용: 빠를수록 회전 덜 하도록)
    // log(속도+1)가 1 이하일 때는 1로 클램프해서 저속에서는 풀 회전
    const speedForTurn = Math.max(0, currentSpeed);
    const logSpeed = Math.log(speedForTurn + 1); // 자연로그 사용
    const invSpeedFactor = 1 / Math.max(1, logSpeed);

    // 기본: 일반 주행일 때는 속도(log)에 반비례
    let yawSpeed = steerAngle.current * baseYawSpeed * invSpeedFactor;

    // 드리프트 중이면: 좌우 회전을 "속도 로그 값"에 비례하도록 변경
    const isDriftSteerMode =
      objectHit.current &&
      keyQueue?.current &&
      isKeyPressed(keyQueue.current, KEY_ALIAS.DRIFT);
    if (isDriftSteerMode) {
      const driftYawMultiplier = 0.8; // 드리프트 시 기본 회전 배율 (더 강하게 조향)
      // 속도 로그 값(log(speed+1))에 비례: 빠를수록 더 많이 꺾이되 완만하게 증가
      const driftLogSpeed = Math.log(speedForTurn + 1);
      const driftSpeedFactor = Math.min(driftLogSpeed, 5); // 상한으로 과한 폭주 방지

      yawSpeed =
        steerAngle.current *
        baseYawSpeed *
        driftYawMultiplier *
        driftSpeedFactor;
    }

    // 후진 입력일 때는 반대로 회전
    if (targetSpeed.current < 0) {
      yawSpeed = -yawSpeed;
    }

    cartbodyRef.current.setAngvel(
      {
        x: angvel.x,
        y: yawSpeed,
        z: angvel.z,
      },
      true
    );
  };

  // 8. 경사면 정렬
  const handleSlopeAlignment = (delta: number) => {
    if (
      !objectHit.current ||
      groundNormal.current.y <= 0.7 ||
      groundNormal.current.y >= 0.99 ||
      !cartbodyRef.current
    ) {
      return;
    }

    const up = new Vector3(0, 1, 0);
    const targetUp = new Vector3(
      groundNormal.current.x,
      groundNormal.current.y,
      groundNormal.current.z
    );
    const rotationAxis = new Vector3().crossVectors(up, targetUp).normalize();
    const rotationAngle = Math.acos(
      Math.max(-1, Math.min(1, up.dot(targetUp)))
    );

    if (rotationAngle > 0.01) {
      cartbodyRef.current.applyTorqueImpulse(
        {
          x: rotationAxis.x * rotationAngle * 0.5 * delta,
          y: rotationAxis.y * rotationAngle * 0.5 * delta,
          z: rotationAxis.z * rotationAngle * 0.5 * delta,
        },
        true
      );
    }
  };

  // 9. 뒤집힘 복구
  const handleUpsideDownRecovery = (currentQuat: Quaternion, delta: number) => {
    if (!objectHit.current || !cartbodyRef.current) return;

    const carUp = new Vector3(0, 1, 0);
    carUp.applyQuaternion(currentQuat);

    const upsideDownThreshold = 0.3;

    if (carUp.y < upsideDownThreshold) {
      const targetUp = new Vector3(0, 1, 0);
      const rotationAxis = new Vector3().crossVectors(carUp, targetUp);
      const rotationAngle = Math.acos(
        Math.max(-1, Math.min(1, carUp.dot(targetUp)))
      );

      if (rotationAngle > 0.01 && rotationAxis.length() > 0.01) {
        rotationAxis.normalize();

        const recoveryStrength = 5.0;
        cartbodyRef.current.applyTorqueImpulse(
          {
            x: rotationAxis.x * rotationAngle * recoveryStrength * delta,
            y: rotationAxis.y * rotationAngle * recoveryStrength * delta,
            z: rotationAxis.z * rotationAngle * recoveryStrength * delta,
          },
          true
        );
      }
    }
  };

  // 10. 각속도 제한
  const limitAngularVelocity = () => {
    if (!cartbodyRef.current) return;

    const angvel = cartbodyRef.current.angvel();
    const maxAngvel = 5.0;
    const maxPitchAngvel = 10.0;
    cartbodyRef.current.setAngvel(
      {
        x: Math.max(-maxPitchAngvel, Math.min(maxPitchAngvel, angvel.x)),
        y: Math.max(-maxAngvel, Math.min(maxAngvel, angvel.y)),
        z: Math.max(-maxAngvel, Math.min(maxAngvel, angvel.z)),
      },
      true
    );
  };

  // 11. 상태 패널 업데이트
  const updateDisplayPanel = (delta: number) => {
    if (!cartbodyRef.current) return;

    const vel = cartbodyRef.current.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
    const currentPos = cartbodyRef.current.translation();

    // Zustand store 업데이트
    setSpeed(Math.round(speed * 10) / 10);
    setCollision(objectHit.current);
    setPosition({ x: currentPos.x, y: currentPos.y, z: currentPos.z });

    // 드리프트 모드 확인
    const isDriftActive =
      objectHit.current &&
      speed > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
      keyQueue?.current &&
      isKeyPressed(keyQueue.current, KEY_ALIAS.DRIFT)
        ? true
        : false;
    setDriftMode(isDriftActive);

    // 좌우 회전 중인지 확인
    const isSteeringActive =
      keyQueue?.current &&
      (isKeyPressed(keyQueue.current, KEY_ALIAS.LEFT) ||
        isKeyPressed(keyQueue.current, KEY_ALIAS.RIGHT));

    // 드리프트 게이지 계산: 속도²에 비례 (누적)
    // 드리프트 모드 + 좌우 회전 중일 때만 게이지 증가
    if (isDriftActive && isSteeringActive && cartbodyRef.current) {
      // 속도 제곱 계산
      const speedSquared = speed * speed;

      // 게이지 증가량 = 속도² × delta × 스케일
      // 속도의 제곱에 비례하여 게이지 증가
      const gaugeIncrease = speedSquared * delta * 0.2; // 스케일링 팩터 0.5

      // 게이지 누적
      driftGaugeValue.current += gaugeIncrease;

      // 0-100 범위로 제한
      driftGaugeValue.current = Math.min(
        100,
        Math.max(0, driftGaugeValue.current)
      );
      if (driftGaugeValue.current >= 100) {
        incrementScore();
        driftGaugeValue.current = 0;
      }
      // 즉시 UI 업데이트 (매 프레임마다)
      setDriftGauge(driftGaugeValue.current);
    } else {
      // 드리프트 모드가 아니면 게이지 유지 (감소하지 않음)
      driftStartTime.current = null;
      prevSpeed.current = speed;
      // 게이지는 그대로 유지 (UI 업데이트는 필요시에만)
    }
  };

  // 12. 오브젝트 감지 로직 (120도 부채꼴 범위)
  // 차량 중심점을 기준으로 전방 120도 범위 내 오브젝트 감지
  const detectGrabableObject = (
    forward: Vector3,
    currentPos: { x: number; y: number; z: number },
    rotateY: number
  ) => {
    if (!cartbodyRef.current) {
      detectedObject.current = null;
      setDetectedObject(false);
      return;
    }

    // 차량 중심점 (RigidBody의 translation은 이미 차량 mesh의 중심을 나타냄)

    // 모든 RigidBody 검색
    let closestObject: RapierRigidBody | null = null;
    let closestDistance: number = GRAB_DETECTION.MAX_DISTANCE;

    let bodyCount = 0;
    let dynamicBodyCount = 0;
    let inRangeCount = 0;
    let inAngleCount = 0;

    world.bodies.forEach((body) => {
      bodyCount++;

      // 자기 자신은 제외
      if (body.handle === cartbodyRef.current!.handle) return;

      // 고정된 오브젝트는 제외
      if (body.isFixed()) return;

      dynamicBodyCount++;

      // RigidBody의 중심점
      const bodyCenter = body.translation();

      // RigidBody의 회전 가져오기
      const bodyRotation = body.rotation();
      const bodyQuat = new Quaternion(
        bodyRotation.x,
        bodyRotation.y,
        bodyRotation.z,
        bodyRotation.w
      );

      // RigidBody의 collider shape 중심을 사용
      // colliders()를 통해 collider 정보를 가져올 수 있지만,
      // 실제로는 body.translation()이 이미 collider의 중심을 반환합니다
      //
      // 하지만 mesh의 position이 RigidBody 중심과 다르다면,
      // RigidBody의 collider shape의 중심과 mesh의 중심이 다를 수 있습니다
      //
      // React Three Rapier에서 RigidBody 내부의 mesh position은 RigidBody 중심을 기준으로 한 상대 위치이므로,
      // body.translation()은 RigidBody의 중심이지 mesh의 중심이 아닐 수 있습니다
      //
      // 해결: body.translation()을 그대로 사용 (이미 collider의 중심)
      // 만약 mesh의 position이 있다면, 그 오프셋을 고려해야 하지만 감지 로직에서는 알 수 없음
      // 따라서 body.translation()을 사용하는 것이 맞습니다 (collider 중심)
      const objectPos = bodyCenter;

      // 차량 중심에서 오브젝트 중심까지의 벡터
      const toObject = new Vector3(
        objectPos.x - currentPos.x,
        objectPos.y - currentPos.y,
        objectPos.z - currentPos.z
      );

      const distance = toObject.length();

      // 감지된 오브젝트와의 거리 업데이트 (미터 단위)
      setDetectedDistance(distance);

      // 거리 체크
      if (distance > GRAB_DETECTION.MAX_DISTANCE) return;

      inRangeCount++;

      // 너무 가까운 경우 (0.1m 이하) 각도 체크 없이 바로 감지
      let isInAngle = false;

      // 방향 체크: 120도 부채꼴 범위 내인지 확인
      // toObject 벡터의 방향 각도를 직접 계산 (XZ 평면)
      // Three.js에서 XZ 평면의 각도는 Math.atan2(x, z)를 사용
      // 하지만 일반적인 좌표계에서는 Math.atan2(z, x)를 사용하므로 확인 필요
      // 차량의 forward가 (0, 0, -1)이므로, 차량이 0도일 때 z축 음의 방향
      // Math.atan2(0, -1) = Math.PI 또는 -Math.PI
      //
      // 실제로는 Math.atan2(x, z)가 맞습니다 (XZ 평면에서)
      const toObjectAngle = Math.atan2(toObject.x, toObject.z);

      // 차량의 Y 회전 각도와의 차이 계산 (정규화)
      let angleDiff = toObjectAngle - rotateY;
      // -PI ~ PI 범위로 정규화
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      // 절댓값으로 변환
      angleDiff = Math.abs(angleDiff);

      // 디버깅: 각도 계산 확인
      if (Math.random() < 0.01 && distance < GRAB_DETECTION.MAX_DISTANCE) {
        console.log("각도 디버그:", {
          toObject: {
            x: toObject.x.toFixed(2),
            z: toObject.z.toFixed(2),
          },
          toObjectAngle: ((toObjectAngle * 180) / Math.PI).toFixed(1) + "도",
          차량Y회전: ((rotateY * 180) / Math.PI).toFixed(1) + "도",
          각도차이: ((angleDiff * 180) / Math.PI).toFixed(1) + "도",
          범위내: angleDiff <= GRAB_DETECTION.ANGLE / 2,
        });
      }

      // 120도 = 60도씩 양쪽 (총 120도)
      // 각도 차이가 60도 이하이면 범위 내
      isInAngle = angleDiff <= GRAB_DETECTION.ANGLE / 2;

      if (isInAngle || distance < 0.3) {
        inAngleCount++;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestObject = body;
        }
      }
    });

    // 디버깅용 (주석 처리 가능)
    if (bodyCount > 0 && Math.random() < 0.01) {
      // 1% 확률로 로그 출력 (성능 고려)
      console.log("감지 디버그:", {
        전체오브젝트: bodyCount,
        동적오브젝트: dynamicBodyCount,
        범위내: inRangeCount,
        각도내: inAngleCount,
        감지됨: closestObject !== null,
        forward: {
          x: forward.x.toFixed(2),
          y: forward.y.toFixed(2),
          z: forward.z.toFixed(2),
        },
        차량위치: {
          x: currentPos.x.toFixed(2),
          y: currentPos.y.toFixed(2),
          z: currentPos.z.toFixed(2),
        },
      });
    }

    // 감지된 오브젝트 업데이트
    detectedObject.current = closestObject;
    setDetectedObject(closestObject !== null);
  };

  // 초기 몇 프레임 동안 카트바디 위치 강제 고정 (들썩거림 방지)
  useFrame((state, delta) => {
    if (initFrameCount.current < 10 && cartbodyRef.current) {
      // 초기 10프레임 동안 위치와 속도 강제 고정
      cartbodyRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true
      );
      cartbodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      cartbodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      initFrameCount.current++;
      return;
    }

    if (!cartbodyRef.current) return;

    // 현재 회전 가져오기
    const currentRot = cartbodyRef.current.rotation();
    const currentQuat = new Quaternion(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w
    );

    // 이동 방향 계산
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(currentQuat);

    // 현재 위치 가져오기
    const currentPos = cartbodyRef.current.translation();

    // 물리 로직 실행 순서
    handleHoverboardLogic(delta);
    handleInput(delta);
    handleDirectionReversal(forward);
    handleSideFriction(forward);
    handleMoveForce(forward, delta);
    handleStepSnap(forward);
    handleSteeringTorque(currentQuat, delta);
    handleSlopeAlignment(delta);
    handleUpsideDownRecovery(currentQuat, delta);
    limitAngularVelocity();
    updateDisplayPanel(delta);

    // 오브젝트 감지
    detectGrabableObject(forward, currentPos, currentRot.y);
    // 부채꼴 시각화 업데이트 (차량 회전에 맞춰)
    if (sectorRef.current) {
      // 차량의 회전을 부채꼴에 적용
      sectorRef.current.rotation.copy(
        new Euler().setFromQuaternion(currentQuat, "YXZ")
      );
      sectorRef.current.rotation.y += Math.PI / 2;
      sectorRef.current.rotation.x += Math.PI / 2;

      // 차량 위치에 맞춰 이동
      sectorRef.current.position.set(currentPos.x, currentPos.y, currentPos.z);
    }
  });

  const handle = () => ({
    rigidBodyRef: cartbodyRef,
    followTarget,
  });

  useImperativeHandle(ref, handle, []);

  return (
    <>
      <RigidBody
        position={position}
        ref={cartbodyRef}
        type="dynamic"
        canSleep={false}
        restitution={0.01}
        linearDamping={0.3}
        angularDamping={0.8}
        onCollisionEnter={(event) => {
          const otherBody = event.other.rigidBody;
          const otherCollider = event.other.collider;
          // sensor인 경우 (저장점 등) 접촉 상태 계산에서 제외
          if (!otherBody || !otherCollider || otherCollider.isSensor()) return;

          // 어떤 물체와든 접촉이 시작되면 contactCount 증가
          contactCount.current += 1;
          objectHit.current = true; // 어디든 닿고 있으면 true

          // 충돌 지점의 법선 벡터 가져오기
          if (event.manifold) {
            const normal = event.manifold.normal();
            if (normal) {
              groundNormal.current = {
                x: normal.x,
                y: normal.y,
                z: normal.z,
              };

              // 바닥인지 판단하고 바닥 충돌 카운트 관리
              if (normal.y > 0.7) {
                // 바닥 충돌
                groundContactCount.current += 1;
              }

              // 모든 충돌에 대해 contact point 설정 (호버보드 로직용)
              if (cartbodyRef.current) {
                const currentPos = cartbodyRef.current.translation();
                if (normal.y > 0.7) {
                  // 바닥 충돌: 차량 하단 기준
                  groundContactPoint.current = {
                    x: currentPos.x,
                    y: currentPos.y - 0.25, // 차량 하단
                    z: currentPos.z,
                  };
                } else {
                  // 벽 충돌: 현재 위치 기준 (수직 방향 힘만 적용)
                  groundContactPoint.current = {
                    x: currentPos.x,
                    y: currentPos.y, // 현재 위치
                    z: currentPos.z,
                  };
                }
              }
            }
          }
        }}
        onCollisionExit={(event) => {
          const otherBody = event.other.rigidBody;
          const otherCollider = event.other.collider;
          // sensor인 경우 (저장점 등) 접촉 상태 계산에서 제외
          if (!otherBody || !otherCollider || otherCollider.isSensor()) return;

          // 접촉이 끝날 때마다 contactCount 감소
          contactCount.current = Math.max(0, contactCount.current - 1);

          // 벗어난 충돌이 바닥인지 확인 (groundNormal으로 판단)
          if (groundNormal.current.y > 0.7) {
            groundContactCount.current = Math.max(
              0,
              groundContactCount.current - 1
            );
          }

          // 더 이상 어떤 물체와도 닿아있지 않을 때만 false로 전환
          if (contactCount.current === 0) {
            objectHit.current = false;
            groundContactPoint.current = null;
            groundNormal.current = { x: 0, y: 1, z: 0 }; // groundNormal 초기화
            groundContactCount.current = 0;
          } else if (groundContactCount.current === 0) {
            // 바닥 충돌이 없으면 groundContactPoint 초기화
            groundContactPoint.current = null;
            // 벽 충돌만 남아있으면 groundNormal도 초기화
            if (groundNormal.current.y < 0.7) {
              groundNormal.current = { x: 0, y: 1, z: 0 };
            }
          }
        }}
      >
        <primitive object={followTarget} />
        <mesh castShadow>
          <boxGeometry args={[1, 0.5, 2]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </RigidBody>

      {/* 부채꼴 감지 범위 시각화 (물리 엔진 영향 없음, RigidBody 밖에 위치) */}
      {/* <mesh
        ref={sectorRef}
        geometry={sectorGeometry}
        renderOrder={-1} // 다른 오브젝트 뒤에 렌더링
      >
        <meshBasicMaterial
          color={displayDetectedObject ? 0x00ff00 : 0x888888}
          transparent
          opacity={0.3}
          side={2} // DoubleSide
          depthWrite={false} // 깊이 버퍼에 쓰지 않음 (투명도 처리)
        />
      </mesh> */}
    </>
  );
});

export default Car;
