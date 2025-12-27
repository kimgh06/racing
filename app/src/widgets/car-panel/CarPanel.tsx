import { useState, useEffect } from "react";
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
    lapTime,
    savePointId,
  } = useCarStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 실행
    setMounted(true);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background:
          "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "#ffffff",
        padding: "12px 16px",
        borderRadius: "12px",
        fontFamily:
          '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
        fontSize: "12px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow:
          "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        minWidth: "360px",
        maxWidth: "440px",
        zIndex: 1000,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* 랩 타임 헤더 섹션 */}
      {mounted && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "10px",
            marginBottom: "10px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div
              style={{
                fontSize: "9px",
                color: "rgba(255, 255, 255, 0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Checkpoint
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#60a5fa",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              #{savePointId}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  color: "rgba(255, 255, 255, 0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Time
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#34d399",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Math.floor(performance.now() / 1000)}s
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "2px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  color: "rgba(255, 255, 255, 0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Lap
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color:
                    lapTime > 600000 ? "rgba(255, 255, 255, 0.3)" : "#a78bfa",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {lapTime > 600000 ? "--" : `${Math.floor(lapTime / 1000)}s`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 차량 상태 정보 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px",
        }}
      >
        {/* Position */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "11px",
              fontWeight: "500",
            }}
          >
            Position
          </span>
          <span
            style={{
              fontWeight: "600",
              color: "#ffffff",
              fontVariantNumeric: "tabular-nums",
              fontSize: "11px",
            }}
          >
            {position
              ? `${position.x.toFixed(1)}, ${position.y.toFixed(
                  1
                )}, ${position.z.toFixed(1)}`
              : "0.0, 0.0, 0.0"}
          </span>
        </div>

        {/* Speed */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "11px",
              fontWeight: "500",
            }}
          >
            Speed
          </span>
          <span
            style={{
              fontWeight: "700",
              color: speed > 5 ? "#f87171" : "#4ade80",
              fontVariantNumeric: "tabular-nums",
              fontSize: "12px",
            }}
          >
            {speed.toFixed(1)} m/s
          </span>
        </div>

        {/* Collision */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "11px",
              fontWeight: "500",
            }}
          >
            Contact
          </span>
          <span
            style={{
              fontWeight: "600",
              color: collision ? "#fbbf24" : "#6ee7b7",
              fontSize: "11px",
            }}
          >
            {collision ? "Touching" : "Air"}
          </span>
        </div>

        {/* Drift */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "11px",
              fontWeight: "500",
            }}
          >
            Drift Mode
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontWeight: "700",
                color: driftMode ? "#fbbf24" : "#a5b4fc",
                fontSize: "11px",
              }}
            >
              {driftMode ? "Drift" : "Normal"}
            </span>
            {score > 0 && (
              <span
                style={{
                  fontWeight: "600",
                  color: "#ffffff",
                  background: "rgba(251, 191, 36, 0.2)",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontSize: "9px",
                }}
              >
                {score}
              </span>
            )}
          </div>
        </div>

        {/* Detection */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
            gridColumn: "span 2",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "11px",
              fontWeight: "500",
            }}
          >
            Detection
          </span>
          <span
            style={{
              fontWeight: "600",
              color: detectedObject ? "#4ade80" : "rgba(255, 255, 255, 0.4)",
              fontVariantNumeric: "tabular-nums",
              fontSize: "11px",
            }}
          >
            {detectedDistance !== null
              ? `${detectedDistance.toFixed(2)} m`
              : "0.00 m"}
          </span>
        </div>
      </div>

      {/* 드리프트 게이지 */}
      <div
        style={{
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "10px",
              fontWeight: "500",
            }}
          >
            Drift Gauge
          </span>
          <span
            style={{
              fontWeight: "700",
              color: "#ffffff",
              fontSize: "11px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(driftGauge)}%
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: "8px",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${driftGauge}%`,
              height: "100%",
              background:
                driftGauge > 70
                  ? "linear-gradient(90deg, #f87171 0%, #fbbf24 100%)"
                  : driftGauge > 40
                  ? "linear-gradient(90deg, #fbbf24 0%, #fde047 100%)"
                  : "linear-gradient(90deg, #34d399 0%, #60a5fa 100%)",
              transition:
                "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease",
              borderRadius: "6px",
              boxShadow:
                driftGauge > 70
                  ? "0 0 12px rgba(248, 113, 113, 0.4)"
                  : driftGauge > 40
                  ? "0 0 8px rgba(251, 191, 36, 0.3)"
                  : "0 0 4px rgba(52, 211, 153, 0.2)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
