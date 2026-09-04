import { describe, expect, it } from "vitest";

import { readApiBaseUrl } from "./config";

describe("API base URL configuration", () => {
  it("allows the local fallback only in development", () => {
    expect(readApiBaseUrl(undefined, true)).toBe("http://localhost:4000");
  });

  it("requires an explicit production URL", () => {
    expect(() => readApiBaseUrl(undefined, false)).toThrow("VITE_API_BASE_URL must be configured for production builds.");
  });

  it("normalizes a configured production URL", () => {
    expect(readApiBaseUrl("https://api.example.test/", false)).toBe("https://api.example.test");
  });
});
