import { describe, expect, it } from "vitest";
import { isSupabaseAuthFragment, readFragmentSession, safeAuthDestination } from "./auth-callback";

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

describe("isSupabaseAuthFragment", () => {
  it.each([
    "#access_token=access&refresh_token=refresh&type=invite",
    "#access_token=access&refresh_token=refresh&type=recovery",
    "#error=access_denied&error_code=otp_expired",
  ])("recognizes a Supabase account link: %s", (fragment) => {
    expect(isSupabaseAuthFragment(fragment)).toBe(true);
  });

  it.each(["", "#section=how", "#access_token=unrelated&type=signup"])(
    "ignores an unrelated fragment: %s",
    (fragment) => expect(isSupabaseAuthFragment(fragment)).toBe(false),
  );
});