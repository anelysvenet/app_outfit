import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Nav userName={user.name} />
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
