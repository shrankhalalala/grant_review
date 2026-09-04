import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { DashboardPage } from "./DashboardPage";

const tokenKey = "grant-review.auth-token";
const officer = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" as const };
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const dashboard = {
  openApplications: 12, overdueReviews: 3, readyForDecision: 4, amountRequestedThisMonth: "1234567890.01",
  applicationsByStatus: [{ status: "SUBMITTED" as const, count: 1 }, { status: "ASSIGNED" as const, count: 2 }, { status: "UNDER_REVIEW" as const, count: 3 }, { status: "DECIDED" as const, count: 4 }],
  applicationsByFundingRound: [{ fundingRound: { id: "round-1", name: "Autumn grants" }, count: 41 }, { fundingRound: { id: "round-2", name: "Spring grants" }, count: 42 }],
  applicationsDecidedByWeek: Array.from({ length: 8 }, (_, index) => ({ weekStart: `2026-0${index + 1}-05T00:00:00.000Z`, count: index + 101 })),
};

function renderPage() { return render(<AuthProvider><DashboardPage /></AuthProvider>); }
function restore(handler: (url: string) => Promise<Response>) { localStorage.setItem(tokenKey, "token"); fetchMock.mockImplementation(handler); }

beforeEach(() => { localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("DashboardPage", () => {
  it("renders backend metrics, breakdowns, and all eight decided-week buckets", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/dashboard")) return Promise.resolve(json({ dashboard }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Open Applications").nextElementSibling).toHaveTextContent("12");
    expect(screen.getByText("Overdue Reviews").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Ready for Decision").nextElementSibling).toHaveTextContent("4");
    expect(screen.getByText("Amount Requested This Month").nextElementSibling).toHaveTextContent("1234567890.01");

    const status = screen.getByRole("heading", { name: "Applications by status" }).parentElement!;
    expect(within(status).getByText("SUBMITTED").nextElementSibling).toHaveTextContent("1");
    expect(within(status).getByText("ASSIGNED").nextElementSibling).toHaveTextContent("2");
    expect(within(status).getByText("UNDER REVIEW").nextElementSibling).toHaveTextContent("3");
    expect(within(status).getByText("DECIDED").nextElementSibling).toHaveTextContent("4");

    const rounds = screen.getByRole("heading", { name: "Applications by funding round" }).parentElement!;
    expect(within(rounds).getByText("Autumn grants").nextElementSibling).toHaveTextContent("41");
    expect(within(rounds).getByText("Spring grants").nextElementSibling).toHaveTextContent("42");

    const weeks = screen.getByRole("heading", { name: "Decided applications by week" }).parentElement!;
    for (const bucket of dashboard.applicationsDecidedByWeek) expect(within(weeks).getByText(String(bucket.count))).toBeInTheDocument();
  });

  it("shows loading while the dashboard request is pending", async () => {
    let resolve!: (response: Response) => void;
    restore((url) => url.endsWith("/dashboard") ? new Promise<Response>((innerResolve) => { resolve = innerResolve; }) : Promise.resolve(json({ user: officer })));
    renderPage();
    expect(await screen.findByText("Loading dashboard...")).toBeInTheDocument();
    resolve(json({ dashboard }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("shows a retryable backend error", async () => {
    restore((url) => url.endsWith("/dashboard") ? Promise.resolve(json({ message: "Dashboard unavailable." }, 503)) : Promise.resolve(json({ user: officer })));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
