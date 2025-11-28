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
} from "react";
import { Object3D, Vector3, Quaternion, Euler } from "three";

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
  const groundNormal = useRef({ x: 0, y: 1, z: 0 });
  const groundContactPoint = useRef<{ x: number; y: number; z: number } | null>(
    null
  );

  // 호버보드 설정
  const GROUND_OFFSET = 0.2; // 바닥에서의 오프셋 (최소 0.2 높이)
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

    // 1. 충돌 기반 호버보드 로직
    // 어떤 물체와든 충돌 중일 때만 바닥 밀어내기 힘 적용
    // 점프 중일 때는 호버보드 로직 비활성화 (점프 쿨다운 중이면 비활성화)
    if (
      objectHit.current &&
      groundContactPoint.current &&
      jumpCooldown.current <= 0
    ) {
      const currentPos = cartbodyRef.current.translation();
      const targetY = groundContactPoint.current.y + GROUND_OFFSET;
      const heightDiff = targetY - currentPos.y;

      // 차량이 목표 높이보다 아래에 있거나, 목표 높이 근처에 있을 때 힘 적용 (통통거림 방지)
      if (heightDiff > -0.05) {
        // 높이 차이에 한계를 둠
        const clampedHeightDiff = Math.min(
          Math.max(heightDiff, 0),
          MAX_HEIGHT_DIFF
        );

        // heightDiff에 비례한 힘 적용 (최소 힘 유지)
        const forceStrength = Math.max(
          clampedHeightDiff * delta * 200, // 힘 강도 증가
          2.0 * delta // 최소 힘 유지 (통통거림 방지)
        );

        // MAX_HEIGHT 제한 확인
        if (MAX_HEIGHT === Infinity || currentPos.y < MAX_HEIGHT) {
          // 경사면 법선 방향으로 힘 적용 (경사면을 따라 올라가기)
          const normalLength = Math.sqrt(
            groundNormal.current.x ** 2 +
              groundNormal.current.y ** 2 +
              groundNormal.current.z ** 2
          );

          if (normalLength > 0.01) {
            // 법선 벡터 정규화
            const normalizedNormal = {
              x: groundNormal.current.x / normalLength,
              y: groundNormal.current.y / normalLength,
              z: groundNormal.current.z / normalLength,
            };

            const impulse = new Vector3(
              normalizedNormal.x * forceStrength,
              normalizedNormal.y * forceStrength,
              normalizedNormal.z * forceStrength
            );
            cartbodyRef.current.applyImpulse(impulse, true);
          } else {
            // 법선이 유효하지 않으면 수직 방향으로 힘 적용
            const impulse = new Vector3(0, forceStrength, 0);
            cartbodyRef.current.applyImpulse(impulse, true);
          }
        }
      }

      // 속도 제어: 위로 올라가는 속도가 너무 크면 제한 (통통거림 방지)
      // 단, 점프 중이 아닐 때만 제한 (점프 쿨다운 중이면 제한하지 않음)
      const linvel = cartbodyRef.current.linvel();
      if (linvel.y > 3.0) {
        cartbodyRef.current.setLinvel(
          { x: linvel.x, y: 3.0, z: linvel.z },
          true
        );
      }
    }

    // 3. 입력 처리
    if (keyQueue?.current) {
      const keys = keyQueue.current;

      // 공중에 떠 있으면 앞뒤 조작 불가
      if (!objectHit.current) {
        // 공중에서는 속도만 감소 (입력 무시)
        targetSpeed.current *= 0.9;
      } else {
        // 바닥에 닿아 있을 때만 앞뒤 입력 처리
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
        // 버튼을 누르고 있지 않을 때는 즉시 0으로 복귀
        steerAngle.current = 0;
      }

      // 점프 입력 (스페이스바)
      const isJumpPressed = keys[" "] || keys["Space"];

      // 점프 쿨다운 감소
      if (jumpCooldown.current > 0) {
        jumpCooldown.current -= delta;
      } else {
        canJump.current = true;
      }

      // 점프 처리: 바닥에 닿아있고, 점프 가능하고, 점프 키를 눌렀을 때
      if (
        isJumpPressed &&
        objectHit.current &&
        canJump.current &&
        jumpCooldown.current <= 0
      ) {
        const JUMP_FORCE = 5.0; // 점프 힘 증가
        const currentVel = cartbodyRef.current.linvel();

        // 위로 향하는 힘을 impulse로 적용 (더 강력한 점프)
        cartbodyRef.current.applyImpulse(
          {
            x: 0,
            y: JUMP_FORCE, // 위로 향하는 힘
            z: 0,
          },
          true
        );

        // 점프 쿨다운 설정 (0.5초)
        jumpCooldown.current = 0.5;
        canJump.current = false;
      }
    }

    const MAX_STEER = Math.PI / 4;
    steerAngle.current = Math.max(
      -MAX_STEER,
      Math.min(MAX_STEER, steerAngle.current)
    );

    // 4. 현재 회전 가져오기
    const currentRot = cartbodyRef.current.rotation();
    const currentQuat = new Quaternion(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w
    );

    // 5. 이동 방향 계산 (차량의 실제 회전 방향 사용)
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(currentQuat);

    // 5-0. 직진/후진 중 갑작스런 반대 방향 입력 시 축적 에너지를 즉시 반대 방향으로 전환
    if (objectHit.current && cartbodyRef.current) {
      const wasMovingForward = prevTargetSpeed.current > 0.1; // 이전 프레임에서 전진 중
      const wasMovingBackward = prevTargetSpeed.current < -0.1; // 이전 프레임에서 후진 중
      const isReversing = targetSpeed.current < -0.1; // 지금 후진 입력
      const isForwarding = targetSpeed.current > 0.1; // 지금 전진 입력

      // 현재 실제 속도 가져오기
      const vel = cartbodyRef.current.linvel();

      // 전진 방향 성분 계산
      const speedForward = vel.x * forward.x + vel.z * forward.z;

      // 전진 중 후진 입력 시
      if (wasMovingForward && isReversing && speedForward > 1.0) {
        // 전진 속도를 반대 방향으로 즉시 전환 (약간 감쇠 적용)
        const reverseSpeed = -speedForward * 0.3;

        const newVel = {
          x: vel.x - forward.x * speedForward + forward.x * reverseSpeed,
          y: vel.y, // 수직 속도는 유지
          z: vel.z - forward.z * speedForward + forward.z * reverseSpeed,
        };

        cartbodyRef.current.setLinvel(newVel, true);
      }

      // 후진 중 전진 입력 시
      if (wasMovingBackward && isForwarding && speedForward < -1.0) {
        // 후진 속도를 반대 방향으로 즉시 전환 (약간 감쇠 적용)
        const forwardSpeed = -speedForward * 0.5; // speedForward가 음수이므로 -를 붙여서 양수로

        const newVel = {
          x: vel.x - forward.x * speedForward + forward.x * forwardSpeed,
          y: vel.y, // 수직 속도는 유지
          z: vel.z - forward.z * speedForward + forward.z * forwardSpeed,
        };

        cartbodyRef.current.setLinvel(newVel, true);
      }
    }

    // 이전 targetSpeed 저장 (다음 프레임에서 사용)
    prevTargetSpeed.current = targetSpeed.current;

    // 5-1. 횡방향(옆으로) 미끄러짐 감쇠
    if (objectHit.current && groundNormal.current.y > 0.9) {
      const vel = cartbodyRef.current.linvel();

      // 전/후 방향 성분
      const speedForward = vel.x * forward.x + vel.z * forward.z;
      const velForward = {
        x: forward.x * speedForward,
        y: 0,
        z: forward.z * speedForward,
      };

      // 횡방향 성분 (전체 - 전후)
      const velSide = {
        x: vel.x - velForward.x,
        y: 0,
        z: vel.z - velForward.z,
      };

      // 조향 중인지 확인
      const isSteeringActive =
        keyQueue?.current &&
        (keyQueue.current["j"] ||
          keyQueue.current["J"] ||
          keyQueue.current["l"] ||
          keyQueue.current["L"]);

      // 조향 중일 때는 횡방향 감쇠를 약하게 (부드러운 방향 전환)
      // 조향 중이 아닐 때는 강하게 (옆 미끄러짐 방지)
      const baseSideFriction = 0.2;
      const sideFriction = isSteeringActive
        ? 0.6 // 조향 중: 60% 유지 (부드러운 회전)
        : baseSideFriction; // 조향 안 할 때: 20% 유지 (옆 미끄러짐 방지)

      const newVel = {
        x: velForward.x + velSide.x * sideFriction,
        y: vel.y, // 수직 속도는 그대로 유지 (점프/중력)
        z: velForward.z + velSide.z * sideFriction,
      };

      cartbodyRef.current.setLinvel(newVel, true);
    }

    // 6. 이동 힘 적용
    const moveForce = new Vector3(
      forward.x * targetSpeed.current * 2.0, // 200.0 -> 2.0 (1/100)
      0,
      forward.z * targetSpeed.current * 2.0 // 200.0 -> 2.0 (1/100)
    );

    // 6-0. 스텝 스냅: 앞에 있는 낮은 단(계단 윗면)으로 Y 위치를 살짝 끌어올리기
    if (
      targetSpeed.current > 0 &&
      objectHit.current &&
      groundContactPoint.current
    ) {
      const currentPos = cartbodyRef.current.translation();

      // 차 앞쪽, 약간 위에서 아래로 레이캐스트
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
        const MAX_STEP_HEIGHT = 0.1; // 한 번에 최대 0.1m까지만 끌어올리기

        if (stepHeight > 0 && stepHeight < MAX_STEP_HEIGHT) {
          const linvel = cartbodyRef.current.linvel();

          // 계단 윗면으로 Y 위치 스냅 (0.1m 이내의 작은 턱만 처리)
          cartbodyRef.current.setTranslation(
            {
              x: currentPos.x,
              y: hitY + GROUND_OFFSET,
              z: currentPos.z,
            },
            true
          );

          // 세로 속도는 0으로 정리 (튀는 것 방지)
          cartbodyRef.current.setLinvel(
            { x: linvel.x, y: 0, z: linvel.z },
            true
          );
        }
      }
    }

    cartbodyRef.current.applyImpulse(
      {
        x: moveForce.x * delta,
        y: moveForce.y * delta,
        z: moveForce.z * delta,
      },
      true
    );

    // 7. 조향 회전 토크 (버튼을 누르고 있을 때만 회전)
    // 현재 실제 속도 계산
    const currentVel = cartbodyRef.current.linvel();
    const currentSpeed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);

    // 전진/후진 방향 확인
    // 차량의 전방 방향과 속도 벡터의 내적을 통해 전진/후진 판단
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
    const isReversing = carForward.dot(velocityDir) < 0; // 내적이 음수면 후진

    // 조향 입력이 활성화되어 있을 때만 회전 토크 적용
    const isSteeringActive =
      keyQueue?.current &&
      (keyQueue.current["j"] ||
        keyQueue.current["J"] ||
        keyQueue.current["l"] ||
        keyQueue.current["L"]);

    // 조향 키에서 손을 떼면 Y축 각속도를 0으로 설정 (회전 즉시 정지)
    if (!isSteeringActive) {
      const angvel = cartbodyRef.current.angvel();
      cartbodyRef.current.setAngvel(
        {
          x: angvel.x,
          y: 0, // Y축 각속도 즉시 정지
          z: angvel.z,
        },
        true
      );
    }

    if (isSteeringActive && Math.abs(steerAngle.current) > 0.01) {
      if (currentSpeed > 0.1) {
        // 달리는 동안: 속도에 비례한 회전
        const speedFactor = Math.max(currentSpeed / 10.0, 0.3);
        let torqueStrength = steerAngle.current * speedFactor * 2.0;

        // 속도가 느릴수록 조향 토크를 강하게 (빠릿빠릿한 방향 전환)
        // 속도가 빠를수록 조향 토크를 완화 (급격한 회전 방지)
        const speedDamping = Math.min(1.0, 5.0 / currentSpeed); // 속도가 빠를수록 토크 감소
        const speedBoost = Math.max(1.0, 3.0 / currentSpeed); // 속도가 느릴수록 토크 증가
        torqueStrength *= speedDamping * speedBoost;

        // 최대 토크 제한 (너무 급격한 회전 방지)
        // 속도가 느릴 때는 더 큰 토크 허용 (빠릿빠릿한 전환)
        const maxTorque = currentSpeed < 3.0 ? 5.0 : 3.0; // 느릴 때 5.0, 빠를 때 3.0
        torqueStrength = Math.max(
          -maxTorque,
          Math.min(maxTorque, torqueStrength)
        );

        // 후진 중일 때는 조향 방향 반대
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
        // 정지 상태에서도 약간의 회전 가능 (제자리 회전)
        // 후진 입력 중일 때는 반대 방향으로 회전
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

    // 8. 경사면에 맞춰 회전 (충돌 중일 때만)
    if (objectHit.current && groundNormal.current.y < 0.99) {
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
            x: rotationAxis.x * rotationAngle * 0.5 * delta, // 50.0 -> 0.5 (1/100)
            y: rotationAxis.y * rotationAngle * 0.5 * delta, // 50.0 -> 0.5 (1/100)
            z: rotationAxis.z * rotationAngle * 0.5 * delta, // 50.0 -> 0.5 (1/100)
          },
          true
        );
      }
    }

    // 8-1. 뒤집힘 감지 및 자동 복구 (오브젝트에 닿은 상태일 때만)
    if (objectHit.current) {
      // 차량의 위쪽 방향 계산
      const carUp = new Vector3(0, 1, 0);
      carUp.applyQuaternion(currentQuat);

      // 위쪽 방향이 아래를 향하는 정도 확인 (뒤집힘 각도)
      // carUp.y가 -1에 가까울수록 완전히 뒤집힌 상태
      // carUp.y가 0에 가까우면 90도 뒤집힌 상태
      const upsideDownThreshold = 0.1; // 0.1 이하면 "어느 정도 뒤집힌" 것으로 판단 (90도 포함)

      if (carUp.y < upsideDownThreshold) {
        // 목표: 수직 방향 (Y축 위로)
        const targetUp = new Vector3(0, 1, 0);

        // 현재 위쪽 방향과 목표 위쪽 방향의 차이로 회전 축 계산
        const rotationAxis = new Vector3().crossVectors(carUp, targetUp);

        // 회전 각도 계산
        const rotationAngle = Math.acos(
          Math.max(-1, Math.min(1, carUp.dot(targetUp)))
        );

        // 회전 축이 유효하고 각도가 충분히 클 때만 복구 토크 적용
        if (rotationAngle > 0.01 && rotationAxis.length() > 0.01) {
          rotationAxis.normalize();

          // 뒤집힘 복구 토크 (강하게 적용)
          const recoveryStrength = 5.0; // 복구 강도
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
    }

    // 9. 각속도 제한 (X축은 기울기 제어를 위해 제한 완화)
    const angvel = cartbodyRef.current.angvel();
    const maxAngvel = 5.0;
    const maxPitchAngvel = 10.0; // X축 각속도는 더 큰 값 허용 (기울기 제어용)
    cartbodyRef.current.setAngvel(
      {
        x: Math.max(-maxPitchAngvel, Math.min(maxPitchAngvel, angvel.x)), // X축은 더 큰 값 허용
        y: Math.max(-maxAngvel, Math.min(maxAngvel, angvel.y)),
        z: Math.max(-maxAngvel, Math.min(maxAngvel, angvel.z)),
      },
      true
    );
  });

  const handle = () => ({
    rigidBodyRef: cartbodyRef,
    followTarget,
  });

  useImperativeHandle(ref, handle, []);

  return (
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
          }
        }

        // 충돌 지점 저장 (차량의 현재 위치 기준으로 계산)
        // manifold에서 contact를 직접 가져올 수 없으므로 차량 위치 사용
        if (cartbodyRef.current) {
          const currentPos = cartbodyRef.current.translation();
          // 차량 하단 위치를 contact point로 사용
          groundContactPoint.current = {
            x: currentPos.x,
            y: currentPos.y - 0.25, // 차량 하단
            z: currentPos.z,
          };
        }
      }}
      onCollisionExit={(event) => {
        // 접촉이 끝날 때마다 contactCount 감소
        contactCount.current = Math.max(0, contactCount.current - 1);

        // 더 이상 어떤 물체와도 닿아있지 않을 때만 false로 전환
        if (contactCount.current === 0) {
          objectHit.current = false;
          groundContactPoint.current = null;
        }
      }}
    >
      <primitive object={followTarget} />
      <mesh castShadow>
        <boxGeometry args={[1, 0.5, 2]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </RigidBody>
  );
});

export default Car;
