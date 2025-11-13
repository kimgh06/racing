import { useMemo, useRef } from "react";
import { useCheckPointStore } from "~/src/features/checkpoint-system/checkpointStore";
import { useUptime } from "~/src/shared/lib/useUptime";
import { useTimeStore } from "~/src/features/checkpoint-system/timeStore";
import formatTime from "~/src/shared/lib/formatTIme";
import { useGhostStore } from "~/src/features/ghost-system/model/ghostStore";
import { useVehicleStore } from "~/src/features/vehicle/vehicleStore";

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
  const exportJson = useGhostStore((s) => s.exportJson);
  const importJson = useGhostStore((s) => s.importJson);
  const startPlayback = useGhostStore((s) => s.startPlayback);
  const pausePlayback = useGhostStore((s) => s.pausePlayback);
  const resumePlayback = useGhostStore((s) => s.resumePlayback);
  const stopPlayback = useGhostStore((s) => s.stopPlayback);
  const seekTo = useGhostStore((s) => s.seekTo);
  const getDuration = useGhostStore((s) => s.getDuration);
  const getPlayhead = useGhostStore((s) => s.getPlayhead);
  const isPlaying = useGhostStore((s) => s.isPlaying);
  const isPaused = useGhostStore((s) => s.isPaused);
  const vehicleType = useVehicleStore((s) => s.type);
  const setVehicleType = useVehicleStore((s) => s.setType);
  const motorType = useVehicleStore((s) => s.motorType);
  const setMotorType = useVehicleStore((s) => s.setMotorType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportJson();
    if (!data) return;
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghost-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importJson(text);
    e.target.value = ""; // reset
  };

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
        pointerEvents: "auto",
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
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          차량 타입
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => setVehicleType("car")}
            style={{
              ...btnStyle,
              background: vehicleType === "car" ? "#2563eb" : "#1f2937",
            }}
          >
            4륜차
          </button>
          <button
            onClick={() => setVehicleType("bike")}
            style={{
              ...btnStyle,
              background: vehicleType === "bike" ? "#2563eb" : "#1f2937",
            }}
          >
            2륜차
          </button>
          <button
            onClick={() => setVehicleType("mono")}
            style={{
              ...btnStyle,
              background: vehicleType === "mono" ? "#2563eb" : "#1f2937",
            }}
          >
            1륜차
          </button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          모터 타입
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMotorType("ev")}
            style={{
              ...btnStyle,
              background: motorType === "ev" ? "#10b981" : "#1f2937",
            }}
          >
            ⚡ 전기
          </button>
          <button
            onClick={() => setMotorType("ice")}
            style={{
              ...btnStyle,
              background: motorType === "ice" ? "#f59e0b" : "#1f2937",
            }}
          >
            🔥 내연
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gap: 6, fontSize: 16 }}>
        <div>⬆️ I: 전진</div>
        <div>⬇️ K: 후진</div>
        <div>⬅️ J: 좌회전</div>
        <div>➡️ L: 우회전</div>
        <div>🚀 Space: 점프</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleExport}
          style={{
            padding: "6px 10px",
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #374151",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Export Ghost
        </button>
        <button
          onClick={handleImportClick}
          style={{
            padding: "6px 10px",
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #374151",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Import Ghost
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportChange}
          style={{ display: "none" }}
        />
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {!isPlaying && !isPaused && (
            <button onClick={() => startPlayback()} style={btnStyle}>
              ▶ Play
            </button>
          )}
          {isPlaying && (
            <button onClick={() => pausePlayback()} style={btnStyle}>
              ⏸ Pause
            </button>
          )}
          {isPaused && (
            <button onClick={() => resumePlayback()} style={btnStyle}>
              ⏵ Resume
            </button>
          )}
          <button onClick={() => stopPlayback()} style={btnStyle}>
            ⏹ Stop
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <input
            type="range"
            min={0}
            max={getDuration()}
            value={Math.min(getPlayhead(), getDuration())}
            onChange={(e) => seekTo(Number(e.target.value))}
          />
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {`Playhead ${formatTime(Math.floor(getPlayhead()))} / ${formatTime(
              Math.floor(getDuration())
            )}`}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "#1f2937",
  color: "#fff",
  border: "1px solid #374151",
  borderRadius: 6,
  cursor: "pointer",
};
