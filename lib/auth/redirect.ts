/**
 * Only same-origin absolute paths are accepted as post-login destinations.
 * Protocol-relative URLs (`//evil.com`) and backslash tricks (`/\evil.com`)
 * are rejected so the `next` query parameter cannot be used as an open
 * redirect.
 */
export function safeNextPath(
  value: string | string[] | null | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !raw.startsWith("/")) {
    return "/";
  }

  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }

  if (raw === "/login" || raw.startsWith("/login?")) {
    return "/";
  }

  return raw;
}
