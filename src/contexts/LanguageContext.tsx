"use client";
import { createContext, useContext } from "react";
import type { Lang } from "@/lib/i18n";
import { getT } from "@/lib/i18n";

const LanguageContext = createContext<{ lang: Lang; t: (key: string) => string }>({
  lang: "fr",
  t: getT("fr"),
});

export function LanguageProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const t = getT(lang);
  return <LanguageContext.Provider value={{ lang, t }}>{children}</LanguageContext.Provider>;
}

export function useT() {
  return useContext(LanguageContext).t;
}

export function useLang() {
  return useContext(LanguageContext).lang;
}
