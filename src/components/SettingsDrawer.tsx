"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Settings {
  email: string;
  language: string;
  country: string;
  currency: string;
  subscription: string;
  promoCode: string;
}

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

const COUNTRIES = [
  "France", "Belgique", "Suisse", "Canada", "Maroc", "Tunisie",
  "Sénégal", "Côte d'Ivoire", "Royaume-Uni", "États-Unis", "Allemagne",
  "Espagne", "Italie", "Portugal",
];

const CURRENCIES = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "Livre sterling" },
  { code: "USD", symbol: "$", label: "Dollar américain" },
  { code: "CHF", symbol: "Fr.", label: "Franc suisse" },
  { code: "CAD", symbol: "CA$", label: "Dollar canadien" },
  { code: "MAD", symbol: "د.م.", label: "Dirham marocain" },
];

function ElegantSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; sub?: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-ink/10 bg-white/80 px-5 py-3 text-left shadow-card backdrop-blur transition hover:border-gold/50 hover:shadow-lift"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{current?.label}</span>
          {current?.sub && <span className="text-xs text-smoke">{current.sub}</span>}
        </span>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="h-4 w-4 shrink-0 text-smoke"
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 top-[calc(100%+0.4rem)] z-40 max-h-64 w-full overflow-y-auto rounded-3xl border border-ink/5 bg-[#d8cbb4] p-2 shadow-lift backdrop-blur-xl"
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition ${
                    active ? "bg-ink text-ivory" : "text-ink hover:bg-sand"
                  }`}
                >
                  <motion.span
                    initial={false}
                    animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-champagne"
                  />
                  <span className="flex items-baseline gap-2">
                    <span>{o.label}</span>
                    {o.sub && (
                      <span className={`text-xs ${active ? "text-champagne" : "text-smoke"}`}>
                        {o.sub}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink/8 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-base">{title}</span>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          className="h-4 w-4 shrink-0 text-smoke"
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-smoke">{label}</p>
      {children}
    </div>
  );
}

export default function SettingsDrawer({
  settings,
  onClose,
}: {
  settings: Settings;
  onClose: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>("profil");

  // Profil
  const [newEmail, setNewEmail] = useState(settings.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Abonnement
  const [promo, setPromo] = useState(settings.promoCode);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Langue
  const [language, setLanguage] = useState(settings.language || "fr");
  const [country, setCountry] = useState(settings.country || "France");
  const [currency, setCurrency] = useState(settings.currency || "EUR");
  const [langSaved, setLangSaved] = useState(false);

  const toggle = (s: string) => setOpen((p) => (p === s ? null : s));

  async function changeEmail() {
    setEmailMsg(null);
    const res = await fetch("/api/auth/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: emailPassword, newEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEmailMsg({ ok: true, text: "Email mis à jour." });
      setEmailPassword("");
    } else {
      setEmailMsg({ ok: false, text: data.error ?? "Erreur" });
    }
  }

  async function changePassword() {
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: "Les mots de passe ne correspondent pas." });
      return;
    }
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPwdMsg({ ok: true, text: "Mot de passe mis à jour." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } else {
      setPwdMsg({ ok: false, text: data.error ?? "Erreur" });
    }
  }

  async function deleteAccount() {
    setDeleteMsg(null);
    const res = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push("/login");
    } else {
      setDeleteMsg(data.error ?? "Erreur");
    }
  }

  async function applyPromo() {
    setPromoMsg(null);
    const code = promo.trim().toUpperCase();
    if (!code) { setPromoMsg({ ok: false, text: "Saisissez un code." }); return; }
    // Stub — en production, vérification côté serveur
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: code }),
    });
    setPromoMsg({ ok: true, text: `Code « ${code} » appliqué.` });
  }

  async function saveLanguage() {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, country, currency }),
    });
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  }

  const inputCls = "field !py-2.5";
  const btnSm =
    "rounded-full bg-ink px-5 py-2 text-sm font-medium text-ivory transition hover:bg-night disabled:opacity-40 cursor-pointer";
  const msg = (m: { ok: boolean; text: string } | null) =>
    m ? (
      <p className={`text-xs mt-1 ${m.ok ? "text-gold" : "text-terracotta"}`}>{m.text}</p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-h-[90svh] sm:max-h-[100svh] sm:h-full sm:w-96 overflow-y-auto rounded-t-3xl sm:rounded-none sm:rounded-l-3xl bg-[#dfd3be] shadow-lift"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/8 bg-[#dfd3be]/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold">Paramètres</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-smoke hover:bg-sand transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-10">
          {/* PROFIL */}
          <Section title="Profil" open={open === "profil"} onToggle={() => toggle("profil")}>
            <Field label="Modifier l'adresse email">
              <input className={inputCls} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Nouvel email" />
              <input className={`${inputCls} mt-2`} type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Mot de passe actuel" />
              {msg(emailMsg)}
              <button className={`${btnSm} mt-2`} onClick={changeEmail}>Modifier l'email</button>
            </Field>

            <div className="h-px bg-ink/6 my-1" />

            <Field label="Modifier le mot de passe">
              <input className={inputCls} type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Mot de passe actuel" />
              <input className={`${inputCls} mt-2`} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe (8 car. min.)" />
              <input className={`${inputCls} mt-2`} type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Confirmer le nouveau mot de passe" />
              {msg(pwdMsg)}
              <button className={`${btnSm} mt-2`} onClick={changePassword}>Modifier le mot de passe</button>
            </Field>

            <div className="h-px bg-ink/6 my-1" />

            <Field label="Supprimer le compte">
              <p className="text-xs text-smoke mb-2">Cette action est irréversible. Tous vos vêtements et tenues seront supprimés.</p>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-full border border-terracotta/50 px-5 py-2 text-sm text-terracotta transition hover:bg-terracotta hover:text-ivory cursor-pointer"
                >
                  Supprimer mon compte
                </button>
              ) : (
                <div className="space-y-2">
                  <input className={inputCls} type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Confirmez votre mot de passe" />
                  {deleteMsg && <p className="text-xs text-terracotta">{deleteMsg}</p>}
                  <div className="flex gap-2">
                    <button onClick={deleteAccount} className="rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-ivory transition hover:opacity-90 cursor-pointer">
                      Confirmer la suppression
                    </button>
                    <button onClick={() => { setDeleteConfirm(false); setDeletePassword(""); }} className="text-sm text-smoke hover:text-ink cursor-pointer">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </Field>
          </Section>

          {/* ABONNEMENT */}
          <Section title="Abonnement" open={open === "abo"} onToggle={() => toggle("abo")}>
            <div className="rounded-2xl bg-sand/60 p-4">
              <p className="text-xs text-smoke uppercase tracking-widest">Plan actuel</p>
              <p className="font-semibold text-lg mt-0.5">
                {settings.subscription === "premium" ? "Premium ✦" : "Gratuit"}
              </p>
              {settings.subscription !== "premium" && (
                <button className={`${btnSm} mt-3`}>Passer en Premium</button>
              )}
            </div>

            <Field label="Code promo">
              <div className="flex gap-2">
                <input
                  className="field !py-2.5 flex-1"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value.toUpperCase())}
                  placeholder="Ex : FITME20"
                />
                <button className={btnSm} onClick={applyPromo}>Appliquer</button>
              </div>
              {msg(promoMsg)}
            </Field>
          </Section>

          {/* LANGUE */}
          <Section title="Langue & région" open={open === "lang"} onToggle={() => toggle("lang")}>
            <Field label="Langue">
              <ElegantSelect
                value={language}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                onChange={setLanguage}
              />
            </Field>
            <Field label="Pays">
              <ElegantSelect
                value={country}
                options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                onChange={setCountry}
              />
            </Field>
            <Field label="Devise">
              <ElegantSelect
                value={currency}
                options={CURRENCIES.map((c) => ({ value: c.code, label: c.label, sub: c.symbol }))}
                onChange={setCurrency}
              />
            </Field>
            <button className={btnSm} onClick={saveLanguage}>
              {langSaved ? "✓ Enregistré" : "Enregistrer"}
            </button>
          </Section>

          {/* SUPPORT */}
          <Section title="Support" open={open === "support"} onToggle={() => toggle("support")}>
            <p className="text-sm text-smoke">Une question ou un problème ? Notre équipe vous répond sous 24 h.</p>
            <a
              href="mailto:support@fitme.app"
              className={`${btnSm} inline-flex items-center gap-2`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Contacter le support
            </a>
          </Section>
        </div>
      </motion.div>
    </div>
  );
}
