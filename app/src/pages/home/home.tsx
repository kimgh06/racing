import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import Scene from "~/src/widgets/scene/Scene";

export default function Index() {
  return (
    <div>
      <Canvas style={{ width: "100svw", height: "100svh" }}>
        <color attach="background" args={["white"]} />
        <Suspense>
          <Physics debug>
            <Scene />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}
