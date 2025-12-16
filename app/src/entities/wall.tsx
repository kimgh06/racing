import { MeshStandardMaterial, MeshStandardMaterialParameters } from "three";
import { Plane } from "@react-three/drei";
import { DoubleSide } from "three";
import { useMemo } from "react";

type PlaneWallProps = {
  position?: [number, number, number];
  rotateY?: number;
  args?: [number, number];
  material?: MeshStandardMaterialParameters;
};
/**
 * This must be placed in RigidBody component.
 */
export default function PlaneWall({
  position = [0, 0, 0],
  rotateY = Math.PI / 2,
  args = [1, 1],
  material,
}: PlaneWallProps) {
  const defaultMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        side: DoubleSide,
        ...material,
      }),
    [material]
  );
  return (
    <Plane
      position={position}
      args={args}
      rotation={[0, rotateY, 0]}
      material={defaultMaterial}
    />
  );
}
