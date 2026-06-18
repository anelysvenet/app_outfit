import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/accueil");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-champagne/30 blur-3xl"
      />
      <p className="mb-6 text-xs uppercase tracking-[0.4em] text-gold">
        Votre styliste personnel, propulsé par l&apos;IA
      </p>
      <h1 className="font-display max-w-3xl text-5xl leading-tight sm:text-7xl">
        Votre garde-robe, <em className="text-gold">sublimée</em> chaque matin.
      </h1>
      <p className="mt-6 max-w-xl text-smoke leading-relaxed">
        Photographiez vos vêtements, Fitme les analyse et compose des tenues
        complètes — adaptées à la météo du jour, à l&apos;occasion et à votre
        style. Jusqu&apos;à l&apos;essayage virtuel sur votre propre photo.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/signup" className="btn-primary">
          Créer mon dressing
        </Link>
        <Link href="/login" className="btn-ghost">
          J&apos;ai déjà un compte
        </Link>
      </div>
      <div className="mt-16 grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
        {[
          ["01", "Importez", "Photographiez chaque pièce, l'IA identifie type, coupe, couleurs et matière."],
          ["02", "Générez", "Tenues complètes selon météo, température ressentie, vent, pluie et occasion."],
          ["03", "Essayez", "Visualisez la tenue portée sur votre photo en pied, et notez pour affiner."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl bg-white/60 p-5 shadow-card">
            <p className="text-xs text-gold">{n}</p>
            <p className="font-display mt-1 text-lg">{t}</p>
            <p className="mt-2 text-sm text-smoke leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
