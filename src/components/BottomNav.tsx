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
  SuitcaseIcon,
} from "./icons";
import { useT } from "@/contexts/LanguageContext";

export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  const TABS = [
    { href: "/accueil", label: t("nav.home"), Icon: HomeIcon },
    { href: "/dressing", label: t("nav.dressing"), Icon: HangerIcon },
    { href: "/generer", label: t("nav.create"), Icon: SparklesIcon, featured: true },
    { href: "/travel", label: t("nav.travel"), Icon: SuitcaseIcon },
    { href: "/soiree", label: t("nav.evening"), Icon: DiscoIcon },
    { href: "/profil", label: t("nav.profile"), Icon: UserIcon },
  ];

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-end justify-around rounded-full border border-ink/5 bg-ivory/90 px-2 py-1.5 shadow-lift backdrop-blur-xl">
        {TABS.map(({ href, label, Icon, featured }) => {
          const active = pathname.startsWith(href);
          const isSoiree = href === "/soiree";

          // Bouton central « Créer » : surélevé, plus grand, halo néon doré.
          if (featured) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center"
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="-mt-7 flex flex-col items-center"
                >
                  <motion.span
                    animate={{
                      boxShadow: [
                        "0 0 6px rgba(154,123,79,0.45), 0 0 0 rgba(216,195,154,0)",
                        "0 0 20px rgba(216,195,154,0.9), 0 0 34px rgba(154,123,79,0.55)",
                        "0 0 6px rgba(154,123,79,0.45), 0 0 0 rgba(216,195,154,0)",
                      ],
                    }}
                    transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-champagne/40 bg-gradient-to-b from-ink to-night"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.16, 1], opacity: [0.9, 1, 0.9] }}
                      transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
                      className="text-champagne"
                    >
                      <SparklesIcon className="h-8 w-8" />
                    </motion.span>
                  </motion.span>
                  <span
                    className={`mt-1 text-[10px] font-medium leading-none ${
                      active ? "text-gold" : "text-gold/90"
                    }`}
                  >
                    {label}
                  </span>
                </motion.div>
              </Link>
            );
          }

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
