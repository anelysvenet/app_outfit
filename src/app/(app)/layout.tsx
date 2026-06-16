import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { getCurrentUser } from "@/lib/auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Lang } from "@/lib/i18n";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <LanguageProvider lang={(user.language ?? "fr") as Lang}>
      <div className="min-h-screen">
        <TopBar userName={user.name} />
        <main className="mx-auto max-w-5xl px-5 pt-6 pb-28">{children}</main>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
