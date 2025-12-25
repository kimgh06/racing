import { create } from "zustand";

type CarState = {
  // 차량 위치
  position: { x: number; y: number; z: number } | null;
  // 속도
  speed: number;
  // 충돌 상태
  collision: boolean;
  // 드리프트 모드
  driftMode: boolean;
  // 드리프트 점수
  score: number;
  // 드리프트 게이지 (0-100)
  driftGauge: number;
  // 감지된 오브젝트 거리
  detectedDistance: number | null;
  // 감지된 오브젝트 여부
  detectedObject: boolean;
};

type CarActions = {
  setPosition: (position: { x: number; y: number; z: number } | null) => void;
  setSpeed: (speed: number) => void;
  setCollision: (collision: boolean) => void;
  setDriftMode: (driftMode: boolean) => void;
  setScore: (score: number) => void;
  setDriftGauge: (gauge: number) => void;
  setDetectedDistance: (distance: number | null) => void;
  setDetectedObject: (detected: boolean) => void;
  incrementScore: () => void;
  resetScore: () => void;
};

export const useCarStore = create<CarState & CarActions>((set) => ({
  // 초기 상태
  position: null,
  speed: 0,
  collision: false,
  driftMode: false,
  score: 0,
  driftGauge: 0,
  detectedDistance: null,
  detectedObject: false,

  // Actions
  setPosition: (position) => set({ position }),
  setSpeed: (speed) => set({ speed }),
  setCollision: (collision) => set({ collision }),
  setDriftMode: (driftMode) => set({ driftMode }),
  setScore: (score) => set({ score }),
  setDriftGauge: (gauge) => set({ driftGauge: gauge }),
  setDetectedDistance: (distance) => set({ detectedDistance: distance }),
  setDetectedObject: (detected) => set({ detectedObject: detected }),
  incrementScore: () => set((state) => ({ score: state.score + 1 })),
  resetScore: () => set({ score: 0 }),
}));

