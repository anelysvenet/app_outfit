import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Fitme — Votre styliste personnel",
  description:
    "Importez votre garde-robe, laissez l'IA composer des tenues adaptées à la météo, à l'occasion et à votre style.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${playfair.variable} grain min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
