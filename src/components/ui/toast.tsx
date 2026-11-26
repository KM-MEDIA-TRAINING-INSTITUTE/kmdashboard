"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { MOTION_EASE } from "@/components/ui/motion";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: MOTION_EASE }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[var(--shadow-popover)]"
            >
              {t.tone === "success" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              {t.tone === "error" && (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              {t.tone === "info" && (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{t.title}</p>
                {t.detail && (
                  <p className="mt-0.5 text-xs text-slate-500">{t.detail}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
