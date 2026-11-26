"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Smooth page entrance (fade + subtle 6px vertical rise, 220ms). */
export function PageTransition({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: MOTION_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container for KPI grids and card lists. */
export function StaggerGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.035 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.22, ease: MOTION_EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Smooth number-counting animation for KPI cards.
 * Respects OS reduced-motion preference and formats integers or decimals cleanly.
 */
export function AnimatedCounter({
  value,
  durationMs = 480,
}: {
  value: number;
  durationMs?: number;
}) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const startVal = prevRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    let raf = 0;
    const startTime = performance.now();
    const isInt = Number.isInteger(endVal);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplay(isInt ? Math.round(current) : Number(current.toFixed(1)));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setDisplay(endVal);
        prevRef.current = endVal;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, prefersReduced]);

  return <span className="tabular-nums">{display.toLocaleString()}</span>;
}

/** Animated modal backdrop + dialog panel. */
export function AnimatedModal({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: MOTION_EASE }}
            className={`relative z-10 w-full ${maxWidth} max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-modal)]`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
