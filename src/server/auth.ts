import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureUserWorkspace } from "@/db/workspace";
import { auth } from "@/lib/auth";
import { isEmailAllowed } from "@/lib/env";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * Validates the session against the database. React `cache` deduplicates the
 * lookup between layouts, pages and route handlers in the same request.
 */
export const getAuthSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser() {
  const session = await getAuthSession();
  return session?.user ?? null;
}

/**
 * API guard. Returns the authenticated user or throws an error that
 * `errorResponse` maps to 401/403.
 */
export async function requireUser() {
  const session = await getAuthSession();
  const user = session?.user;

  if (!user) {
    throw new UnauthorizedError();
  }

  if (!isEmailAllowed(user.email)) {
    throw new ForbiddenError();
  }

  // First authenticated request after signup seeds the workspace. Idempotent.
  ensureUserWorkspace(user.id);
  return user;
}

/** Page guard. Redirects unauthenticated visitors to the login screen. */
export async function requireUserPage() {
  const user = await getCurrentUser();

  if (!user || !isEmailAllowed(user.email)) {
    redirect("/login");
  }

  ensureUserWorkspace(user.id);
  return user;
}
