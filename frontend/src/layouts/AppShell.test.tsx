import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme";
import { AppShell } from "./AppShell";

const user = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" as const };
function json(body: unknown) { return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }); }
function renderShell() { return render(<ThemeProvider><MemoryRouter initialEntries={["/program/dashboard"]}><AuthProvider><Routes><Route element={<AppShell role="PROGRAM_OFFICER" navigation={[{ label: "Dashboard", to: "/program/dashboard" }, { label: "Reports", to: "/program/reports" }]} />}><Route path="/program/dashboard" element={<Outlet />} /></Route></Routes></AuthProvider></MemoryRouter></ThemeProvider>); }

beforeEach(() => { localStorage.clear(); localStorage.setItem("grant-review.auth-token", "token"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ user }))); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("AppShell navigation", () => {
  it("persists collapsed navigation while retaining accessible route labels", async () => {
    renderShell();
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(localStorage.getItem("grant-review.sidebar-collapsed")).toBe("true");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
  });
});
