import { describe, expect, it } from "vitest";
import { readFragmentSession, safeAuthDestination } from "./auth-callback";

describe("safeAuthDestination", () => {
  it("accepts an application-relative path", () => {
    expect(safeAuthDestination("/reset-password")).toBe("/reset-password");
  });

  it.each([null, "", "https://attacker.example", "//attacker.example", "dashboard"])(
    "rejects an unsafe destination: %s",
    (destination) => expect(safeAuthDestination(destination)).toBe("/dashboard"),
  );
});

describe("readFragmentSession", () => {
  it("reads a complete Supabase fragment session", () => {
    expect(readFragmentSession("#access_token=access&refresh_token=refresh&type=invite")).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it.each([
    "",
    "#access_token=access",
    "#refresh_token=refresh",
    "#error=access_denied&error_code=otp_expired&error_description=expired",
  ])("rejects an invalid or failed fragment: %s", (fragment) => {
    expect(readFragmentSession(fragment)).toBeNull();
  });
});