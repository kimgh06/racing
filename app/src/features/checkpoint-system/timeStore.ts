import { create } from "zustand";

interface TimeState {
  startTime: number;
  setStartTime: (startTime: number) => void;
  lapStartTime: number;
  startLap: (now?: number) => void;
  completeLap: (now?: number) => void;
  lastLapMs: number | null;
  bestLapMs: number | null;
  lapTimes: number[];
  getUptime: () => number;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  startTime: 0,
  setStartTime: (startTime: number) => set({ startTime }),
  lapStartTime: 0,
  startLap: (now = performance.now()) => set({ lapStartTime: now }),
  completeLap: (now = performance.now()) => {
    const { lapStartTime, lapTimes } = get();
    if (!lapStartTime) {
      // no active lap; start one now to avoid NaN
      set({ lapStartTime: now });
      return;
    }
    const duration = Math.max(0, Math.floor(now - lapStartTime));
    const nextTimes = [...lapTimes, duration];
    const best = nextTimes.length ? Math.min(...nextTimes) : duration;
    set({
      lastLapMs: duration,
      bestLapMs: isFinite(best) ? best : duration,
      lapTimes: nextTimes,
      lapStartTime: now,
    });
  },
  lastLapMs: null,
  bestLapMs: null,
  lapTimes: [],
  getUptime: () => performance.now() - get().startTime,
}));
