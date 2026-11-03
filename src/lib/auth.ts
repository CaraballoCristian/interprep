import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as authSchema from "@/db/auth-schema";
import { ensureUserWorkspace } from "@/db/workspace";
import { getBaseUrl, isEmailAllowed } from "./env";

/**
 * Better Auth runs in the Node.js runtime. During `next build` the runtime
 * secrets are intentionally absent, so the config falls back to safe
 * placeholders and `assertRuntimeEnv()` rejects a production start without
 * real values.
 */
const BUILD_SECRET = "interprep-build-only-placeholder-secret-32";

const google =
  process.env.GOOGLE_CLIENT_ID?.trim() &&
  process.env.GOOGLE_CLIENT_SECRET?.trim()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID.trim(),
          clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
          prompt: "select_account" as const,
        },
      }
    : {};

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET?.trim() || BUILD_SECRET,
  trustedOrigins: [getBaseUrl()],
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema: authSchema,
  }),
  socialProviders: google,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowed(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "This account is not allowed to use this instance.",
            });
          }
        },
        after: async (user) => {
          ensureUserWorkspace(user.id);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // Re-check on every sign-in so tightening ALLOWED_EMAILS also
          // blocks accounts that already exist.
          const row = getDb()
            .select({ email: authSchema.user.email })
            .from(authSchema.user)
            .where(eq(authSchema.user.id, session.userId))
            .get();

          if (row && !isEmailAllowed(row.email)) {
            throw new APIError("FORBIDDEN", {
              message: "This account is not allowed to use this instance.",
            });
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
