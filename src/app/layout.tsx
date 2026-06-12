import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "AURA — Votre styliste personnel",
  description:
    "Importez votre garde-robe, laissez l'IA composer des tenues adaptées à la météo, à l'occasion et à votre style.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${fraunces.variable} ${outfit.variable} grain min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
