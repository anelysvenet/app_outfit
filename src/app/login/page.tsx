"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/accueil");
        return;
      }
      const message = await res
        .json()
        .then((d) => d.error as string | undefined)
        .catch(() => undefined);
      setError(message ?? `Connexion impossible (erreur ${res.status}).`);
    } catch {
      setError("Connexion au serveur impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-3xl">
          AURA<span className="text-gold">.</span>
        </Link>
        <h1 className="font-display mt-8 text-3xl">Bon retour.</h1>
        <p className="mt-2 text-sm text-smoke">
          Connectez-vous pour retrouver votre dressing.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            placeholder="Adresse email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Mot de passe"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-terracotta">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="mt-6 text-sm text-smoke">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-gold underline-offset-4 hover:underline">
            Créer mon dressing
          </Link>
        </p>
      </div>
    </main>
  );
}
