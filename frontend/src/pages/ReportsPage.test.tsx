import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { ReportsPage } from "./ReportsPage";

const tokenKey = "grant-review.auth-token";
const officer = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" as const };
const rounds = [
  { id: "round-a", name: "Autumn grants", opensAt: "2026-09-01T00:00:00.000Z", closesAt: "2026-12-01T00:00:00.000Z" },
  { id: "round-b", name: "Spring grants", opensAt: "2027-01-01T00:00:00.000Z", closesAt: "2027-04-01T00:00:00.000Z" },
];
const reviewers = [
  { id: "reviewer-a", name: "Ava Adams", email: "ava@example.test", role: "REVIEWER" as const },
  { id: "reviewer-b", name: "Ben Brooks", email: "ben@example.test", role: "REVIEWER" as const },
];
let fetchMock: ReturnType<typeof vi.fn>;
const downloads: string[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderPage() { return render(<AuthProvider><ReportsPage /></AuthProvider>); }
function restore(handler: (url: string, options?: RequestInit) => Promise<Response>) {
  localStorage.setItem(tokenKey, "token");
  fetchMock.mockImplementation(handler);
}
async function waitForDiscovery() {
  await screen.findByRole("option", { name: "Autumn grants" });
  await screen.findByLabelText("Ava Adams (ava@example.test)");
}
async function selectRoundAndReviewers(roundId = "round-a") {
  await waitForDiscovery();
  fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: roundId } });
  fireEvent.click(screen.getByLabelText("Ava Adams (ava@example.test)"));
  fireEvent.click(screen.getByLabelText("Ben Brooks (ben@example.test)"));
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T10:15" } });
}
function normalHandler(url: string) {
  if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
  if (url.endsWith("/funding-rounds")) return Promise.resolve(json({ fundingRounds: rounds }));
  if (url.endsWith("/reviewers")) return Promise.resolve(json({ reviewers }));
  return Promise.reject(new Error(`Unexpected request: ${url}`));
}

beforeEach(() => {
  localStorage.clear();
  downloads.length = 0;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:report"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
});
afterEach(() => vi.unstubAllGlobals());

