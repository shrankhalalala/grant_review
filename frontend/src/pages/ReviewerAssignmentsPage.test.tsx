import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { ReviewerAssignmentsPage } from "./ReviewerAssignmentsPage";

const tokenKey = "grant-review.auth-token";
let fetchMock: ReturnType<typeof vi.fn>;
const reviewer = { id: "reviewer-1", name: "Ava", email: "ava@example.test", role: "REVIEWER" };
const assignment = {
  id: "assignment-1", applicationId: "application-1", reviewerId: reviewer.id, dueAt: "2020-01-01T12:00:00.000Z", assignedAt: "2025-01-01T00:00:00.000Z", completedAt: null, removedAt: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", reviewer,
  application: { id: "application-1", organizationName: "Example Foundation", contactEmail: "contact@example.test", requestedAmount: "1000.01", submittedAt: "2025-01-01T00:00:00.000Z", status: "ASSIGNED", archivedAt: null, fundingRoundId: "round-1", fundingRound: { id: "round-1", name: "Spring grants" } }, review: null,
};
const draft = { id: "review-1", applicationId: assignment.applicationId, reviewerId: reviewer.id, assignmentId: assignment.id, status: "DRAFT", impactScore: null, feasibilityScore: null, budgetJustificationScore: null, comments: null, completedAt: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" };

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function deferredResponse() {
  let resolve: (value: Response) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<Response>((innerResolve, innerReject) => {
    resolve = innerResolve; reject = innerReject;
  });
  return { promise, resolve, reject };
}
function renderPage() { return render(<AuthProvider><ReviewerAssignmentsPage /></AuthProvider>); }
function restore(handler: (url: string, options?: RequestInit) => Promise<Response>) { localStorage.setItem(tokenKey, "token"); fetchMock.mockImplementation(handler); }

beforeEach(() => { localStorage.clear(); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("Reviewer assignment workspace", () => {
  it("loads only the reviewer assignment route and safely blocks removed history", async () => {
    const removed = { ...assignment, removedAt: "2025-02-01T00:00:00.000Z" };
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [removed] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    expect(await screen.findByText(/not available for review/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start draft review" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/reviewer/assignments"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/applications/application-1/assignments"))).toBe(false);
  });

  it("marks only active incomplete past-due assignments as overdue", async () => {
    const completed = { ...assignment, id: "assignment-completed", review: { status: "COMPLETED" as const } };
    const removed = { ...assignment, id: "assignment-removed", removedAt: "2025-02-01T00:00:00.000Z" };
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [assignment, completed, removed] }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    expect(await screen.findAllByText("Overdue")).toHaveLength(1);
  });

  it("creates, scores, and completes a draft only after all scores are set", async () => {
    let currentReview: { id: string; applicationId: string; reviewerId: string; assignmentId: string; status: string; impactScore: number | null; feasibilityScore: number | null; budgetJustificationScore: number | null; comments: string | null; completedAt: string | null; createdAt: string; updatedAt: string } | null = null;
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [{ ...assignment, review: currentReview ? { status: currentReview.status } : null }] }));
      if (url.endsWith("/review") && options?.method === "POST") { currentReview = draft; return Promise.resolve(response({ review: currentReview }, 201)); }
      if (url.endsWith("/reviews/review-1") && options?.method === "PATCH" && currentReview) { currentReview = { ...currentReview, impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, comments: "Ready" }; return Promise.resolve(response({ review: currentReview })); }
      if (url.endsWith("/reviews/review-1/complete") && currentReview) { currentReview = { ...currentReview, status: "COMPLETED", completedAt: "2025-02-01T00:00:00.000Z" }; return Promise.resolve(response({ review: currentReview })); }
      if (url.endsWith("/assignments/assignment-1/review") && currentReview) return Promise.resolve(response({ review: currentReview }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start draft review" }));
    const createRequest = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/assignments/assignment-1/review") && (options as RequestInit | undefined)?.method === "POST")![1] as RequestInit;
    expect(JSON.parse(createRequest.body as string)).toEqual({});
    expect(await screen.findByRole("button", { name: "Complete review" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Impact" }), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Feasibility" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Budget Justification" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Comments" }), { target: { value: "Ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete review" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/reviews/review-1/complete"))).toBe(true));
    expect(await screen.findByText(/This review is read-only/i)).toBeInTheDocument();
    const editRequest = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/reviews/review-1") && (options as RequestInit | undefined)?.method === "PATCH")![1] as RequestInit;
    expect(JSON.parse(editRequest.body as string)).toEqual({ impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, comments: "Ready" });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });

  it("renders a create failure safely and lets the reviewer retry", async () => {
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [assignment] }));
      if (url.endsWith("/assignments/assignment-1/review") && options?.method === "POST") return Promise.resolve(response({ message: "Review creation failed." }, 500));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start draft review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Review creation failed.");
    fireEvent.click(screen.getByRole("button", { name: "Start draft review" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/assignments/assignment-1/review") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(2));
  });

  it("requires a reason before declaring a conflict and prevents duplicate pending requests", async () => {
    let resolveConflict: ((value: Response) => void) | undefined;
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [assignment] }));
      if (url.endsWith("/assignments/assignment-1/conflict") && options?.method === "POST") return new Promise((resolve) => { resolveConflict = resolve; });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(screen.getByRole("button", { name: "Declare conflict" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A conflict reason is required.");
    fireEvent.change(screen.getByRole("textbox", { name: "Conflict reason" }), { target: { value: "Prior relationship" } });
    const declare = screen.getByRole("button", { name: "Declare conflict" });
    fireEvent.click(declare); fireEvent.click(declare);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/assignments/assignment-1/conflict"))).toHaveLength(1));
    resolveConflict!(response({ conflict: { id: "conflict-1" } }, 201));
    expect(await screen.findByText(/Conflict declared/i)).toBeInTheDocument();
  });

  it("keeps the newer review detail selected when an older review request resolves late", async () => {
    const secondAssignment = {
      ...assignment,
      id: "assignment-2",
      applicationId: "application-2",
      reviewerId: reviewer.id,
      application: {
        ...assignment.application,
        id: "application-2",
        organizationName: "Beacon Labs",
      },
      review: { status: "DRAFT" as const },
    };
    const firstReview = deferredResponse();
    const secondReview = deferredResponse();
    restore((url) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) {
        return Promise.resolve(response({
          assignments: [
            { ...assignment, review: { status: "DRAFT" as const } },
            secondAssignment,
          ],
        }));
      }
      if (url.endsWith("/assignments/assignment-1/review")) return firstReview.promise;
      if (url.endsWith("/assignments/assignment-2/review")) return secondReview.promise;
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Beacon Labs" }));

    secondReview.resolve(response({ review: { ...draft, id: "review-2", assignmentId: "assignment-2", applicationId: "application-2", comments: "Beacon draft" } }));
    expect(await screen.findByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue("Beacon draft"));

    firstReview.resolve(response({ review: { ...draft, comments: "Old draft" } }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue("Beacon draft");
    expect(screen.queryByRole("heading", { name: "Example Foundation" })).not.toBeInTheDocument();
  });

  it("does not render a stale A draft mutation under assignment B", async () => {
    const secondAssignment = { ...assignment, id: "assignment-2", applicationId: "application-2", application: { ...assignment.application, id: "application-2", organizationName: "Beacon Labs" }, review: { status: "DRAFT" as const } };
    const firstCreate = deferredResponse();
    const bDraft = { ...draft, id: "review-2", assignmentId: "assignment-2", applicationId: "application-2", comments: "Beacon draft" };
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [assignment, secondAssignment] }));
      if (url.endsWith("/assignments/assignment-1/review") && options?.method === "POST") return firstCreate.promise;
      if (url.endsWith("/assignments/assignment-2/review")) return Promise.resolve(response({ review: bDraft }));
      if (url.endsWith("/reviews/review-2") && options?.method === "PATCH") return Promise.resolve(response({ review: bDraft }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start draft review" }));
    fireEvent.click(screen.getByRole("button", { name: "Beacon Labs" }));
    expect(await screen.findByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue("Beacon draft"));

    await act(async () => { firstCreate.resolve(response({ review: { ...draft, comments: "Stale A draft" } }, 201)); await Promise.resolve(); });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/reviewer/assignments"))).toHaveLength(2));
    expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue("Beacon draft");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith("/reviews/review-2") && (options as RequestInit | undefined)?.method === "PATCH")).toBe(true));
  });

  it("does not show a stale A mutation error or clear B pending state", async () => {
    const secondAssignment = { ...assignment, id: "assignment-2", applicationId: "application-2", application: { ...assignment.application, id: "application-2", organizationName: "Beacon Labs" }, review: { status: "DRAFT" as const } };
    const firstCreate = deferredResponse();
    const secondSave = deferredResponse();
    const bDraft = { ...draft, id: "review-2", assignmentId: "assignment-2", applicationId: "application-2", comments: "Beacon draft" };
    restore((url, options) => {
      if (url.endsWith("/auth/me")) return Promise.resolve(response({ user: reviewer }));
      if (url.endsWith("/reviewer/assignments")) return Promise.resolve(response({ assignments: [assignment, secondAssignment] }));
      if (url.endsWith("/assignments/assignment-1/review") && options?.method === "POST") return firstCreate.promise;
      if (url.endsWith("/assignments/assignment-2/review")) return Promise.resolve(response({ review: bDraft }));
      if (url.endsWith("/reviews/review-2") && options?.method === "PATCH") return secondSave.promise;
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Example Foundation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start draft review" }));
    fireEvent.click(screen.getByRole("button", { name: "Beacon Labs" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue("Beacon draft"));
    fireEvent.change(screen.getByRole("textbox", { name: "Comments" }), { target: { value: "Saving B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();

    await act(async () => { firstCreate.reject(new Error("Stale A failure")); await Promise.resolve(); });
    expect(screen.getByRole("heading", { name: "Beacon Labs" })).toBeInTheDocument();
    expect(screen.queryByText("Stale A failure")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    await act(async () => { secondSave.resolve(response({ review: { ...bDraft, comments: "Saving B" } })); await Promise.resolve(); });
    expect(await screen.findByRole("button", { name: "Save draft" })).toBeEnabled();
  });
});
