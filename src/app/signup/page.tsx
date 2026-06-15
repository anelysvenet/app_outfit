"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PhotoInput from "@/components/PhotoInput";
import { STYLES } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleStyle(s: string) {
    setStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, styles, photoDataUrl: photo }),
      });
      if (res.ok) {
        router.push("/dressing");
        return;
      }
      // En cas d'erreur serveur, le corps peut ne pas être du JSON (page 500) :
      // on lit le texte sans planter pour toujours afficher un message clair.
      const message = await res
        .json()
        .then((d) => d.error as string | undefined)
        .catch(() => undefined);
      setError(message ?? `Inscription impossible (erreur ${res.status}).`);
      setStep(0);
    } catch {
      setError("Connexion au serveur impossible. Réessayez.");
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  const steps = ["Votre compte", "Vos styles", "Votre silhouette"];

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link href="/" className="font-display text-3xl">
          Fitme<span className="text-gold">.</span>
        </Link>

        <div className="mt-8 flex gap-2">
          {steps.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full transition ${i <= step ? "bg-gold" : "bg-linen"}`}
              />
              <p className={`mt-2 text-xs ${i === step ? "text-ink" : "text-smoke"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="account"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="mt-10"
            >
              <h1 className="font-display text-3xl">Créez votre dressing.</h1>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(1);
                }}
              >
                <input
                  required
                  placeholder="Prénom"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
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
                  minLength={6}
                  placeholder="Mot de passe (6 caractères min.)"
                  className="field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="text-sm text-terracotta">{error}</p>}
                <button className="btn-primary w-full">Continuer</button>
              </form>
              <p className="mt-4 text-sm text-smoke">
                Déjà inscrit·e ?{" "}
                <Link href="/login" className="text-gold underline-offset-4 hover:underline">
                  Se connecter
                </Link>
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="styles"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="mt-10"
            >
              <h1 className="font-display text-3xl">Quels sont vos styles ?</h1>
              <p className="mt-2 text-sm text-smoke">
                Sélectionnez un ou plusieurs styles — l&apos;IA s&apos;en servira
                pour composer vos tenues.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    className={`chip ${styles.includes(s) ? "chip-active" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <button className="btn-ghost" onClick={() => setStep(0)}>
                  Retour
                </button>
                <button
                  className="btn-primary"
                  disabled={styles.length === 0}
                  onClick={() => setStep(2)}
                >
                  Continuer
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="photo"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="mt-10"
            >
              <h1 className="font-display text-3xl">Votre photo en pied.</h1>
              <p className="mt-2 text-sm text-smoke">
                Optionnelle — elle permet l&apos;essayage virtuel de vos tenues.
                Privilégiez une photo en pied, fond neutre, vêtements près du
                corps.
              </p>
              <div className="mx-auto mt-6 max-w-xs">
                <PhotoInput
                  value={photo}
                  onChange={setPhoto}
                  label="Ajouter ma photo en pied"
                />
              </div>
              {error && <p className="mt-4 text-sm text-terracotta">{error}</p>}
              <div className="mt-8 flex justify-between">
                <button className="btn-ghost" onClick={() => setStep(1)}>
                  Retour
                </button>
                <button className="btn-primary" disabled={loading} onClick={submit}>
                  {loading ? "Création…" : photo ? "Créer mon dressing" : "Passer et créer"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
