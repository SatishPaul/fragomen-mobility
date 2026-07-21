import { afterEach, describe, expect, it } from "vitest";
import { getAppUrl } from "./app-url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = originalProductionUrl;
});

describe("getAppUrl", () => {
  it("prefers the configured canonical URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://fragomen-mobility.vercel.app/path";
    expect(getAppUrl("https://preview.example")).toBe("https://fragomen-mobility.vercel.app");
  });

  it("normalizes a Vercel production hostname", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "fragomen-mobility.vercel.app";
    expect(getAppUrl()).toBe("https://fragomen-mobility.vercel.app");
  });

  it("permits localhost for development", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getAppUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects insecure non-local origins", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(() => getAppUrl("http://example.com")).toThrow("must use HTTPS");
  });
});