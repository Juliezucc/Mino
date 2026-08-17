import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number towards `target`, e.g. the counter climbing 35 → 50 after a
 * validation. Driven in JS on purpose: the same value feeds the digits and the
 * progress ring, so they can never drift apart.
 */
export function useCountUp(target: number, options?: { duration?: number; enabled?: boolean }) {
  const duration = options?.duration ?? 900;
  const enabled = options?.enabled ?? true;

  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!enabled) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const next = from + (target - from) * easeOutCubic(t);
      setValue(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        setValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, duration, enabled]);

  return value;
}
