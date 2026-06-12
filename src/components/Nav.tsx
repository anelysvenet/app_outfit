"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dressing", label: "Dressing" },
  { href: "/generer", label: "Créer une tenue" },
  { href: "/tenues", label: "Mes tenues" },
  { href: "/soiree", label: "Soirée" },
  { href: "/profil", label: "Profil" },
];

export default function Nav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/dressing" className="font-display text-2xl tracking-wide">
          AURA<span className="text-gold">.</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            const isSoiree = l.href === "/soiree";
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? isSoiree
                      ? "bg-night text-champagne"
                      : "bg-ink text-ivory"
                    : "text-smoke hover:text-ink"
                } ${isSoiree && !active ? "italic font-display" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-smoke">{userName}</span>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            className="text-sm text-smoke hover:text-terracotta transition cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      </div>
      <nav className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${
                active ? "bg-ink text-ivory" : "text-smoke"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
