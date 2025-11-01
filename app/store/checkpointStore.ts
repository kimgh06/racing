import { create } from "zustand";
import * as THREE from "three";
import type { usePhysicsEngine } from "~/physicsEngine";

interface CheckpointState {
  total: number;
  last: number;
  laps: number;
}

interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  onGround: boolean;
  tiltX: number;
  tiltZ: number;
  tiltVelocityX: number;
  tiltVelocityZ: number;
  centerOfMass: THREE.Vector3;
  supportPoint: THREE.Vector3;
  weight: number;
  weightFactor: number;
}

interface CheckPointState {
  // 체크포인트 관련
  checkpoints: CheckpointState;
  cpInside: Record<number, boolean>;
  startIndex: number | null;

  // 플레이어 상태
  playerState: PlayerState | null;

  // 물리 엔진 인스턴스 (디버그용)
  physicsEngine: ReturnType<typeof usePhysicsEngine> | null;

  // 리스폰 관련
  respawnPosition: THREE.Vector3 | null;
  respawnRotation: number | null;
  respawnRoll: number | null;

  // Actions
  setCheckpoints: (checkpoints: Partial<CheckpointState>) => void;
  setCpInside: (index: number, inside: boolean) => void;
  setStartIndex: (index: number | null) => void;
  setPlayerState: (state: PlayerState | null) => void;
  setPhysicsEngine: (
    engine: ReturnType<typeof usePhysicsEngine> | null
  ) => void;
  setRespawnPosition: (position: THREE.Vector3 | null) => void;
  setRespawnRotation: (rotation: number | null) => void;
  setRespawnRoll: (roll: number | null) => void;
  resetCheckpoints: () => void;
}

export const useCheckPointStore = create<CheckPointState>((set) => ({
  // 초기 상태
  checkpoints: {
    total: 0,
    last: 0,
    laps: 0,
  },
  cpInside: {},
  startIndex: null,
  playerState: null,
  physicsEngine: null,
  respawnPosition: null,
  respawnRotation: null,
  respawnRoll: null,

  // Actions
  setCheckpoints: (updates) =>
    set((state) => ({
      checkpoints: { ...state.checkpoints, ...updates },
    })),

  setCpInside: (index, inside) =>
    set((state) => ({
      cpInside: { ...state.cpInside, [index]: inside },
    })),

  setStartIndex: (index) => set({ startIndex: index }),

  setPlayerState: (state) => set({ playerState: state }),

  setPhysicsEngine: (engine) => set({ physicsEngine: engine }),

  setRespawnPosition: (position) => set({ respawnPosition: position }),

  setRespawnRotation: (rotation) => set({ respawnRotation: rotation }),

  setRespawnRoll: (roll) => set({ respawnRoll: roll }),

  resetCheckpoints: () =>
    set({
      checkpoints: { total: 0, last: 0, laps: 0 },
      cpInside: {},
      startIndex: null,
    }),
}));
