import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGhostStore } from "./ghostStore";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";

export function useGhostRecorder(playerId: string = "player") {
  const physics = usePhysicsEngineContext();
  const isRecording = useGhostStore((s) => s.isRecording);
  const recordPosition = useGhostStore((s) => s.recordPosition);
  const recordInput = useGhostStore((s) => s.recordInput);

  // Record position every frame while recording
  useFrame(() => {
    if (!isRecording) return;
    const pos = physics.getPosition(playerId);
    recordPosition([pos.x, pos.y, pos.z]);
  });

  // Capture inputs from keyboard (register once; store guards recording state)
  useEffect(() => {
    const down = (e: KeyboardEvent) => recordInput(e.code, true);
    const up = (e: KeyboardEvent) => recordInput(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [recordInput]);
}
