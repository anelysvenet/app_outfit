import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600", "700"],
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
      <body className={`${cormorant.variable} grain min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