describe("ReportsPage", () => {
  it("loads funding rounds and reviewers from their directories", async () => {
    restore(normalHandler);
    renderPage();
    await waitForDiscovery();
    expect(screen.getByRole("option", { name: "Spring grants" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ben Brooks (ben@example.test)")).toBeInTheDocument();
    expect(screen.queryByLabelText(/reviewer id/i)).not.toBeInTheDocument();
  });

  it("shows funding-round and reviewer discovery failures safely", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/funding-rounds")) return Promise.resolve(json({ message: "Funding rounds unavailable." }, 503));
      if (url.endsWith("/reviewers")) return Promise.resolve(json({ reviewers }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Funding rounds unavailable.");

    localStorage.setItem(tokenKey, "token");
    fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/funding-rounds")) return Promise.resolve(json({ fundingRounds: rounds }));
      if (url.endsWith("/reviewers")) return Promise.resolve(json({ message: "Reviewer directory unavailable." }, 503));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getAllByRole("alert")[1]).toHaveTextContent("Reviewer directory unavailable.");
  });

  it("renders supported empty funding-round and reviewer states", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/funding-rounds")) return Promise.resolve(json({ fundingRounds: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(json({ reviewers: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    expect(await screen.findByText("No funding rounds are available.")).toBeInTheDocument();

    localStorage.setItem(tokenKey, "token");
    fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(json({ user: officer }));
      if (url.endsWith("/funding-rounds")) return Promise.resolve(json({ fundingRounds: rounds }));
      if (url.endsWith("/reviewers")) return Promise.resolve(json({ reviewers: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    expect(await screen.findByText("No reviewers are available.")).toBeInTheDocument();
  });

  it("posts selected reviewers and a UTC due date, then renders successes", async () => {
    restore((url, options) => {
      if (url.endsWith("/funding-rounds/round-a/assignments/bulk") && options?.method === "POST") return Promise.resolve(json({ results: [
        { applicationId: "application-a", reviewerId: "reviewer-a", success: true, assignment: {} },
        { applicationId: "application-b", reviewerId: "reviewer-b", success: true, assignment: {} },
      ] }));
      return normalHandler(url);
    });
    renderPage();
    await selectRoundAndReviewers();
    fireEvent.click(screen.getByRole("button", { name: "Bulk assign" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/funding-rounds/round-a/assignments/bulk",
      expect.objectContaining({ method: "POST" }),
    ));
    const request = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/funding-rounds/round-a/assignments/bulk") && (options as RequestInit | undefined)?.method === "POST")![1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({ reviewerIds: ["reviewer-a", "reviewer-b"], dueAt: new Date("2026-09-11T10:15").toISOString() });
    expect(await screen.findByRole("heading", { name: "Assignment results" })).toBeInTheDocument();
    expect(screen.getByText("application-a - Ava Adams: Assigned")).toBeInTheDocument();
    expect(screen.getByText("application-b - Ben Brooks: Assigned")).toBeInTheDocument();
  });

  it("renders mixed HTTP 200 bulk results without converting them into a request failure", async () => {
    restore((url, options) => {
      if (url.endsWith("/funding-rounds/round-a/assignments/bulk") && options?.method === "POST") return Promise.resolve(json({ results: [
        { applicationId: "application-a", reviewerId: "reviewer-a", success: true, assignment: {} },
        { applicationId: "application-b", reviewerId: "reviewer-b", success: false, reason: "Reviewer has an unresolved conflict of interest." },
      ] }));
      return normalHandler(url);
    });
    renderPage();
    await selectRoundAndReviewers();
    fireEvent.click(screen.getByRole("button", { name: "Bulk assign" }));
    expect(await screen.findByText("application-a - Ava Adams: Assigned")).toBeInTheDocument();
    expect(screen.getByText("application-b - Ben Brooks: Reviewer has an unresolved conflict of interest.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prevents duplicate bulk submissions while pending and re-enables controls on completion", async () => {
    let resolveBulk!: (response: Response) => void;
    restore((url, options) => {
      if (url.endsWith("/funding-rounds/round-a/assignments/bulk") && options?.method === "POST") return new Promise<Response>((resolve) => { resolveBulk = resolve; });
      return normalHandler(url);
    });
    renderPage();
    await selectRoundAndReviewers();
    const bulkAssign = screen.getByRole("button", { name: "Bulk assign" });
    fireEvent.click(bulkAssign);
    expect(await screen.findByRole("button", { name: "Working..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Working..." }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/assignments/bulk") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1));
    resolveBulk(json({ results: [] }));
    expect(await screen.findByRole("button", { name: "Bulk assign" })).toBeEnabled();
  });

  it("ignores stale round A success and error after round B becomes active", async () => {
    let aRequests = 0;
    let resolveFirstA!: (response: Response) => void;
    let rejectSecondA!: (error: unknown) => void;
    const firstA = new Promise<Response>((resolve) => { resolveFirstA = resolve; });
    const secondA = new Promise<Response>((_, reject) => { rejectSecondA = reject; });
    restore((url, options) => {
      if (url.endsWith("/funding-rounds/round-a/assignments/bulk") && options?.method === "POST") return aRequests++ === 0 ? firstA : secondA;
      return normalHandler(url);
    });
    renderPage();
    await selectRoundAndReviewers("round-a");
    fireEvent.click(screen.getByRole("button", { name: "Bulk assign" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/funding-rounds/round-a/assignments/bulk"))).toBe(true));
    fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: "round-b" } });
    expect(screen.getByRole("combobox", { name: "Funding round" })).toHaveValue("round-b");
    expect(screen.getByRole("button", { name: "Bulk assign" })).toBeEnabled();
    await act(async () => { resolveFirstA(json({ results: [{ applicationId: "stale-a", reviewerId: "reviewer-a", success: true, assignment: {} }] })); await Promise.resolve(); });
    expect(screen.queryByText(/stale-a/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: "round-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Bulk assign" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/funding-rounds/round-a/assignments/bulk")).length).toBe(2));
    fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: "round-b" } });
    await act(async () => { rejectSecondA(new Error("This stale rejection is intentionally ignored.")); await Promise.resolve(); });
    expect(screen.queryByText("This stale rejection is intentionally ignored.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Funding round" })).toHaveValue("round-b");
    expect(screen.getByRole("button", { name: "Bulk assign" })).toBeEnabled();
  });

  it("keeps bulk B pending when stale export A settles after a round switch", async () => {
    let resolveExportA!: (response: Response) => void;
    let resolveBulkB!: (response: Response) => void;
    restore((url, options) => {
      if (url.endsWith("/funding-rounds/round-a/reviews/export.csv")) return new Promise<Response>((resolve) => { resolveExportA = resolve; });
      if (url.endsWith("/funding-rounds/round-b/assignments/bulk") && options?.method === "POST") return new Promise<Response>((resolve) => { resolveBulkB = resolve; });
      return normalHandler(url);
    });
    renderPage();
    await waitForDiscovery();
    fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: "round-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Export completed reviews CSV" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/funding-rounds/round-a/reviews/export.csv"))).toBe(true));

    await selectRoundAndReviewers("round-b");
    fireEvent.click(screen.getByRole("button", { name: "Bulk assign" }));
    expect(await screen.findByRole("button", { name: "Working..." })).toBeDisabled();
    await act(async () => { resolveExportA(new Response("header")); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Working..." }));
    expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/funding-rounds/round-b/assignments/bulk") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
    await act(async () => { resolveBulkB(json({ results: [] })); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Bulk assign" })).toBeEnabled();
  });

  it("exports CSV using the server filename or the production fallback, and surfaces export failures", async () => {
    let exportCalls = 0;
    restore((url) => {
      if (url.endsWith("/funding-rounds/round-a/reviews/export.csv")) {
        exportCalls += 1;
        if (exportCalls === 1) return Promise.resolve(new Response("header", { headers: { "Content-Disposition": "attachment; filename=server-report.csv" } }));
        if (exportCalls === 2) return Promise.resolve(new Response("header"));
        if (exportCalls === 3) return Promise.resolve(json({ message: "Export unavailable." }, 503));
        return Promise.resolve(new Response("header"));
      }
      return normalHandler(url);
    });
    renderPage();
    await waitForDiscovery();
    fireEvent.change(screen.getByRole("combobox", { name: "Funding round" }), { target: { value: "round-a" } });
    const exportButton = screen.getByRole("button", { name: "Export completed reviews CSV" });
    fireEvent.click(exportButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/funding-rounds/round-a/reviews/export.csv", expect.objectContaining({ headers: expect.any(Headers) })));
    const exportRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/funding-rounds/round-a/reviews/export.csv"))![1] as RequestInit;
    expect(new Headers(exportRequest.headers).get("Authorization")).toBe("Bearer token");
    expect(downloads).toEqual(["server-report.csv"]);
    fireEvent.click(exportButton);
    await waitFor(() => expect(downloads).toEqual(["server-report.csv", "completed-reviews-round-a.csv"]));
    fireEvent.click(exportButton);
    expect(await screen.findByRole("alert")).toHaveTextContent("Export unavailable.");
    expect(exportButton).toBeEnabled();
  });
});
