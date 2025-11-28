import { Cylinder, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody, useRevoluteJoint } from "@react-three/rapier";
import type { RapierRigidBody, RevoluteJointParams } from "@react-three/rapier";
import {
  forwardRef,
  RefObject,
  useImperativeHandle,
  useMemo,
  useRef,
  useEffect,
} from "react";

type WheelProps = {
  position?: [number, number, number]; // 부모 기준 위치 (joint anchor)
  parentRef: RefObject<RapierRigidBody>; // steering knuckle 또는 차량 본체
  wheelRotation?: number; // HTML 코드의 cylinder rotation (Math.PI/2 또는 -Math.PI/2)
};

// Public API exposed via ref
export type WheelHandle = {
  forward: () => void;
  backward: () => void;
  rigidBodyRef: RefObject<RapierRigidBody>;
  getTargetVelocity: () => number;
  setTargetVelocity: (v: number) => void;
};

/**
 * Wheel 컴포넌트 - 앞뒤 회전만 담당
 * @param parentRef - 부모 rigid body (steering knuckle 또는 차량 본체)
 * @param wheelRotation - 바퀴의 초기 회전 각도
 */
const Wheel = forwardRef<WheelHandle, WheelProps>(function Wheel(
  { position = [0, 0, 0], parentRef, wheelRotation = 0 },
  ref
) {
  const glb = useGLTF("/car/rust_wheel.glb");
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const clonedObject = useMemo(() => glb.scene.clone(true), [glb.scene]);

  // 바퀴 회전축 joint (앞뒤 회전만)
  const jointParams: RevoluteJointParams = [
    position, // parent 기준 anchor (바퀴 위치)
    [0, 0, 0], // wheel 기준 anchor
    [0, 0, 1], // Z축 회전 (바퀴 회전축)
  ];

  const wheelJoint = useRevoluteJoint(parentRef, rigidBodyRef, jointParams);

  // Wheel 초기화: 위치와 속도 명시적 설정
  useEffect(() => {
    if (rigidBodyRef.current && parentRef.current) {
      // 부모 위치 가져오기
      const parentPos = parentRef.current.translation();

      // 목표 위치 = 부모 위치 + position offset
      const targetPos = {
        x: parentPos.x + position[0],
        y: parentPos.y + position[1],
        z: parentPos.z + position[2],
      };

      // 초기 위치 명시적 설정
      rigidBodyRef.current.setTranslation(targetPos, true);

      // 초기 속도/각속도 0으로 설정
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, [position]);

  // 타겟 속도 (HTML 코드: forward=500, backward=-200)
  const targetVelocity = useRef(0);

  const forward = () => (targetVelocity.current = 100);
  const backward = () => (targetVelocity.current = -70);

  // HTML 코드의 update 함수와 동일한 로직
  useFrame(() => {
    if (wheelJoint.current) {
      // HTML 코드: this.wheelBLMotor.configureMotorVelocity(targetVelocity, 2.0)
      wheelJoint.current.configureMotorVelocity(targetVelocity.current, 2.0);

      // 키 입력이 없으면 targetVelocity 자동 감쇠
      if (Math.abs(targetVelocity.current) > 0) {
        targetVelocity.current *= 0.9;
        if (Math.abs(targetVelocity.current) < 1) targetVelocity.current = 0;
      }
    }
  });

  const handle = () => ({
    forward,
    backward,
    rigidBodyRef,
    getTargetVelocity: () => targetVelocity.current,
    setTargetVelocity: (v: number) => (targetVelocity.current = v),
  });
  useImperativeHandle(ref, handle, []);

  return (
    <RigidBody
      type="dynamic"
      ref={rigidBodyRef}
      colliders={"hull"}
      canSleep={false}
      friction={10}
      restitution={0.01}
    >
      <group rotation={[Math.PI / 2, wheelRotation, 0]}>
        {/* <primitive object={clonedObject} /> */}
        <Cylinder args={[0.5, 0.5, 0.2]} />
      </group>
    </RigidBody>
  );
});

export default Wheel;
