import { useMemo } from "react";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import { useUptime } from "~/src/shared/lib/useUptime";
import { useTimeStore } from "~/src/features/checkpoint-system/timeStore";
import formatTime from "~/src/shared/lib/formatTIme";

export default function Panel() {
  // 선택적 구독: laps만 구독
  const laps = useCheckPointStore((state) => state.checkpoints.laps);
  const last = useCheckPointStore((state) => state.checkpoints.last);
  const { formatted } = useUptime();
  const lastLapMs = useTimeStore((s) => s.lastLapMs);
  const bestLapMs = useTimeStore((s) => s.bestLapMs);
  const formattedLast = useMemo(
    () => (lastLapMs == null ? "-" : formatTime(lastLapMs)),
    [lastLapMs]
  );
  const formattedBest = useMemo(
    () => (bestLapMs == null ? "-" : formatTime(bestLapMs)),
    [bestLapMs]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        background: "rgba(0,0,0,0.7)",
        color: "#ffffff",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
        Uptime: {formatted}
      </div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        Last Lap: {formattedLast}
      </div>
      <div style={{ fontSize: 14, marginBottom: 10 }}>
        Best Lap: {formattedBest}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Laps: {laps}-{last}
      </h3>
      <div style={{ display: "grid", gap: 6, fontSize: 16 }}>
        <div>⬆️ I: 전진</div>
        <div>⬇️ K: 후진</div>
        <div>⬅️ J: 좌회전</div>
        <div>➡️ L: 우회전</div>
        <div>🚀 Space: 점프</div>
      </div>
    </div>
  );
}
