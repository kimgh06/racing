import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import Scene from "~/src/widgets/scene/Scene";
import CarPanel from "~/src/widgets/car-panel/CarPanel";

export default function Index() {
  return (
    <div style={{ position: "relative", width: "100svw", height: "100svh" }}>
      <Canvas style={{ width: "100svw", height: "100svh" }}>
        <color attach="background" args={["white"]} />
        <Suspense>
          <Physics>
            <Scene />
          </Physics>
        </Suspense>
      </Canvas>
      <CarPanel />
    </div>
  );
}
