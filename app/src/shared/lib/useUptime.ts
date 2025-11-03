import { useEffect, useMemo, useState } from "react";
import { useTimeStore } from "~/src/features/checkpoint-system/timeStore";
import formatTime from "~/src/shared/lib/formatTIme";

export function useUptime() {
  const { startTime, getUptime } = useTimeStore();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      setElapsedMs(startTime > 0 ? getUptime() : 0);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [startTime, getUptime]);

  const formatted = useMemo(
    () => formatTime(Math.max(0, Math.floor(elapsedMs))),
    [elapsedMs]
  );

  return { elapsedMs, formatted };
}
