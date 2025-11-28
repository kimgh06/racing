import { useFrame } from "@react-three/fiber";
import { RigidBody, useRevoluteJoint } from "@react-three/rapier";
import type { RapierRigidBody, RevoluteJointParams } from "@react-three/rapier";
import {
  forwardRef,
  RefObject,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import Wheel, { WheelHandle } from "./wheel";
import { Box } from "@react-three/drei";
import { getLocalRotation } from "../shared/rotate";
import { Quaternion, Vector3 } from "three";

type SteeringWheelProps = {
  position?: [number, number, number];
  parentRef: RefObject<RapierRigidBody>; // 차량 본체
  wheelRotation?: number;
  wheelTranslation?: [number, number, number];
};

export type SteeringWheelHandle = {
  forward: () => void;
  backward: () => void;
  turnLeft: () => void;
  turnRight: () => void;
  rigidBodyRef: RefObject<RapierRigidBody>;
  getTargetVelocity: () => number;
  getTargetSteer: () => number;
  setTargetVelocity: (v: number) => void;
  setTargetSteer: (s: number) => void;
};

/**
 * SteeringWheel 컴포넌트 - 조향 담당 + 내부에 Wheel 포함
 * @param position - 바퀴의 위치 (차량 본체 기준)
 * @param parentRef - 차량 본체의 rigid body
 * @param wheelRotation - 바퀴의 초기 회전 각도
 * @param wheelTranslation - 바퀴의 translation offset
 */
const SteeringWheel = forwardRef<SteeringWheelHandle, SteeringWheelProps>(
  function SteeringWheel(
    {
      position = [0, 0, 0],
      parentRef,
      wheelRotation = 0,
      wheelTranslation = [0, 0, 0],
    },
    ref
  ) {
    const steeringKnuckleRef = useRef<RapierRigidBody>(null);
    const wheelRef = useRef<WheelHandle>(null);

    // Steering Joint: 차량 본체 -> steering knuckle (Y축 회전, 조향)
    const steeringJointParams: RevoluteJointParams = [
      position, // 차량 본체 기준 바퀴 중심 위치
      [0, 0, 0], // steering knuckle 기준
      [0, 1, 0], // Y축 회전 (조향)
    ];

    const steeringJoint = useRevoluteJoint(
      parentRef,
      steeringKnuckleRef,
      steeringJointParams
    );

    const targetSteerAngle = useRef(0); // 목표 조향 각도 (라디안)
    const MAX_STEER_ANGLE = Math.PI / 6; // 최대 조향 각도 (30도)

    const turnLeft = () => (targetSteerAngle.current = -MAX_STEER_ANGLE);
    const turnRight = () => (targetSteerAngle.current = MAX_STEER_ANGLE);

    // Steering knuckle 초기화: 위치와 속도 명시적 설정
    useEffect(() => {
      if (steeringKnuckleRef.current && parentRef.current) {
        // 부모 위치 가져오기
        const parentPos = parentRef.current.translation();

        // 목표 위치 = 부모 위치 + position offset
        const targetPos = {
          x: parentPos.x + position[0],
          y: parentPos.y + position[1],
          z: parentPos.z + position[2],
        };

        // 초기 위치 명시적 설정
        steeringKnuckleRef.current.setTranslation(targetPos, true);

        // 초기 속도/각속도 0으로 설정
        steeringKnuckleRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        steeringKnuckleRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }, [position]);

    useFrame(() => {
      // Steering joint 제어
      if (
        steeringJoint.current &&
        steeringKnuckleRef.current &&
        parentRef.current
      ) {
        // 로컬 회전 정보 가져오기
        const localRotation = getLocalRotation(
          steeringKnuckleRef.current,
          parentRef.current
        );
        const currentAngle = localRotation.euler.y;

        // 목표 각도로 점진적으로 이동 (조작이 없으면 0으로 복귀)
        targetSteerAngle.current *= 0.5;
        if (Math.abs(targetSteerAngle.current) < 0.1) {
          // 조작이 없을 때 원점(0)으로 복귀
          targetSteerAngle.current = 0;
        }
        // 목표 각도 제한
        const targetAngle = Math.max(
          -MAX_STEER_ANGLE,
          Math.min(MAX_STEER_ANGLE, targetSteerAngle.current)
        );

        // 현재 각도에서 목표 각도로 lerp
        const angleDiff = targetAngle - currentAngle;
        const lerpFactor = Math.min(Math.abs(angleDiff) * 300.0, 1.0); // 매우 빠른 반응 (100.0 -> 300.0)
        const newAngle = currentAngle + angleDiff * lerpFactor;

        // Joint motor 제거 - setRotation만 사용하여 들썩거림 방지

        // 부모 회전 가져오기
        const parentRot = parentRef.current.rotation();
        const parentQuat = new Quaternion(
          parentRot.x,
          parentRot.y,
          parentRot.z,
          parentRot.w
        );

        // 목표 로컬 회전 (Y축만 회전)
        const targetLocalQuat = new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          newAngle
        );

        // 부모 회전 * 로컬 회전 = 최종 월드 회전
        const targetWorldQuat = parentQuat.clone().multiply(targetLocalQuat);

        // setRotation으로 직접 설정
        steeringKnuckleRef.current.setRotation(
          {
            x: targetWorldQuat.x,
            y: targetWorldQuat.y,
            z: targetWorldQuat.z,
            w: targetWorldQuat.w,
          },
          true
        );

        // 외부 힘에 의한 모든 각속도 제거 (강력한 락)
        // setRotation 후 각속도를 0으로 설정하여 외부 힘 완전 차단
        steeringKnuckleRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    });

    const handle = () => ({
      forward: () => wheelRef.current?.forward(),
      backward: () => wheelRef.current?.backward(),
      turnLeft,
      turnRight,
      rigidBodyRef: steeringKnuckleRef,
      getTargetVelocity: () => wheelRef.current?.getTargetVelocity() ?? 0,
      getTargetSteer: () => targetSteerAngle.current,
      setTargetVelocity: (v: number) => wheelRef.current?.setTargetVelocity(v),
      setTargetSteer: (s: number) => (targetSteerAngle.current = s),
    });
    useImperativeHandle(ref, handle, []);

    return (
      <group>
        <RigidBody
          ref={steeringKnuckleRef}
          type="dynamic"
          canSleep={false}
          colliders={"hull"}
          angularDamping={50.0}
        >
          <Box args={[0.2, 0.2, 0.2]} />
        </RigidBody>
        {/* Wheel은 steering knuckle에 연결 */}
        <Wheel
          ref={wheelRef}
          parentRef={steeringKnuckleRef}
          wheelRotation={wheelRotation}
          position={wheelTranslation}
        />
      </group>
    );
  }
);

export default SteeringWheel;
