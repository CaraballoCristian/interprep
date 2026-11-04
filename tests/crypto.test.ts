import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  secretHint,
} from "@/server/crypto";

const originalSecret = process.env.SECRETS_ENCRYPTION_KEY;
const originalAuthSecret = process.env.BETTER_AUTH_SECRET;

beforeEach(() => {
  process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-secret";
  delete process.env.BETTER_AUTH_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.SECRETS_ENCRYPTION_KEY;
  } else {
    process.env.SECRETS_ENCRYPTION_KEY = originalSecret;
  }

  if (originalAuthSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = originalAuthSecret;
  }
});

describe("secret encryption", () => {
  it("round-trips a Gemini key", () => {
    const key = "AIzaSy-test-key-1234567890";
    const encrypted = encryptSecret(key);

    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(key);
    expect(decryptSecret(encrypted)).toBe(key);
  });

  it("produces a different payload each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered payloads", () => {
    const encrypted = encryptSecret("AIzaSy-test-key");
    const parts = encrypted.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");

    expect(decryptSecret(parts.join(":"))).toBeNull();
  });

  it("rejects a payload encrypted with another secret", () => {
    const encrypted = encryptSecret("AIzaSy-test-key");
    process.env.SECRETS_ENCRYPTION_KEY = "another-secret";

    expect(decryptSecret(encrypted)).toBeNull();
  });

  it("falls back to BETTER_AUTH_SECRET", () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    process.env.BETTER_AUTH_SECRET = "auth-secret-for-tests";

    const encrypted = encryptSecret("AIzaSy-test-key");
    expect(decryptSecret(encrypted)).toBe("AIzaSy-test-key");
  });

  it("returns the last four characters as a hint", () => {
    expect(secretHint("AIzaSy-test-key-1234")).toBe("1234");
  });
});
