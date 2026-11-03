const DEFAULT_BASE_URL = "http://localhost:3000";

export function getBaseUrl(): string {
  const url = process.env.BETTER_AUTH_URL?.trim() || DEFAULT_BASE_URL;
  // A trailing slash would produce mismatched OAuth redirect URIs.
  return url.replace(/\/+$/, "");
}

/** Emails allowed to sign in. An empty list means open registration. */
export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

/**
 * Fails fast at server start when production secrets are missing. It is
 * intentionally skipped during `next build`, which does not have runtime
 * secrets available.
 */
export function assertRuntimeEnv(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const required = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ] as const;

  const missing = required.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be at least 32 characters long.",
    );
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "";
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error("BETTER_AUTH_URL must start with http:// or https://");
  }
}
