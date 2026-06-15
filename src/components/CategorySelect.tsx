"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface SelectOption {
  value: string;
  label: string;
  count: number;
}

export default function CategorySelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-ink/10 bg-white/80 px-5 py-3 text-left shadow-card backdrop-blur transition hover:border-gold/60 hover:shadow-lift"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{current?.label}</span>
          <span className="text-xs text-gold">{current?.count}</span>
        </span>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="h-4 w-4 shrink-0 text-smoke"
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 top-[calc(100%+0.5rem)] z-30 max-h-72 w-full overflow-y-auto rounded-3xl border border-ink/5 bg-ivory/95 p-2 shadow-lift backdrop-blur-xl"
          >
            {options.map((o) => {
              const active = o.value === value;
              const disabled = o.count === 0 && o.value !== "tous";
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-ink text-ivory"
                      : disabled
                        ? "cursor-not-allowed text-smoke/40"
                        : "text-ink hover:bg-sand"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <motion.span
                      initial={false}
                      animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      className="h-1.5 w-1.5 rounded-full bg-champagne"
                    />
                    {o.label}
                  </span>
                  <span
                    className={`text-xs ${
                      active ? "text-champagne" : disabled ? "text-smoke/40" : "text-gold"
                    }`}
                  >
                    {o.count}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
