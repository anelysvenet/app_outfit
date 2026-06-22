"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function ElegantSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-ink/10 bg-white/80 px-5 py-2.5 text-left shadow-card backdrop-blur transition hover:border-gold/50"
      >
        <span className={`text-sm ${current ? "text-ink" : "text-smoke"}`}>
          {current?.label ?? placeholder}
        </span>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="h-4 w-4 shrink-0 text-smoke"
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 top-[calc(100%+0.4rem)] z-40 max-h-60 w-full overflow-y-auto rounded-3xl border border-ink/5 bg-white p-2 shadow-lift"
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value || "none"}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition ${
                    active ? "bg-ink text-ivory" : "text-ink hover:bg-sand"
                  }`}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-champagne"
                  />
                  {o.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
