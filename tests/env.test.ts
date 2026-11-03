import { afterEach, describe, expect, it } from "vitest";
import { getAllowedEmails, getBaseUrl, isEmailAllowed } from "@/lib/env";

const originalAllowedEmails = process.env.ALLOWED_EMAILS;
const originalBaseUrl = process.env.BETTER_AUTH_URL;

afterEach(() => {
  if (originalAllowedEmails === undefined) {
    delete process.env.ALLOWED_EMAILS;
  } else {
    process.env.ALLOWED_EMAILS = originalAllowedEmails;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.BETTER_AUTH_URL;
  } else {
    process.env.BETTER_AUTH_URL = originalBaseUrl;
  }
});

describe("getBaseUrl", () => {
  it("falls back to localhost", () => {
    delete process.env.BETTER_AUTH_URL;
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("removes trailing slashes from the configured URL", () => {
    process.env.BETTER_AUTH_URL = "https://interprep.example.com///";
    expect(getBaseUrl()).toBe("https://interprep.example.com");
  });
});

describe("ALLOWED_EMAILS", () => {
  it("opens registration when the list is empty", () => {
    process.env.ALLOWED_EMAILS = "";
    expect(getAllowedEmails()).toEqual([]);
    expect(isEmailAllowed("anyone@example.com")).toBe(true);
  });

  it("normalizes whitespace, case and empty entries", () => {
    process.env.ALLOWED_EMAILS = " Me@Example.com , friend@example.com, ";
    expect(getAllowedEmails()).toEqual([
      "me@example.com",
      "friend@example.com",
    ]);
    expect(isEmailAllowed("ME@example.com")).toBe(true);
    expect(isEmailAllowed("other@example.com")).toBe(false);
  });
});
