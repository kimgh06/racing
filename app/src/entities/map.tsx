import { Plane } from "@react-three/drei";
import PlaneWall from "./wall";

import { RigidBody } from "@react-three/rapier";
import { DoubleSide, MeshStandardMaterial } from "three";
import { useMemo } from "react";

export default function Map() {
  // Material 인스턴스 메모이제이션 (매 렌더링마다 재생성 방지)
  const greenMaterial = useMemo(
    () => new MeshStandardMaterial({ side: DoubleSide, color: "green" }),
    []
  );
  return (
    <RigidBody type={"fixed"}>
      {/* 일반 경사면 */}
      <Plane
        rotation={[(-Math.PI * 7) / 16, 0, 0]}
        position={[0, 1.9, -55]}
        args={[4, 25]}
        material={greenMaterial}
      />
      {/* Guide Lane */}
      <PlaneWall position={[-2, 0, -26]} args={[55, 1]} />
      <PlaneWall position={[2, 0, -26]} args={[55, 1]} />
      <PlaneWall position={[5, 0, -85]} args={[10, 1]} />
      <PlaneWall position={[-5, 0, -85]} args={[10, 1]} />
      <PlaneWall position={[0, 0, -80]} args={[10, 1]} rotateY={0} />
      <PlaneWall
        position={[0, 0, -95]}
        args={[10 * Math.sqrt(2), 1]}
        rotateY={Math.PI / 4}
      />
      <PlaneWall position={[10, 0, -90]} args={[10, 1]} rotateY={0} />
      <PlaneWall position={[10, 0, -100]} args={[10, 1]} rotateY={0} />
      <PlaneWall position={[30, 0, -90]} args={[40, 1]} rotateY={0} />
      <PlaneWall position={[30, 0, -100]} args={[40, 1]} rotateY={0} />
      <PlaneWall
        position={[55, 0, -95]}
        args={[10 * Math.sqrt(2), 1]}
        rotateY={-Math.PI / 4}
      />
      <PlaneWall position={[60, 0, -85]} args={[10, 1]} />
      <PlaneWall position={[50, 0, -85]} args={[10, 1]} />
      <PlaneWall position={[50, 0, 20]} args={[200, 1]} />
      <PlaneWall position={[60, 0, 20]} args={[200, 1]} />
      <PlaneWall
        position={[55, 0, 125]}
        args={[10 * Math.sqrt(2), 1]}
        rotateY={Math.PI / 4}
      />
      <PlaneWall position={[0, 0, 120]} args={[100, 1]} rotateY={0} />
      <PlaneWall position={[0, 0, 130]} args={[100, 1]} rotateY={0} />
      <PlaneWall
        position={[-55, 0, 125]}
        args={[10 * Math.sqrt(2), 1]}
        rotateY={-Math.PI / 4}
      />
      <PlaneWall position={[-60, 0, 61.25]} args={[120.5, 1]} />
      <PlaneWall position={[-50, 0, 62.75]} args={[114.5, 1]} />
      <PlaneWall position={[-26, 0, 1.5]} args={[48, 1]} rotateY={0} />
      <PlaneWall position={[-26, 0, 5.5]} args={[48, 1]} rotateY={0} />
      <PlaneWall position={[-55, 0, 1.5]} args={[10, 1]} rotateY={0} />
      <PlaneWall
        position={[0, 0, 3.5]}
        args={[4 * Math.sqrt(2), 1]}
        rotateY={Math.PI / 4}
      />
    </RigidBody>
  );
}
