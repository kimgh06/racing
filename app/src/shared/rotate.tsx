import { RapierRigidBody } from "@react-three/rapier";
import { Euler, Quaternion } from "three";

export const getLocalRotation = (
  child: RapierRigidBody,
  parent: RapierRigidBody
) => {
  const childRot = child.rotation();
  const parentRot = parent.rotation();

  const childQuat = new Quaternion(
    childRot.x,
    childRot.y,
    childRot.z,
    childRot.w
  );
  const parentQuat = new Quaternion(
    parentRot.x,
    parentRot.y,
    parentRot.z,
    parentRot.w
  );

  // 로컬 회전 계산
  const localQuat = parentQuat.clone().invert().multiply(childQuat);
  const euler = new Euler().setFromQuaternion(localQuat);

  return {
    quaternion: {
      x: localQuat.x,
      y: localQuat.y,
      z: localQuat.z,
      w: localQuat.w,
    },
    euler: {
      x: euler.x,
      y: euler.y, // 조향 각도
      z: euler.z,
    },
  };
};
