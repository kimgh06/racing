import { useCarStore } from "~/src/shared/store/carStore";

/**
 * 차량 상태 패널 컴포넌트 (일반 React 컴포넌트)
 * 화면 하단에 표시됩니다.
 */
export default function CarPanel() {
  const {
    position,
    speed,
    collision,
    driftMode,
    score,
    driftGauge,
    detectedDistance,
    detectedObject,
  } = useCarStore();

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "18px",
        border: "2px solid rgba(255, 255, 255, 0.3)",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.5)",
        minWidth: "200px",
        zIndex: 1000,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Position:</span>
          <span
            style={{
              fontWeight: "bold",
            }}
          >
            {position
              ? `${position.x.toFixed(1)}, ${position.y.toFixed(
                  1
                )}, ${position.z.toFixed(1)}`
              : "0.0, 0.0, 0.0"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Speed:</span>
          <span
            style={{
              fontWeight: "bold",
              color: speed > 5 ? "#ff6b6b" : "#4ecdc4",
            }}
          >
            {speed.toFixed(1)} m/s
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Collusion:</span>
          <span
            style={{
              fontWeight: "bold",
              color: collision ? "#ffd93d" : "#95e1d3",
            }}
          >
            {collision ? "Touching" : "Air"}
          </span>
        </div>
        {/* 드리프트 모드 표시 */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Drift:</span>
          <span
            style={{
              fontWeight: "bold",
              color: driftMode ? "#ffd93d" : "#95e1d3",
            }}
          >
            {score}, {driftMode ? "Drift" : "Normal"}
          </span>
        </div>
        {/* 감지된 오브젝트 표시 */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Detect:</span>
          <span
            style={{
              fontWeight: "bold",
              color: detectedObject ? "#00ff00" : "#888",
            }}
          >
            {detectedDistance !== null ? detectedDistance.toFixed(2) : "0.00"}{" "}
            m
          </span>
        </div>
        {/* 드리프트 게이지 */}
      </div>
      <div
        style={{
          width: "100%",
          height: "8px",
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "4px",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          marginTop: "8px",
        }}
      >
        <div
          style={{
            width: `${driftGauge}%`,
            height: "100%",
            background:
              driftGauge > 70
                ? "linear-gradient(90deg, #ff6b6b, #ffd93d)"
                : driftGauge > 40
                ? "linear-gradient(90deg, #ffd93d, #ffed4e)"
                : "linear-gradient(90deg, #95e1d3, #4ecdc4)",
            transition: "width 0.1s ease-out, background 0.1s ease-out",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}

