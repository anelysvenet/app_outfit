"use client";

import { motion } from "framer-motion";

/** Animated brand mark used as the loading indicator while the AI works. */
export default function LogoLoader({
  label,
  size = 76,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        style={{ width: size, height: size }}
        className="relative"
      >
        <svg viewBox="0 0 100 100" width={size} height={size} className="drop-shadow-sm">
          <motion.rect
            width="100"
            height="100"
            rx="22"
            fill="#C4A898"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
          <text
            x="40"
            y="78"
            fontFamily="Georgia, Garamond, 'Times New Roman', serif"
            fontStyle="italic"
            fontSize="82"
            fill="#1C1917"
            textAnchor="middle"
          >
            f
          </text>
          <motion.path
            d="M 70,39 C 70,46 77,53 84,53 C 77,53 70,60 70,67 C 70,60 63,53 56,53 C 63,53 70,46 70,39 Z"
            fill="#1C1917"
            style={{ transformOrigin: "center", transformBox: "fill-box" }}
            animate={{ scale: [0.55, 1, 0.55], opacity: [0.35, 1, 0.35], rotate: [0, 90, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </svg>
        <motion.span
          className="absolute inset-0 rounded-[22px] ring-2 ring-champagne/50"
          animate={{ opacity: [0, 0.6, 0], scale: [1, 1.22, 1.4] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
        />
      </motion.div>
      {label && (
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="max-w-xs text-center text-xs uppercase tracking-[0.3em] text-smoke"
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
