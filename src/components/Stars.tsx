"use client";

import { useState } from "react";

export default function Stars({
  value,
  onChange,
  size = "text-xl",
}: {
  value?: number;
  onChange?: (rating: number) => void;
  size?: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value || 0;
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`${size} transition-transform ${onChange ? "cursor-pointer hover:scale-125" : "cursor-default"} ${
            n <= active ? "text-gold" : "text-linen"
          }`}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
