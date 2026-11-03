import { redirect } from "next/navigation";
import { safeNextPath } from "@lib/auth/redirect";
import { LoginForm } from "@/components/login-form";
import { isEmailAllowed } from "@/lib/env";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const error = first(params.error)?.toLowerCase() ?? "";
  const user = await getCurrentUser();
  const allowed = user ? isEmailAllowed(user.email) : false;

  if (user && allowed) {
    redirect(nextPath);
  }

  const accessDenied =
    (user !== null && !allowed) ||
    error.includes("access") ||
    error.includes("forbidden");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <LoginForm
        nextPath={nextPath}
        accessDenied={accessDenied}
        signedInAs={user?.email ?? null}
        failed={error !== "" && !accessDenied}
      />
    </main>
  );
}
