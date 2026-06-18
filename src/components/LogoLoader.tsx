"use client";

import { motion } from "framer-motion";

/**
 * Animated brand mark (italic "f" + twinkling 4-point sparkle) used as the
 * loading indicator while the AI works. Pass `fullscreen` to centre it as an
 * overlay in the middle of the screen.
 */
export default function LogoLoader({
  label,
  size = 60,
  fullscreen = false,
}: {
  label?: string;
  size?: number;
  fullscreen?: boolean;
}) {
  const mark = (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.svg
        viewBox="0 0 130 110"
        width={Math.round(size * 1.18)}
        height={size}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      >
        <motion.text
          x="44"
          y="80"
          fontFamily="Georgia, Garamond, 'Times New Roman', serif"
          fontStyle="italic"
          fontSize="92"
          fill="#1C1917"
          textAnchor="middle"
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          f
        </motion.text>
        <g transform="translate(101,62)">
          <motion.path
            d="M 0,-15 C 0,-7.5 7.5,0 15,0 C 7.5,0 0,7.5 0,15 C 0,7.5 -7.5,0 -15,0 C -7.5,0 0,-7.5 0,-15 Z"
            fill="#1C1917"
            style={{ transformOrigin: "center", transformBox: "fill-box" }}
            animate={{ scale: [0.5, 1, 0.5], opacity: [0.35, 1, 0.35], rotate: [0, 90, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </g>
      </motion.svg>
      {label && (
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="max-w-xs text-center text-[11px] uppercase tracking-[0.3em] text-smoke"
        >
          {label}
        </motion.p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] flex items-center justify-center bg-ivory/90 backdrop-blur-sm"
      >
        {mark}
      </motion.div>
    );
  }

  return <div className="flex items-center justify-center py-4">{mark}</div>;
}
