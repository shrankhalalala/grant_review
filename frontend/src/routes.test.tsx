import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth/AuthProvider";
import { dateTimeInputFromIso, localDateTimeToIso } from "./pages/ProgramApplicationsPage";
import { AppRoutes } from "./routes";
import type { User } from "./types/auth";

const tokenKey = "grant-review.auth-token";
const officer: User = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" };
const reviewer: User = { id: "reviewer-1", name: "Ava", email: "ava@example.test", role: "REVIEWER" };
let fetchMock: ReturnType<typeof vi.fn>;
const application = {
  id: "application-1", organizationName: "Example Foundation", contactEmail: "contact@example.org", fundingRoundId: "round-1", requestedAmount: "1000.01", submittedAt: "2026-09-03T00:00:00.000Z", status: "SUBMITTED", archivedAt: null, ownerId: officer.id, createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z",
  fundingRound: { id: "round-1", name: "Spring grants", opensAt: "2026-01-01T00:00:00.000Z", closesAt: "2026-03-31T00:00:00.000Z" }, owner: officer, reviews: [], fundingDecision: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>);
}

function restore(user: User) {
  localStorage.setItem(tokenKey, "persisted-token");
  fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("authentication and role routing", () => {
  it.each(["/program/dashboard", "/reviewer/assignments"])("redirects an unauthenticated protected route to login", async (path) => {
    renderRoute(path);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it.each(["/program/dashboard", "/program/applications", "/program/alerts", "/program/reports"])("redirects a Reviewer away from Program Officer routes", async (path) => {
    restore(reviewer);
    renderRoute(path);
    expect(await screen.findByRole("link", { name: "My assignments" })).toBeInTheDocument();
  });

  it("redirects a Program Officer away from Reviewer routes", async () => {
    restore(officer);
    renderRoute("/reviewer/assignments");
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("does not expose the retired Program Officer assignments placeholder", async () => {
    restore(officer);
    renderRoute("/program/assignments");
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText("Reviewer assignment coordination will arrive in a later Phase 12 pass.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assignments" })).not.toBeInTheDocument();
  });

  it("restores a persisted session through /auth/me with a bearer token", async () => {
    restore(reviewer);
    renderRoute("/reviewer/assignments");
    expect(await screen.findByRole("heading", { name: "My assignments" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/auth/me", expect.objectContaining({ headers: expect.any(Headers) })));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer persisted-token");
  });

  it("clears an invalid persisted token and resolves protected routes to login", async () => {
    localStorage.setItem(tokenKey, "invalid-token");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Authentication required." }, 401));
    renderRoute("/program/dashboard");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(localStorage.getItem(tokenKey)).toBeNull();
  });

  it("keeps the session-restore loading screen visible before resolving login redirects", async () => {
    let resolveSession!: (response: Response) => void;
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { resolveSession = resolve; }));
    renderRoute("/login");
    expect(await screen.findByText(/Restoring your session/)).toBeInTheDocument();
    resolveSession(jsonResponse({ user: officer }));
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it.each([
    [officer, "/program/dashboard", "Dashboard"],
    [reviewer, "/reviewer/assignments", "My assignments"],
  ] as const)("routes a %s login to its role home", async (user, _expectedPath, destination) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "new-token", user }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
    renderRoute("/login");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("link", { name: destination })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4000/auth/login");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ email: user.email, password: "password" }) });
  });

  it("clears the session and returns to login on logout", async () => {
    restore(officer);
    renderRoute("/program/dashboard");
    const logout = await screen.findByRole("button", { name: "Log out" });
    fireEvent.click(logout);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(localStorage.getItem(tokenKey)).toBeNull();
  });
});

describe("Program Officer application management", () => {
  it("preserves an ISO instant through datetime-local conversion in a fixed non-UTC timezone", () => {
    const environment = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    const previousTimeZone = environment.TZ;
    environment.TZ = "America/New_York";
    try {
      const instant = "2026-09-03T00:00:00.000Z";
      expect(dateTimeInputFromIso(instant)).toBe("2026-09-02T20:00");
      expect(localDateTimeToIso(dateTimeInputFromIso(instant))).toBe(instant);
    } finally {
      if (previousTimeZone === undefined) delete environment.TZ;
      else environment.TZ = previousTimeZone;
    }
  });

  function restoreApplications() {
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications/application-1/archive")) return Promise.resolve(jsonResponse({ application: { ...application, archivedAt: "2026-09-04T00:00:00.000Z" } }));
      if (url.includes("/applications/application-1/restore")) return Promise.resolve(jsonResponse({ application }));
      if (url.endsWith("/applications/application-1") && options?.method === "PATCH") return Promise.resolve(jsonResponse({ application: { ...application, organizationName: "Updated Foundation" } }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application }));
      if (url.endsWith("/applications") && options?.method === "POST") return Promise.resolve(jsonResponse({ application: { ...application, id: "application-2", organizationName: "New Foundation" } }, 201));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [application], total: 1, page: 1, pageSize: 20 }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  }

  it("renders applications and sends discovery filters to the API", async () => {
    restoreApplications();
    renderRoute("/program/applications");
    expect(await screen.findByRole("button", { name: "Example Foundation" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search applications" }), { target: { value: "example" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("search=example"))).toBe(true));
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "SUBMITTED" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("status=SUBMITTED"))).toBe(true));
  });

  it("creates an application and exposes archive and restore actions from detail", async () => {
    restoreApplications();
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "New application" }));
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "New Foundation" } });
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "new@example.org" } });
    fireEvent.change(screen.getByLabelText("Application funding round ID"), { target: { value: "round-1" } });
    fireEvent.change(screen.getByLabelText("Requested amount"), { target: { value: "2500.00" } });
    fireEvent.change(screen.getByLabelText("Submitted at"), { target: { value: "2026-09-03T10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith("/applications") && (options as RequestInit).method === "POST")).toBe(true));
    const create = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/applications") && (options as RequestInit).method === "POST")![1] as RequestInit;
    expect(JSON.parse(create.body as string)).toEqual({ organizationName: "New Foundation", contactEmail: "new@example.org", fundingRoundId: "round-1", requestedAmount: "2500.00", submittedAt: new Date("2026-09-03T10:30").toISOString() });
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Updated Foundation" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith("/applications/application-1") && (options as RequestInit).method === "PATCH")).toBe(true));
    const update = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/applications/application-1") && (options as RequestInit).method === "PATCH")![1] as RequestInit;
    expect(JSON.parse(update.body as string)).toEqual({ organizationName: "Updated Foundation", contactEmail: "contact@example.org", fundingRoundId: "round-1", requestedAmount: "1000.01", submittedAt: application.submittedAt });
    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/applications/application-1/archive", expect.objectContaining({ method: "POST" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/applications/application-1/restore", expect.objectContaining({ method: "POST" }));
  });

  it("shows a retryable list failure", async () => {
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => url.endsWith("/auth/me")
      ? Promise.resolve(jsonResponse({ user: officer }))
      : Promise.resolve(jsonResponse({ message: "Service unavailable." }, 503)));
    renderRoute("/program/applications");
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a failed detail request without retaining stale detail", async () => {
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [application], total: 1, page: 1, pageSize: 20 }));
      return Promise.resolve(jsonResponse({ message: "Application not found." }, 404));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Application not found.");
    expect(screen.queryByText("Select an application to see its details, or create a new one.")).not.toBeInTheDocument();
  });

  it("uses exact lifecycle payloads and gates decisions by completed review count", async () => {
    const assigned = { ...application, status: "ASSIGNED" as const };
    const notReady = { ...application, status: "UNDER_REVIEW" as const, reviews: [{ id: "completed-1", impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, comments: "Ready", completedAt: "2026-09-04T00:00:00.000Z", reviewer: { id: reviewer.id, name: reviewer.name } }] };
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [assigned], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1/status")) return Promise.resolve(jsonResponse({ application: { ...assigned, status: "UNDER_REVIEW", reviews: [] } }));
      return Promise.resolve(jsonResponse({ application: assigned }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Begin review" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/applications/application-1/status", expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "UNDER_REVIEW" }) })));
    cleanup(); localStorage.clear(); fetchMock.mockReset();
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [notReady], total: 1, page: 1, pageSize: 20 }));
      return Promise.resolve(jsonResponse({ application: notReady }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    expect(await screen.findByText("Decision available after 3 completed reviews (1/3).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve funding" })).not.toBeInTheDocument();
  });

  it("records one exact funding decision only after three completed reviews", async () => {
    const completedReviews = [1, 2, 3].map((number) => ({ id: `completed-${number}`, impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, comments: "Complete", completedAt: "2026-09-04T00:00:00.000Z", reviewer: { id: reviewer.id, name: reviewer.name } }));
    const ready = { ...application, status: "UNDER_REVIEW" as const, reviews: completedReviews };
    let resolveDecision: ((response: Response) => void) | undefined;
    let decisionFinished = false;
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [ready], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1/decision")) return new Promise<Response>((resolve) => { resolveDecision = (response) => { decisionFinished = true; resolve(response); }; });
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: decisionFinished ? { ...ready, status: "DECIDED", fundingDecision: { id: "decision-1", decision: "APPROVED", decidedAt: "2026-09-04T00:00:00.000Z", notes: null, decidedBy: { id: officer.id, name: officer.name } } } : ready }));
      return Promise.resolve(jsonResponse({ application: ready }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    const approve = await screen.findByRole("button", { name: "Approve funding" });
    fireEvent.click(approve); fireEvent.click(approve);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/applications/application-1/decision", expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "APPROVED" }) })));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/applications/application-1/decision"))).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Recording decision..." })).toBeDisabled();
    resolveDecision!(jsonResponse({ decision: { id: "decision-1" } }, 201));
    expect(await screen.findByText("This application has a recorded funding decision.")).toBeInTheDocument();
  });

  it("prevents duplicate archive requests while pending", async () => {
    let resolveArchive: ((response: Response) => void) | undefined;
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [application], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1/archive")) return new Promise<Response>((resolve) => { resolveArchive = resolve; });
      return Promise.resolve(jsonResponse({ application }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    const archive = await screen.findByRole("button", { name: "Archive" });
    fireEvent.click(archive); fireEvent.click(archive);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/applications/application-1/archive"))).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Archiving..." })).toBeDisabled();
    resolveArchive!(jsonResponse({ application: { ...application, archivedAt: "2026-09-04T00:00:00.000Z" } }));
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("does not offer a decision for an archived under-review application with completed reviews", async () => {
    const completedProjection = [1, 2, 3].map((number) => ({ id: `completed-${number}`, impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, comments: "Complete", completedAt: "2026-09-04T00:00:00.000Z", reviewer: { id: reviewer.id, name: reviewer.name } }));
    const archived = { ...application, status: "UNDER_REVIEW" as const, archivedAt: "2026-09-04T00:00:00.000Z", reviews: completedProjection };
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [archived], total: 1, page: 1, pageSize: 20 }));
      return Promise.resolve(jsonResponse({ application: archived }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    const archiveNotice = await screen.findByText((_, element) => element?.classList.contains("archive-notice") ?? false);
    expect(archiveNotice).toHaveTextContent(/^Archived .+\. Restore it before lifecycle actions\.$/);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve funding" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline funding" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/decision"))).toBe(false);
  });

  it("refreshes mutations with the current discovery filters", async () => {
    let resolveArchive: ((response: Response) => void) | undefined;
    let resolveFilteredList: ((response: Response) => void) | undefined;
    const filteredRequests: string[] = [];
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.endsWith("/applications/application-1/archive")) return new Promise<Response>((resolve) => { resolveArchive = resolve; });
      if (url.includes("/applications?") && url.includes("search=current")) {
        filteredRequests.push(url);
        if (filteredRequests.length === 1) return new Promise<Response>((resolve) => { resolveFilteredList = resolve; });
        return Promise.resolve(jsonResponse({ applications: [{ ...application, organizationName: "Current filter after mutation" }], total: 1, page: 1, pageSize: 20 }));
      }
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [application], total: 1, page: 1, pageSize: 20 }));
      return Promise.resolve(jsonResponse({ application }));
    });
    renderRoute("/program/applications");
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search applications" }), { target: { value: "current" } });
    await waitFor(() => expect(resolveFilteredList).toBeTypeOf("function"));
    resolveFilteredList!(jsonResponse({ applications: [{ ...application, organizationName: "Current filter before mutation" }], total: 1, page: 1, pageSize: 20 }));
    expect(await screen.findByRole("button", { name: "Current filter before mutation" })).toBeInTheDocument();
    resolveArchive!(jsonResponse({ application: { ...application, archivedAt: "2026-09-04T00:00:00.000Z" } }));
    expect(await screen.findByRole("button", { name: "Current filter after mutation" })).toBeInTheDocument();
    expect(filteredRequests).toHaveLength(2);
    expect(filteredRequests.every((url) => url.includes("search=current"))).toBe(true);
  });

  it("sends server-side sort and pagination queries and renders an empty result", async () => {
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => url.endsWith("/auth/me")
      ? Promise.resolve(jsonResponse({ user: officer }))
      : Promise.resolve(jsonResponse({ applications: [application], total: 40, page: 1, pageSize: 20 })));
    renderRoute("/program/applications");
    await screen.findByRole("button", { name: "Example Foundation" });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), { target: { value: "requestedAmount" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("sortBy=requestedAmount"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("page=2"))).toBe(true));
    cleanup(); localStorage.clear(); fetchMock.mockReset();
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => url.endsWith("/auth/me")
      ? Promise.resolve(jsonResponse({ user: officer }))
      : Promise.resolve(jsonResponse({ applications: [], total: 0, page: 1, pageSize: 20 })));
    renderRoute("/program/applications");
    expect(await screen.findByText("No applications match these filters.")).toBeInTheDocument();
  });

  it("ignores an older discovery response that resolves after a newer one", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    localStorage.setItem(tokenKey, "persisted-token");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return new Promise<Response>((resolve) => resolvers.push(resolve));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderRoute("/program/applications");
    await waitFor(() => expect(resolvers).toHaveLength(1));
    fireEvent.change(screen.getByRole("textbox", { name: "Search applications" }), { target: { value: "new" } });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1](jsonResponse({ applications: [{ ...application, organizationName: "Newest Foundation" }], total: 1, page: 1, pageSize: 20 }));
    expect(await screen.findByRole("button", { name: "Newest Foundation" })).toBeInTheDocument();
    resolvers[0](jsonResponse({ applications: [{ ...application, organizationName: "Stale Foundation" }], total: 1, page: 1, pageSize: 20 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Newest Foundation" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Stale Foundation" })).not.toBeInTheDocument();
  });
});
