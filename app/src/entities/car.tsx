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
} from "react";
import { Object3D, Vector3, Quaternion, Euler } from "three";
import { Html } from "@react-three/drei";

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
      SPEED_THRESHOLD: 3.0, // 이 속도 이하면 드리프트 비활성 (입력 무시)
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

  // 상태 패널용 상태 관리
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayCollision, setDisplayCollision] = useState(false);
  const [displayDriftMode, setDisplayDriftMode] = useState(false);
  const [driftGauge, setDriftGauge] = useState(0); // 드리프트 게이지 (0-100)

  // 호버보드 설정
  const GROUND_OFFSET = 0.05; // 바닥에서의 오프셋 (최소 0.2 높이)
  const MAX_HEIGHT = maxHeight ?? Infinity; // 최대 높이 제한
  const MAX_HEIGHT_DIFF = 2.0; // 최대 높이 차이 (이 이상 차이나면 힘 제한)

  // followTarget 위치 설정
  followTarget.position.set(0, 0.5, 0);

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
      if (keys["i"] || keys["I"]) {
        targetSpeed.current = 10.0;
      } else if (keys["k"] || keys["K"]) {
        targetSpeed.current = -5.0;
      } else {
        targetSpeed.current *= 0.9;
      }
    }

    // 조향 입력
    const isSteeringLeft = keys["j"] || keys["J"];
    const isSteeringRight = keys["l"] || keys["L"];

    if (isSteeringLeft) {
      steerAngle.current += 3.0 * delta;
    } else if (isSteeringRight) {
      steerAngle.current -= 3.0 * delta;
    } else {
      // 조향 키를 누르지 않으면 0으로 복귀
      steerAngle.current = 0;
    }

    // 점프 입력 처리
    const isJumpPressed = keys[" "] || keys["Space"];

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
      (keyQueue.current["j"] ||
        keyQueue.current["J"] ||
        keyQueue.current["l"] ||
        keyQueue.current["L"]);

    const isDriftModeSide =
      objectHit.current &&
      Math.sqrt(vel.x ** 2 + vel.z ** 2) > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
      keyQueue?.current &&
      (keyQueue.current["D"] || keyQueue.current["d"]);

    const baseSideFriction = CAR_TUNING.SIDE_FRICTION.BASE;
    let sideFriction = baseSideFriction;
    if (isDriftModeSide) {
      sideFriction = CAR_TUNING.SIDE_FRICTION.DRIFT;
    } else if (isSteeringActive) {
      sideFriction = CAR_TUNING.SIDE_FRICTION.STEER;
    }

    const newVel = {
      x: velForward.x + velSide.x * sideFriction,
      y: vel.y,
      z: velForward.z + velSide.z * sideFriction,
    };

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
      (keyQueue.current["D"] || keyQueue.current["d"]);

    let effectiveSpeed = targetSpeed.current;
    if (isDriftModeAccel) {
      effectiveSpeed *= CAR_TUNING.DRIFT.ACCEL_MULTIPLIER;
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

  // 7. 조향 토크 처리
  const handleSteeringTorque = (currentQuat: Quaternion, delta: number) => {
    if (!cartbodyRef.current) return;

    const currentVel = cartbodyRef.current.linvel();
    const currentSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);

    const carForward = new Vector3(0, 0, -1);
    carForward.applyQuaternion(currentQuat);
    const velocityDir =
      currentSpeed > 0.1
        ? new Vector3(
            currentVel.x / currentSpeed,
            0,
            currentVel.z / currentSpeed
          )
        : carForward;
    const isReversing = carForward.dot(velocityDir) < 0;

    const isSteeringActive =
      keyQueue?.current &&
      (keyQueue.current["j"] ||
        keyQueue.current["J"] ||
        keyQueue.current["l"] ||
        keyQueue.current["L"]);

    if (!isSteeringActive) {
      const angvel = cartbodyRef.current.angvel();
      cartbodyRef.current.setAngvel(
        {
          x: angvel.x,
          y: 0,
          z: angvel.z,
        },
        true
      );
      steerAngle.current = 0;
      return;
    }

    if (isSteeringActive && Math.abs(steerAngle.current) > 0.01) {
      if (currentSpeed > 0.1) {
        const speedFactor = Math.max(
          currentSpeed / CAR_TUNING.FORWARD.MAX_SPEED_FOR_ACCEL,
          0.3
        );
        let torqueStrength =
          steerAngle.current * speedFactor * CAR_TUNING.STEER.TORQUE_MULTIPLIER;

        const speedDamping = Math.min(1.0, 5.0 / currentSpeed);
        const speedBoost = Math.max(1.0, 3.0 / currentSpeed);
        torqueStrength *= speedDamping * speedBoost;

        const isDriftModeSteer =
          objectHit.current &&
          currentSpeed > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
          keyQueue?.current &&
          (keyQueue.current["D"] || keyQueue.current["d"]);

        if (isDriftModeSteer) {
          torqueStrength *= CAR_TUNING.STEER.DRIFT_TORQUE_MULTIPLIER;
        }

        const maxTorque = isDriftModeSteer
          ? currentSpeed < CAR_TUNING.DRIFT.SPEED_THRESHOLD
            ? CAR_TUNING.STEER.MAX_TORQUE.DRIFT.LOW_SPEED
            : CAR_TUNING.STEER.MAX_TORQUE.DRIFT.HIGH_SPEED
          : currentSpeed < CAR_TUNING.DRIFT.SPEED_THRESHOLD
          ? CAR_TUNING.STEER.MAX_TORQUE.NORMAL.LOW_SPEED
          : CAR_TUNING.STEER.MAX_TORQUE.NORMAL.HIGH_SPEED;
        torqueStrength = Math.max(
          -maxTorque,
          Math.min(maxTorque, torqueStrength)
        );

        if (isReversing) {
          torqueStrength = -torqueStrength;
        }

        cartbodyRef.current.applyTorqueImpulse(
          {
            x: 0,
            y: torqueStrength * delta,
            z: 0,
          },
          true
        );
      } else {
        let torqueStrength = steerAngle.current * 0.5;
        if (targetSpeed.current < 0) {
          torqueStrength = -torqueStrength;
        }

        cartbodyRef.current.applyTorqueImpulse(
          {
            x: 0,
            y: torqueStrength * delta,
            z: 0,
          },
          true
        );
      }
    }
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
    setDisplaySpeed(Math.round(speed * 10) / 10);
    setDisplayCollision(objectHit.current);

    // 드리프트 모드 확인
    const isDriftActive =
      objectHit.current &&
      speed > CAR_TUNING.DRIFT.SPEED_THRESHOLD &&
      keyQueue?.current &&
      (keyQueue.current["D"] || keyQueue.current["d"])
        ? true
        : false;
    setDisplayDriftMode(isDriftActive);

    // 드리프트 게이지 계산: 속도²에 비례 (누적)
    if (isDriftActive && cartbodyRef.current) {
      // 속도 제곱 계산
      const speedSquared = speed * speed;

      // 게이지 증가량 = 속도² × delta × 스케일
      // 속도의 제곱에 비례하여 게이지 증가
      const gaugeIncrease = speedSquared * delta * 0.1; // 스케일링 팩터 0.1

      // 게이지 누적
      driftGaugeValue.current += gaugeIncrease;

      // 0-100 범위로 제한
      driftGaugeValue.current = Math.min(
        100,
        Math.max(0, driftGaugeValue.current)
      );
      setDriftGauge(driftGaugeValue.current);
    } else {
      // 드리프트 모드가 아니면 게이지 유지 (감소하지 않음)
      driftStartTime.current = null;
      prevSpeed.current = speed;
      // 게이지는 그대로 유지
      setDriftGauge(driftGaugeValue.current);
    }
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

        {/* 차량 상태 패널 (차량 뒤쪽) */}
        <Html
          position={[0, 0, 1.5]} // 차량 뒤쪽, 차량과 같은 높이
          center
          distanceFactor={5}
          style={{
            transition: "all 0.2s",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0, 0, 0, 0.8)",
              color: "white",
              padding: "12px 20px",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "14px",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.5)",
              minWidth: "150px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Speed:</span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: displaySpeed > 5 ? "#ff6b6b" : "#4ecdc4",
                  }}
                >
                  {displaySpeed.toFixed(1)} m/s
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Collusion:</span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: displayCollision ? "#ffd93d" : "#95e1d3",
                  }}
                >
                  {displayCollision ? "Touching" : "Air"}
                </span>
              </div>
              {/* 드리프트 모드 표시 */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Drift:</span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: displayDriftMode ? "#ffd93d" : "#95e1d3",
                  }}
                >
                  {displayDriftMode ? "Drift" : "Normal"}
                </span>
              </div>
              {/* 드리프트 게이지 */}
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              <div
                style={{
                  width: `${driftGauge}%`,
                  height: "100%",
                  background:
                    driftGauge > 70
                      ? "linear-gradient(90deg, #ff6b6b, #ffd93d)"
                      : driftGauge > 40
                      ? "linear-gradient(90deg, #ffd93d, #ffed4e)"
                      : "linear-gradient(90deg, #95e1d3, #4ecdc4)",
                  transition: "width 0.1s ease-out, background 0.1s ease-out",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>
        </Html>
      </RigidBody>
    </>
  );
});

export default Car;
