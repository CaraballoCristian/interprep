import { AppShell } from "@/components/app-shell";
import { requireUserPage } from "@/server/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUserPage();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
