"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogoutIcon } from "./icons";

export default function TopBar({ userName }: { userName: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-ivory/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <Link href="/accueil" className="font-display text-2xl tracking-wide">
          Fitme<span className="text-gold">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-smoke sm:block">{userName}</span>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            aria-label="Déconnexion"
            className="flex h-9 w-9 items-center justify-center rounded-full text-smoke transition hover:bg-sand hover:text-terracotta"
          >
            <LogoutIcon className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
}
