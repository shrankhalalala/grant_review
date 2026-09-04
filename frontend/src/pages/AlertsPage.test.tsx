import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { ProgramShell } from "../layouts/ProgramShell";
import { AlertsPage } from "./AlertsPage";

const tokenKey = "grant-review.auth-token";
const officer = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" as const };
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const alerts = [
  { id: "alert-a", assignmentId: "assignment-a", application: { id: "application-a", organizationName: "Acme Foundation" }, reviewer: { id: "reviewer-a", name: "Ava Adams" }, dueAtSnapshot: "2026-09-10T14:30:00.000Z", dismissedAt: null, triggeredAt: "2026-09-11T00:00:00.000Z", createdAt: "2026-09-11T00:00:00.000Z" },
  { id: "alert-b", assignmentId: "assignment-b", application: { id: "application-b", organizationName: "Beacon Labs" }, reviewer: { id: "reviewer-b", name: "Ben Brooks" }, dueAtSnapshot: "2026-09-11T14:30:00.000Z", dismissedAt: null, triggeredAt: "2026-09-12T00:00:00.000Z", createdAt: "2026-09-12T00:00:00.000Z" },
];

function renderPage() { return render(<MemoryRouter initialEntries={["/program/alerts"]}><AuthProvider><Routes><Route element={<ProgramShell />}><Route path="/program/alerts" element={<AlertsPage />} /></Route></Routes></AuthProvider></MemoryRouter>); }
function restore(handler: (url: string, options?: RequestInit) => Promise<Response>) { localStorage.setItem(tokenKey, "token"); fetchMock.mockImplementation(handler); }

beforeEach(() => { localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("AlertsPage and ProgramShell", () => {
  it("renders populated alerts with the shell badge", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ count: 3 }));
      if (url.endsWith("/alerts/overdue")) return Promise.resolve(json({ alerts }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByRole("link", { name: "Alerts (3)" })).toBeInTheDocument();
    expect(screen.getByText("Acme Foundation")).toBeInTheDocument();
    expect(screen.getByText("Ava Adams")).toBeInTheDocument();
    expect(screen.getByText("Beacon Labs")).toBeInTheDocument();
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
    expect(screen.getAllByText(/^Due /)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(2);
  });

  it("handles zero and failed badge counts without a misleading positive badge", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ count: 0 }));
      if (url.endsWith("/alerts/overdue")) return Promise.resolve(json({ alerts: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByRole("link", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Alerts \([1-9]/ })).not.toBeInTheDocument();

    localStorage.clear();
    localStorage.setItem(tokenKey, "token");
    fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ message: "Unavailable" }, 503));
      if (url.endsWith("/alerts/overdue")) return Promise.resolve(json({ alerts: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    expect(await screen.findAllByRole("link", { name: "Alerts" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Alerts \([1-9]/ })).not.toBeInTheDocument();
  });

  it("renders empty, loading, and error states", async () => {
    let resolveAlerts!: (response: Response) => void;
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ count: 0 }));
      if (url.endsWith("/alerts/overdue")) return new Promise<Response>((resolve) => { resolveAlerts = resolve; });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByText("Loading alerts...")).toBeInTheDocument();
    resolveAlerts(json({ alerts: [] }));
    expect(await screen.findByText("No overdue review alerts.")).toBeInTheDocument();

    localStorage.clear();
    localStorage.setItem(tokenKey, "token");
    fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ count: 0 }));
      if (url.endsWith("/alerts/overdue")) return Promise.resolve(json({ message: "Alerts unavailable." }, 503));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Alerts unavailable.");
  });

  it("dismisses once while pending, removes the alert, and refreshes the badge from two to one", async () => {
    let countRequests = 0;
    let resolveDismiss!: (response: Response) => void;
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/alerts/overdue/count")) return Promise.resolve(json({ count: countRequests++ === 0 ? 2 : 1 }));
      if (url.endsWith("/alerts/overdue/alert-a/dismiss") && options?.method === "POST") return new Promise<Response>((resolve) => { resolveDismiss = resolve; });
      if (url.endsWith("/alerts/overdue")) return Promise.resolve(json({ alerts }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByRole("link", { name: "Alerts (2)" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(await screen.findByRole("button", { name: "Dismissing..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Dismissing..." }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/alerts/overdue/alert-a/dismiss") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1));
    resolveDismiss(json({ alert: alerts[0] }));
    await waitFor(() => expect(screen.queryByText("Acme Foundation")).not.toBeInTheDocument());
    expect(screen.getByText("Beacon Labs")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Alerts (1)" })).toBeInTheDocument();
  });
});
