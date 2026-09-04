import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { dateTimeInputFromIso, ProgramApplicationsPage } from "./ProgramApplicationsPage";
import type { User } from "../types/auth";
import type { TimelineEvent } from "../types/application";

const tokenKey = "grant-review.auth-token";
let fetchMock: ReturnType<typeof vi.fn>;

const officer: User = { id: "officer-1", name: "Maya", email: "maya@example.test", role: "PROGRAM_OFFICER" };
const reviewerA = { id: "reviewer-1", name: "Ava Adams", email: "ava@example.test", role: "REVIEWER" as const };
const reviewerB = { id: "reviewer-2", name: "Ben Brooks", email: "ben@example.test", role: "REVIEWER" as const };

const baseApplication = {
  id: "application-1",
  organizationName: "Example Foundation",
  contactEmail: "contact@example.test",
  fundingRoundId: "round-1",
  requestedAmount: "1000.00",
  submittedAt: "2026-09-03T00:00:00.000Z",
  status: "SUBMITTED" as const,
  archivedAt: null,
  ownerId: officer.id,
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
  fundingRound: { id: "round-1", name: "Spring grants", opensAt: "2026-01-01T00:00:00.000Z", closesAt: "2026-03-31T00:00:00.000Z" },
  owner: officer,
  reviews: [],
  fundingDecision: null,
};

const secondApplication = {
  ...baseApplication,
  id: "application-2",
  organizationName: "Beacon Labs",
  contactEmail: "beacon@example.test",
};

const activeAssignment = {
  id: "assignment-1",
  applicationId: baseApplication.id,
  reviewerId: reviewerA.id,
  dueAt: "2026-09-10T14:30:00.000Z",
  assignedAt: "2026-09-04T08:00:00.000Z",
  completedAt: null,
  removedAt: null,
  createdAt: "2026-09-04T08:00:00.000Z",
  updatedAt: "2026-09-04T08:00:00.000Z",
  reviewer: reviewerA,
  application: {
    id: baseApplication.id,
    organizationName: baseApplication.organizationName,
    contactEmail: baseApplication.contactEmail,
    requestedAmount: baseApplication.requestedAmount,
    submittedAt: baseApplication.submittedAt,
    status: baseApplication.status,
    archivedAt: baseApplication.archivedAt,
    fundingRoundId: baseApplication.fundingRoundId,
    fundingRound: { id: baseApplication.fundingRound.id, name: baseApplication.fundingRound.name },
  },
  review: null,
};

const completedAssignment = {
  ...activeAssignment,
  id: "assignment-2",
  reviewerId: reviewerB.id,
  reviewer: reviewerB,
  review: { status: "COMPLETED" as const },
};

const removedAssignment = {
  ...activeAssignment,
  id: "assignment-3",
  reviewerId: reviewerB.id,
  reviewer: reviewerB,
  removedAt: "2026-09-05T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deferredResponse() {
  let resolve: (value: Response) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<Response>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(<AuthProvider><ProgramApplicationsPage /></AuthProvider>);
}

function restore(handler: (url: string, options?: RequestInit) => Promise<Response>) {
  localStorage.setItem(tokenKey, "token");
  fetchMock.mockImplementation(handler);
}

