import { CuboidCollider, RigidBody } from "@react-three/rapier";

export default function MapFloor() {
  return (
    <RigidBody type="fixed">
      {/* 바닥 */}
      <gridHelper position={[0, -0.5, 0]} args={[2000, 2000]} />
      <CuboidCollider position={[0, -1, 0]} args={[1000, 0.5, 1000]} />{" "}
    </RigidBody>
  );
}
