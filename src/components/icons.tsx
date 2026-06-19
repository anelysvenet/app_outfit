import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

// Cintre / hanger pour le dressing
export function HangerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 9.3c0-1 .5-1.6 1.3-1.9.7-.3 1.1-.8 1.1-1.6A1.85 1.85 0 0 0 12.6 4" />
      <path d="m12 9.3 8.3 5.2c.9.6.5 2-.6 2H4.3c-1.1 0-1.5-1.4-.6-2L12 9.3Z" />
    </svg>
  );
}

// Étincelles pour la génération de tenues
export function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5 13.7 8 19 9.5 13.7 11 12 16.5 10.3 11 5 9.5 10.3 8 12 2.5Z" />
      <path d="M18 14.5 18.9 17 21 17.7 18.9 18.4 18 21 17.1 18.4 15 17.7 17.1 17 18 14.5Z" />
      <path d="M5.5 14 6.2 16 8 16.6 6.2 17.2 5.5 19 4.8 17.2 3 16.6 4.8 16 5.5 14Z" />
    </svg>
  );
}

// Boule à facettes pour les soirées
export function DiscoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2v3" />
      <circle cx="12" cy="13" r="7.2" />
      <path d="M4.8 13h14.4" />
      <path d="M12 5.8v14.4" />
      <path d="M6.2 8.8c3.7 2.1 7.9 2.1 11.6 0" />
      <path d="M6.2 17.2c3.7-2.1 7.9-2.1 11.6 0" />
      <path d="M9 6.4c-1.6 4.2-1.6 9 0 13.2" />
      <path d="M15 6.4c1.6 4.2 1.6 9 0 13.2" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function CropIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M2 6h14a2 2 0 0 1 2 2v14" />
    </svg>
  );
}

export function RotateCwIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <polyline points="21 4 21 10 15 10" />
      <path d="M18.5 14a8 8 0 1 1-1.9-8.3L21 10" />
    </svg>
  );
}

export function RotateCcwIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <polyline points="3 4 3 10 9 10" />
      <path d="M5.5 14a8 8 0 1 0 1.9-8.3L3 10" />
    </svg>
  );
}

export function SwapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function EraserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 20.5 3.5 16.5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8l-7.5 7.5" />
      <path d="M21 21H8" />
      <path d="m9 12 4 4" />
    </svg>
  );
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
