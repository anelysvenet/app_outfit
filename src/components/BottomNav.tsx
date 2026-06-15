"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  HomeIcon,
  HangerIcon,
  SparklesIcon,
  DiscoIcon,
  UserIcon,
} from "./icons";

const TABS = [
  { href: "/accueil", label: "Accueil", Icon: HomeIcon },
  { href: "/dressing", label: "Dressing", Icon: HangerIcon },
  { href: "/generer", label: "Créer", Icon: SparklesIcon },
  { href: "/soiree", label: "Soirée", Icon: DiscoIcon },
  { href: "/profil", label: "Profil", Icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-around rounded-full border border-ink/5 bg-ivory/90 px-2 py-1.5 shadow-lift backdrop-blur-xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          const isSoiree = href === "/soiree";
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 justify-center"
            >
              <motion.div
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="flex flex-col items-center gap-1 py-1"
              >
                <span className="relative flex h-9 w-9 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="navPill"
                      className={`absolute inset-0 rounded-full ${
                        isSoiree ? "bg-night" : "bg-ink"
                      }`}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <motion.span
                    animate={active ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className={`relative ${
                      active
                        ? isSoiree
                          ? "text-champagne"
                          : "text-ivory"
                        : "text-smoke"
                    }`}
                  >
                    <Icon className="h-[21px] w-[21px]" />
                  </motion.span>
                </span>
                <span
                  className={`text-[10px] leading-none transition-colors ${
                    active ? "font-medium text-ink" : "text-smoke"
                  }`}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
