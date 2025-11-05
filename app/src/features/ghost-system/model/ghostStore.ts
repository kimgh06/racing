import { create } from "zustand";

export type GhostInputEvent = {
  t: number; // ms since session start
  action: string;
  pressed: boolean;
};

export type GhostPositionFrame = {
  t: number; // ms since session start
  position: [number, number, number];
};

export type GhostRecording = {
  meta: {
    version: 1;
    createdAt: number;
  };
  inputs: GhostInputEvent[];
  positions: GhostPositionFrame[];
};

interface GhostState {
  isRecording: boolean;
  isPlaying: boolean;
  sessionStartTime: number; // performance.now() when session started
  playStartTime: number; // performance.now() when playback started
  playIndex: number; // current index in positions
  playOffsetMs: number; // accumulated offset when paused/seeked
  isPaused: boolean;
  recording: GhostRecording | null;
  lastRecording: GhostRecording | null;

  // Recording controls
  startRecording: (now?: number) => void;
  stopRecording: () => GhostRecording | null;
  recordPosition: (pos: [number, number, number], now?: number) => void;
  recordInput: (action: string, pressed: boolean, now?: number) => void;

  // Playback controls
  loadRecording: (json: GhostRecording) => void;
  startPlayback: (now?: number) => void;
  stopPlayback: () => void;
  pausePlayback: () => void;
  resumePlayback: (now?: number) => void;
  seekTo: (ms: number, now?: number) => void;
  getDuration: () => number;
  getPlayhead: (now?: number) => number;

  // Serialization
  exportJson: () => string | null;
  importJson: (jsonString: string) => void;
}

export const useGhostStore = create<GhostState>((set, get) => ({
  isRecording: false,
  isPlaying: false,
  sessionStartTime: 0,
  playStartTime: 0,
  playIndex: 0,
  playOffsetMs: 0,
  isPaused: false,
  recording: null,
  lastRecording: null,

  startRecording: (now = performance.now()) =>
    set({
      isRecording: true,
      sessionStartTime: now,
      recording: {
        meta: { version: 1 as const, createdAt: Date.now() },
        inputs: [],
        positions: [],
      },
    }),

  stopRecording: () => {
    const rec = get().recording;
    set({ isRecording: false, lastRecording: rec });
    return rec ?? null;
  },

  recordPosition: (position, now = performance.now()) => {
    const { isRecording, recording, sessionStartTime } = get();
    if (!isRecording || !recording) return;
    const t = Math.max(0, Math.floor(now - sessionStartTime));
    recording.positions.push({ t, position });
  },

  recordInput: (action, pressed, now = performance.now()) => {
    const { isRecording, recording, sessionStartTime } = get();
    if (!isRecording || !recording) return;
    const t = Math.max(0, Math.floor(now - sessionStartTime));
    recording.inputs.push({ t, action, pressed });
  },

  loadRecording: (json) => set({ lastRecording: json }),

  startPlayback: (now = performance.now()) => {
    const rec = get().lastRecording;
    if (!rec || rec.positions.length === 0) return;
    // restart playback cleanly
    set({ isPlaying: false });
    set({ isPlaying: true, isPaused: false, playStartTime: now, playIndex: 0, playOffsetMs: 0 });
  },

  stopPlayback: () => set({ isPlaying: false, playIndex: 0 }),

  pausePlayback: () => {
    if (!get().isPlaying) return;
    const now = performance.now();
    const elapsed = now - get().playStartTime + get().playOffsetMs;
    set({ isPlaying: false, isPaused: true, playOffsetMs: elapsed });
  },

  resumePlayback: (now = performance.now()) => {
    if (!get().lastRecording) return;
    set({ isPlaying: true, isPaused: false, playStartTime: now });
  },

  seekTo: (ms: number, now = performance.now()) => {
    const rec = get().lastRecording;
    if (!rec) return;
    const clamped = Math.max(0, Math.min(ms, (rec.positions.at(-1)?.t ?? 0)));
    if (get().isPlaying) {
      set({ playStartTime: now, playOffsetMs: clamped });
    } else {
      set({ playOffsetMs: clamped });
    }
  },

  getDuration: () => get().lastRecording?.positions.at(-1)?.t ?? 0,
  getPlayhead: (now = performance.now()) => {
    const state = get();
    if (state.isPlaying) return now - state.playStartTime + state.playOffsetMs;
    return state.playOffsetMs;
  },

  exportJson: () => {
    const rec = get().lastRecording ?? get().recording;
    if (!rec) return null;
    try {
      return JSON.stringify(rec);
    } catch {
      return null;
    }
  },

  importJson: (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString) as GhostRecording;
      set({ lastRecording: parsed });
    } catch {
      // ignore invalid json
    }
  },
}));