async function openApplication(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
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

describe("Program Officer assignment management", () => {
  it("loads reviewer options from the directory, removes arbitrary reviewer ID entry, and posts one exact assignment payload", async () => {
    const createRequest = deferredResponse();
    let assignments: unknown[] = [];
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") {
        return createRequest.promise.then((result) => {
          assignments = [{ ...activeAssignment, reviewerId: reviewerB.id, reviewer: reviewerB }];
          return result;
        });
      }
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");

    const reviewerSelect = await screen.findByRole("combobox", { name: "Reviewer" });
    expect(screen.queryByLabelText(/reviewer id/i)).not.toBeInTheDocument();
    await waitFor(() => expect(within(reviewerSelect).getByRole("option", { name: "Ava Adams (ava@example.test)" })).toBeInTheDocument());
    expect(within(reviewerSelect).getByRole("option", { name: "Ben Brooks (ben@example.test)" })).toBeInTheDocument();

    fireEvent.change(reviewerSelect, { target: { value: reviewerB.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T10:15" } });

    const assign = screen.getByRole("button", { name: "Assign reviewer" });
    fireEvent.click(assign);
    fireEvent.click(assign);

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/applications/application-1/assignments") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1));
    const request = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/applications/application-1/assignments") && (options as RequestInit | undefined)?.method === "POST")![1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      reviewerId: reviewerB.id,
      dueAt: new Date("2026-09-11T10:15").toISOString(),
    });

    createRequest.resolve(jsonResponse({ assignment: { ...activeAssignment, reviewerId: reviewerB.id, reviewer: reviewerB } }, 201));
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();
  });

  it("shows reviewer directory empty and error states safely", async () => {
    cleanup();
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    expect(await screen.findByText("No reviewers are available.")).toBeInTheDocument();

    cleanup();
    fetchMock.mockReset();
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ message: "Reviewer directory unavailable." }, 503));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    expect(await screen.findByRole("alert")).toHaveTextContent("Reviewer directory unavailable.");
  });

  it("renders assignment list details including reviewer identity, due date, and removed history state", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [activeAssignment, removedAssignment] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    expect(await screen.findByText("Ava Adams")).toBeInTheDocument();
    expect(screen.getByText("ava@example.test")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(`Due ${new Date(activeAssignment.dueAt).toLocaleString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toHaveLength(2);
    expect(screen.getByText(/Removed/)).toBeInTheDocument();
  });

  it("restores the full due-date edit UI and PATCHes one exact update payload", async () => {
    const patchRequest = deferredResponse();
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/assignments/assignment-1") && options?.method === "PATCH") return patchRequest.promise;
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [activeAssignment, completedAssignment, removedAssignment] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");

    expect(await screen.findByRole("button", { name: "Edit due date" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Edit due date" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit due date" }));
    const dueDateInput = await screen.findByLabelText(`Due date for ${reviewerA.name}`);
    expect(dueDateInput).toHaveValue(dateTimeInputFromIso(activeAssignment.dueAt));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    fireEvent.change(dueDateInput, { target: { value: "2026-09-12T09:45" } });
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "PATCH")).toHaveLength(1));
    const request = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "PATCH")![1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({ dueAt: new Date("2026-09-12T09:45").toISOString() });

    patchRequest.resolve(jsonResponse({ assignment: { ...activeAssignment, dueAt: new Date("2026-09-12T09:45").toISOString() } }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());
  });

  it("cancels a due-date edit without sending a PATCH or changing the displayed date", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [activeAssignment] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    fireEvent.click(await screen.findByRole("button", { name: "Edit due date" }));
    fireEvent.change(screen.getByLabelText(`Due date for ${reviewerA.name}`), { target: { value: "2026-09-12T09:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText(`Due ${new Date(activeAssignment.dueAt).toLocaleString()}`)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "PATCH")).toBe(false);
  });

  it("preserves an unchanged due date exactly in a fixed non-UTC timezone and shows PATCH failures safely", async () => {
    const environment = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
    const previousTimeZone = environment.TZ;
    const dueAt = "2026-09-10T14:30:00.000Z";

    environment.TZ = "America/New_York";
    try {
      restore((url, options) => {
        if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
        if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
        if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
        if (url.endsWith("/assignments/assignment-1") && options?.method === "PATCH") return Promise.resolve(jsonResponse({ message: "Due date update failed." }, 500));
        if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [{ ...activeAssignment, dueAt }] }));
        if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA] }));
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      renderPage();
      await openApplication("Example Foundation");
      fireEvent.click(await screen.findByRole("button", { name: "Edit due date" }));
      const dueDateInput = await screen.findByLabelText(`Due date for ${reviewerA.name}`);
      expect(dueDateInput).toHaveValue("2026-09-10T10:30");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "PATCH")).toBe(true));
      const request = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "PATCH")![1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual({ dueAt });
      expect(await screen.findByRole("alert")).toHaveTextContent("Due date update failed.");
    } finally {
      if (previousTimeZone === undefined) delete environment.TZ;
      else environment.TZ = previousTimeZone;
    }
  });

  it("deletes one active incomplete assignment, keeps completed assignments non-removable, and surfaces refusal errors", async () => {
    const deleteRequest = deferredResponse();
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/assignments/assignment-1") && options?.method === "DELETE") return deleteRequest.promise;
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [activeAssignment, completedAssignment] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");

    const remove = await screen.findByRole("button", { name: "Remove" });
    expect(screen.queryAllByRole("button", { name: "Remove" })).toHaveLength(1);
    fireEvent.click(remove);
    fireEvent.click(remove);

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/assignments/assignment-1") && (options as RequestInit | undefined)?.method === "DELETE")).toHaveLength(1));
    deleteRequest.resolve(jsonResponse({ message: "Completed reviews cannot be removed." }, 409));
    expect(await screen.findByRole("alert")).toHaveTextContent("Completed reviews cannot be removed.");
  });

  it("keeps a successfully removed assignment in visible history without another Remove action", async () => {
    let assignments: Array<typeof activeAssignment | typeof removedAssignment> = [activeAssignment];
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/assignments/assignment-1") && options?.method === "DELETE") { assignments = [{ ...activeAssignment, removedAt: "2026-09-12T00:00:00.000Z" }]; return Promise.resolve(jsonResponse({ assignment: assignments[0] })); }
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(await screen.findByText(/Removed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("renders an assignment-create refusal without inventing an assignment", async () => {
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") return Promise.resolve(jsonResponse({ message: "Reviewer has an unresolved conflict of interest." }, 409));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    const reviewerSelect = await screen.findByRole("combobox", { name: "Reviewer" });
    await waitFor(() => expect(within(reviewerSelect).getByRole("option", { name: "Ava Adams (ava@example.test)" })).toBeInTheDocument());
    fireEvent.change(reviewerSelect, { target: { value: reviewerA.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T10:15" } });
    const assignReviewer = screen.getByRole("button", { name: "Assign reviewer" });
    await waitFor(() => expect(assignReviewer).toBeEnabled());
    fireEvent.click(assignReviewer);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/applications/application-1/assignments",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reviewer has an unresolved conflict of interest.");
    expect(assignReviewer).toBeEnabled();
    expect(screen.queryByText(reviewerA.name)).not.toBeInTheDocument();
  });

  it("keeps the newer application's assignments when an older list request resolves late", async () => {
    const assignmentsA = deferredResponse();
    const assignmentsB = deferredResponse();
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return assignmentsA.promise;
      if (url.endsWith("/applications/application-2/assignments")) return assignmentsB.promise;
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    await openApplication("Beacon Labs");

    assignmentsB.resolve(jsonResponse({ assignments: [{ ...activeAssignment, id: "assignment-b", applicationId: secondApplication.id, reviewer: reviewerB, reviewerId: reviewerB.id, application: { ...activeAssignment.application, id: secondApplication.id, organizationName: secondApplication.organizationName, contactEmail: secondApplication.contactEmail } }] }));
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();

    assignmentsA.resolve(jsonResponse({ assignments: [activeAssignment] }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument());
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
    expect(screen.queryByText("Ava Adams")).not.toBeInTheDocument();
  });

  it("does not re-select the old application after a stale create mutation finishes", async () => {
    const createRequest = deferredResponse();
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") return createRequest.promise;
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/applications/application-2/assignments")) return Promise.resolve(jsonResponse({ assignments: [{ ...activeAssignment, id: "assignment-b", applicationId: secondApplication.id, reviewer: reviewerB, reviewerId: reviewerB.id, application: { ...activeAssignment.application, id: secondApplication.id, organizationName: secondApplication.organizationName, contactEmail: secondApplication.contactEmail } }] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    const reviewerSelect = await screen.findByRole("combobox", { name: "Reviewer" });
    await waitFor(() => expect(within(reviewerSelect).getByRole("option", { name: "Ava Adams (ava@example.test)" })).toBeInTheDocument());
    fireEvent.change(reviewerSelect, { target: { value: reviewerA.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign reviewer" }));

    await openApplication("Beacon Labs");
    expect(await screen.findByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();

    createRequest.resolve(jsonResponse({ assignment: activeAssignment }, 201));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument());
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Example Foundation" })).not.toBeInTheDocument();
  });

  it("does not make B load when A's stale assignment mutation succeeds", async () => {
    const createA = deferredResponse();
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") return createA.promise;
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/applications/application-2/assignments")) return Promise.resolve(jsonResponse({ assignments: [{ ...activeAssignment, id: "assignment-b", reviewer: reviewerB, reviewerId: reviewerB.id, application: { ...activeAssignment.application, id: secondApplication.id, organizationName: secondApplication.organizationName } }] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    fireEvent.change(await screen.findByRole("combobox", { name: "Reviewer" }), { target: { value: reviewerA.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign reviewer" }));
    await openApplication("Beacon Labs");
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();

    createA.resolve(jsonResponse({ assignment: activeAssignment }, 201));
    await waitFor(() => expect(screen.queryByText("Loading assignments...")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
  });

  it("does not show A's assignment mutation error after switching to B", async () => {
    const createA = deferredResponse();
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") return createA.promise;
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/applications/application-2/assignments")) return Promise.resolve(jsonResponse({ assignments: [{ ...activeAssignment, id: "assignment-b", reviewer: reviewerB, reviewerId: reviewerB.id, application: { ...activeAssignment.application, id: secondApplication.id, organizationName: secondApplication.organizationName } }] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    fireEvent.change(await screen.findByRole("combobox", { name: "Reviewer" }), { target: { value: reviewerA.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign reviewer" }));
    await openApplication("Beacon Labs");
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();

    createA.resolve(jsonResponse({ message: "A assignment failed." }, 409));
    await waitFor(() => expect(screen.queryByText("Loading assignments...")).not.toBeInTheDocument());
    expect(screen.queryByText("A assignment failed.")).not.toBeInTheDocument();
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
  });

  it("ignores A's post-mutation detail refresh when B is selected before it resolves", async () => {
    const refreshedA = deferredResponse();
    const createA = deferredResponse();
    let applicationADetailRequests = 0;
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1/assignments") && options?.method === "POST") return createA.promise;
      if (url.endsWith("/applications/application-1")) {
        applicationADetailRequests += 1;
        return applicationADetailRequests === 1 ? Promise.resolve(jsonResponse({ application: baseApplication })) : refreshedA.promise;
      }
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/applications/application-2/assignments")) return Promise.resolve(jsonResponse({ assignments: [{ ...activeAssignment, id: "assignment-b", reviewer: reviewerB, reviewerId: reviewerB.id, application: { ...activeAssignment.application, id: secondApplication.id, organizationName: secondApplication.organizationName } }] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [reviewerA, reviewerB] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    await openApplication("Example Foundation");
    const reviewerSelect = await screen.findByRole("combobox", { name: "Reviewer" });
    await waitFor(() => expect(within(reviewerSelect).getByRole("option", { name: "Ava Adams (ava@example.test)" })).toBeInTheDocument());
    fireEvent.change(reviewerSelect, { target: { value: reviewerA.id } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-11T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign reviewer" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/applications/application-1/assignments") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1));
    createA.resolve(jsonResponse({ assignment: activeAssignment }, 201));
    await waitFor(() => expect(applicationADetailRequests).toBe(2));

    await openApplication("Beacon Labs");
    expect(await screen.findByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    expect(await screen.findByText("Ben Brooks")).toBeInTheDocument();

    refreshedA.resolve(jsonResponse({ application: { ...baseApplication, organizationName: "Stale Example Foundation" } }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument());
    expect(screen.getByText("Ben Brooks")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stale Example Foundation" })).not.toBeInTheDocument();
  });

  it("renders completed review details and an immutable timeline with Program Officer comments", async () => {
    const reviewed = { ...baseApplication, reviews: [{ id: "review-1", impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, comments: "Strong proposal", completedAt: "2026-09-05T00:00:00.000Z", reviewer: { id: reviewerA.id, name: reviewerA.name } }] };
    let events: TimelineEvent[] = [{ id: "event-1", applicationId: reviewed.id, actorId: officer.id, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: "SUBMITTED", to: "ASSIGNED" }, createdAt: "2026-09-04T00:00:00.000Z", actor: { id: officer.id, name: officer.name } }];
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [reviewed], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: reviewed }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return Promise.resolve(jsonResponse({ events }));
      if (url.endsWith("/applications/application-1/comments") && options?.method === "POST") { events = [...events, { id: "event-2", applicationId: reviewed.id, actorId: officer.id, eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment: "Follow up" }, createdAt: "2026-09-06T00:00:00.000Z", actor: { id: officer.id, name: officer.name } }]; return Promise.resolve(jsonResponse({ event: events[1] }, 201)); }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation");
    expect(await screen.findByText("Ava Adams")).toBeInTheDocument(); expect(screen.getByText("Strong proposal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View timeline" })); expect(await screen.findByText("APPLICATION STATUS CHANGED")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Add comment" }), { target: { value: "Follow up" } }); fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/applications/application-1/comments", expect.objectContaining({ method: "POST", body: JSON.stringify({ comment: "Follow up" }) })));
    expect(await screen.findByText("Follow up")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /edit timeline/i })).not.toBeInTheDocument();
  });

  it("shows a pending timeline load, then renders its resolved history", async () => {
    const timeline = deferredResponse();
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return timeline.promise;
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" }));
    expect(await screen.findByText("Loading timeline...")).toBeInTheDocument();
    timeline.resolve(jsonResponse({ events: [{ id: "event-1", applicationId: baseApplication.id, actorId: officer.id, eventType: "APPLICATION_CREATED", metadata: null, createdAt: "2026-09-04T00:00:00.000Z", actor: { id: officer.id, name: officer.name } satisfies TimelineEvent["actor"] }] }));
    expect(await screen.findByText("APPLICATION CREATED")).toBeInTheDocument(); expect(screen.queryByText("Loading timeline...")).not.toBeInTheDocument();
  });

  it("renders a timeline error without crashing the application detail", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return Promise.resolve(jsonResponse({ message: "Timeline unavailable" }, 500));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Timeline unavailable"); expect(screen.getByRole("heading", { name: "Example Foundation" })).toBeInTheDocument();
  });

  it("renders a successful empty timeline as empty history", async () => {
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return Promise.resolve(jsonResponse({ events: [] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" }));
    expect(await screen.findByText("No timeline entries yet.")).toBeInTheDocument(); expect(screen.queryByText("Loading timeline...")).not.toBeInTheDocument(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables comment submission while its request is pending and prevents duplicates", async () => {
    const commentRequest = deferredResponse(); let commentPosts = 0;
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return Promise.resolve(jsonResponse({ events: [] }));
      if (url.endsWith("/applications/application-1/comments") && options?.method === "POST") { commentPosts += 1; return commentRequest.promise; }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" })); await screen.findByText("No timeline entries yet.");
    fireEvent.change(screen.getByRole("textbox", { name: "Add comment" }), { target: { value: "Follow up" } }); fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    const pending = await screen.findByRole("button", { name: "Adding comment..." }); expect(pending).toBeDisabled(); fireEvent.click(pending); expect(commentPosts).toBe(1);
    commentRequest.resolve(jsonResponse({ event: {} }, 201)); await waitFor(() => expect(screen.getByRole("button", { name: "Add comment" })).toBeEnabled()); expect(commentPosts).toBe(1);
  });

  it("keeps the post-comment timeline when an older same-application request resolves late", async () => {
    const olderTimeline = deferredResponse(); const refreshedTimeline = deferredResponse(); let timelineRequests = 0;
    const freshEvents: TimelineEvent[] = [{ id: "comment-1", applicationId: baseApplication.id, actorId: officer.id, eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment: "Fresh comment" }, createdAt: "2026-09-06T00:00:00.000Z", actor: { id: officer.id, name: officer.name } }];
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication], total: 1, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-1/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return ++timelineRequests === 1 ? olderTimeline.promise : refreshedTimeline.promise;
      if (url.endsWith("/applications/application-1/comments") && options?.method === "POST") return Promise.resolve(jsonResponse({ event: freshEvents[0] }, 201));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" })); await screen.findByText("Loading timeline...");
    fireEvent.change(screen.getByRole("textbox", { name: "Add comment" }), { target: { value: "Fresh comment" } }); fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(timelineRequests).toBe(2)); refreshedTimeline.resolve(jsonResponse({ events: freshEvents })); expect(await screen.findByText("Fresh comment")).toBeInTheDocument();
    await act(async () => { olderTimeline.resolve(jsonResponse({ events: [] })); await olderTimeline.promise; });
    expect(screen.getByText("Fresh comment")).toBeInTheDocument(); expect(screen.queryByText("No timeline entries yet.")).not.toBeInTheDocument();
  });

  it("keeps B's timeline when A's deferred timeline response settles after switching applications", async () => {
    const timelineA = deferredResponse(); const timelineB = deferredResponse();
    const bEvents: TimelineEvent[] = [{ id: "event-b", applicationId: secondApplication.id, actorId: officer.id, eventType: "APPLICATION_CREATED", metadata: null, createdAt: "2026-09-06T00:00:00.000Z", actor: { id: officer.id, name: officer.name } }];
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(jsonResponse({ user: officer }));
      if (url.includes("/applications?")) return Promise.resolve(jsonResponse({ applications: [baseApplication, secondApplication], total: 2, page: 1, pageSize: 20 }));
      if (url.endsWith("/applications/application-1")) return Promise.resolve(jsonResponse({ application: baseApplication }));
      if (url.endsWith("/applications/application-2")) return Promise.resolve(jsonResponse({ application: secondApplication }));
      if (url.endsWith("/applications/application-1/assignments") || url.endsWith("/applications/application-2/assignments")) return Promise.resolve(jsonResponse({ assignments: [] }));
      if (url.endsWith("/reviewers")) return Promise.resolve(jsonResponse({ reviewers: [] }));
      if (url.endsWith("/applications/application-1/timeline")) return timelineA.promise;
      if (url.endsWith("/applications/application-2/timeline")) return timelineB.promise;
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage(); await openApplication("Example Foundation"); await screen.findByRole("heading", { name: "Example Foundation" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" })); await screen.findByText("Loading timeline...");
    await openApplication("Beacon Labs"); await screen.findByRole("heading", { name: "Beacon Labs" }); fireEvent.click(screen.getByRole("button", { name: "View timeline" }));
    await act(async () => { timelineB.resolve(jsonResponse({ events: bEvents })); await timelineB.promise; }); expect(await screen.findByText("APPLICATION CREATED")).toBeInTheDocument();
    await act(async () => { timelineA.resolve(jsonResponse({ events: [{ id: "event-a", applicationId: baseApplication.id, actorId: officer.id, eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment: "Stale A" }, createdAt: "2026-09-05T00:00:00.000Z", actor: { id: officer.id, name: officer.name } }] })); await timelineA.promise; });
    expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument(); expect(screen.getByText("APPLICATION CREATED")).toBeInTheDocument(); expect(screen.queryByText("Stale A")).not.toBeInTheDocument();
  });
});
