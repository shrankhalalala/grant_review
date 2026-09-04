import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, ThemeToggle } from "./theme";

beforeEach(() => { localStorage.clear(); document.documentElement.dataset.theme = ""; vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }))); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("theme preference", () => {
  it("restores a saved theme and persists a toggle", () => {
    localStorage.setItem("grant-review.theme", "dark");
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Use light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("grant-review.theme")).toBe("light");
  });
});
