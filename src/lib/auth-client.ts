"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser client. It talks to the same origin, so no base URL is needed and
 * the session cookie is sent automatically.
 */
export const authClient = createAuthClient();
