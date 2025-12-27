import { create } from "zustand";

type CarState = {
  // 차량 위치
  position: { x: number; y: number; z: number } | null;
  savePointId: number;
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
  lapTime: number;
};

type CarActions = {
  setPosition: (position: { x: number; y: number; z: number } | null) => void;
  setSavePointId: (savePointId: number) => void;
  setSpeed: (speed: number) => void;
  setCollision: (collision: boolean) => void;
  setDriftMode: (driftMode: boolean) => void;
  setScore: (score: number) => void;
  setDriftGauge: (gauge: number) => void;
  setDetectedDistance: (distance: number | null) => void;
  setDetectedObject: (detected: boolean) => void;
  incrementScore: () => void;
  resetScore: () => void;
  setLapTime: (lapTime: number) => void;
};

export const useCarStore = create<CarState & CarActions>((set) => ({
  // 초기 상태
  position: null,
  savePointId: 0,
  speed: 0,
  collision: false,
  driftMode: false,
  score: 0,
  driftGauge: 0,
  detectedDistance: null,
  detectedObject: false,
  lapTime: performance.now(),

  // Actions
  setPosition: (position) => set({ position }),
  setSavePointId: (savePointId) => set({ savePointId }),
  setSpeed: (speed) => set({ speed }),
  setCollision: (collision) => set({ collision }),
  setDriftMode: (driftMode) => set({ driftMode }),
  setScore: (score) => set({ score }),
  setDriftGauge: (driftGauge) => set({ driftGauge }),
  setDetectedDistance: (detectedDistance) => set({ detectedDistance }),
  setDetectedObject: (detectedObject) => set({ detectedObject }),
  incrementScore: () => set((state) => ({ score: state.score + 1 })),
  resetScore: () => set({ score: 0 }),
  setLapTime: (lapTime) => set({ lapTime }),
}));
