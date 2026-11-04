import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Derives a 32-byte key from the dedicated secret when present, falling back
 * to BETTER_AUTH_SECRET so an existing deployment keeps working without a new
 * mandatory variable. Rotating either secret makes stored keys unreadable on
 * purpose: the user must paste the API key again.
 */
function encryptionKey(): Buffer {
  const secret =
    process.env.SECRETS_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "Missing SECRETS_ENCRYPTION_KEY or BETTER_AUTH_SECRET.",
    );
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      "interprep",
      "settings-encryption-v1",
      32,
    ),
  );
}

/** Encrypts a secret with AES-256-GCM and returns a versioned payload. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Returns null when the payload is malformed or the secret changed. */
export function decryptSecret(payload: string): string | null {
  try {
    const [version, ivPart, tagPart, dataPart] = payload.split(":");

    if (
      version !== VERSION ||
      !ivPart ||
      !tagPart ||
      !dataPart
    ) {
      return null;
    }

    const iv = Buffer.from(ivPart, "base64");
    const tag = Buffer.from(tagPart, "base64");
    const data = Buffer.from(dataPart, "base64");

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      return null;
    }

    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

/** Last four characters, safe to show in the UI. */
export function secretHint(plain: string): string {
  return plain.slice(-4);
}
