import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../services/api";
import { listMyAssignments } from "../services/assignments";
import { completeReview, createReview, declareConflict, getReview, updateReview } from "../services/reviews";
import { assignmentCanBeReviewed, assignmentIsOverdue, readableApplicationStatus, type Review, type ReviewInput, type ReviewerAssignment } from "../types/assignment";

function message(error: unknown) { return error instanceof ApiError ? error.message : "We could not complete that request. Please try again."; }
const scoreFields = [["impactScore", "Impact"], ["feasibilityScore", "Feasibility"], ["budgetJustificationScore", "Budget Justification"]] as const;
type ScoreField = typeof scoreFields[number][0];

function ReviewEditor({ review, onSave, onComplete, pending }: { review: Review; onSave: (input: ReviewInput) => Promise<void>; onComplete: (input: ReviewInput) => Promise<void>; pending: string | null }) {
  const [value, setValue] = useState<ReviewInput>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue({ impactScore: review.impactScore ?? undefined, feasibilityScore: review.feasibilityScore ?? undefined, budgetJustificationScore: review.budgetJustificationScore ?? undefined, comments: review.comments ?? "" }), [review]);
  const completeReady = scoreFields.every(([field]) => typeof value[field] === "number");
  const submit = async (event: FormEvent, action: "save" | "complete") => {
    event.preventDefault(); setError(null);
    try { if (action === "complete") await onComplete(value); else await onSave(value); }
    catch (cause) { setError(message(cause)); }
  };
  if (review.status === "COMPLETED") return <div className="review-readonly"><p className="lifecycle-note">Completed {review.completedAt && new Date(review.completedAt).toLocaleString()}. This review is read-only.</p><ReviewValues review={review} /></div>;
  return <form className="review-form" onSubmit={(event) => void submit(event, "save")}>
    {scoreFields.map(([field, label]) => <label key={field}>{label}<select aria-label={label} value={value[field] ?? ""} onChange={(event) => setValue((current) => ({ ...current, [field]: event.target.value === "" ? undefined : Number(event.target.value) }))}><option value="">Not scored</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></label>)}
    <label>Comments<textarea value={value.comments ?? ""} onChange={(event) => setValue((current) => ({ ...current, comments: event.target.value }))} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={pending !== null}> {pending === "save" ? "Saving..." : "Save draft"}</button><button className="primary-button" type="button" disabled={!completeReady || pending !== null} onClick={(event) => void submit(event as unknown as FormEvent, "complete")}>{pending === "complete" ? "Completing..." : "Complete review"}</button></div>
    {!completeReady && <p className="lifecycle-note">Set all three scores before completing this review.</p>}
  </form>;
}

function ReviewValues({ review }: { review: Review }) { return <dl className="application-details"><dt>Impact</dt><dd>{review.impactScore ?? "Not scored"}</dd><dt>Feasibility</dt><dd>{review.feasibilityScore ?? "Not scored"}</dd><dt>Budget Justification</dt><dd>{review.budgetJustificationScore ?? "Not scored"}</dd><dt>Comments</dt><dd>{review.comments || "No comments provided."}</dd></dl>; }

export function ReviewerAssignmentsPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<ReviewerAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewerAssignment | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const request = useRef(0);
  const detailRequest = useRef(0);
  const selectedAssignmentId = useRef<string | null>(null);
  const mutationSequence = useRef(0);
  const activeMutation = useRef<number | null>(null);
  const refresh = async () => {
    if (!token) return;
    const sequence = ++request.current; setLoading(true); setError(null);
    try { const next = await listMyAssignments(token); if (sequence === request.current) setAssignments(next); }
    catch (cause) { if (sequence === request.current) setError(message(cause)); }
    finally { if (sequence === request.current) setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [token]);
  const select = async (assignment: ReviewerAssignment) => {
    if (!token) return;
    const sequence = ++detailRequest.current;
    const changedAssignment = selectedAssignmentId.current !== assignment.id;
    selectedAssignmentId.current = assignment.id;
    if (changedAssignment) { activeMutation.current = null; setPending(null); }
    setSelected(assignment); setReview(null); setConflict(false); setConflictReason(""); setActionError(null); setDetailError(null); setDetailLoading(true);
    if (!assignment.review) { if (sequence === detailRequest.current) setDetailLoading(false); return; }
    try { const next = await getReview(token, assignment.id); if (sequence === detailRequest.current) setReview(next); }
    catch (cause) { if (sequence === detailRequest.current) setDetailError(message(cause)); }
    finally { if (sequence === detailRequest.current) setDetailLoading(false); }
  };
  const mutate = async (action: string, assignmentId: string, operation: () => Promise<Review | void>, onSuccess?: () => void) => {
    if (activeMutation.current !== null) return;
    const mutation = ++mutationSequence.current;
    activeMutation.current = mutation; setPending(action); setActionError(null);
    try {
      const next = await operation();
      if (selectedAssignmentId.current === assignmentId) { if (next) setReview(next); onSuccess?.(); }
      await refresh();
    }
    catch (cause) { if (selectedAssignmentId.current === assignmentId) setActionError(message(cause)); }
    finally { if (activeMutation.current === mutation) { activeMutation.current = null; setPending(null); } }
  };
  const reviewBlocked = selected && !assignmentCanBeReviewed(selected);
  return <section className="applications-page reviewer-page"><div className="page-heading"><div><p className="eyebrow">Reviewer workspace</p><h1>My assignments</h1><p>Review your assigned applications, record your assessment, and declare conflicts early.</p></div></div><div className="applications-layout"><div className="application-list" aria-live="polite">{loading && <p className="state-message">Loading assignments...</p>}{error && <div className="state-message error-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void refresh()}>Try again</button></div>}{!loading && !error && assignments?.length === 0 && <p className="state-message">You do not have any assignments yet.</p>}{!loading && !error && assignments && assignments.length > 0 && <div className="table-wrap"><table><thead><tr><th>Application</th><th>Due</th><th>Review</th><th>State</th></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id}><td><button className="application-link" onClick={() => void select(assignment)}>{assignment.application.organizationName}</button><span>{assignment.application.fundingRound.name} · {assignment.application.requestedAmount}</span></td><td>{new Date(assignment.dueAt).toLocaleString()}{assignmentIsOverdue(assignment) && <span className="overdue-label">Overdue</span>}</td><td>{assignment.review?.status ?? "Not started"}</td><td>{assignment.removedAt ? "Removed" : assignment.application.archivedAt ? "Archived" : readableApplicationStatus(assignment.application.status)}</td></tr>)}</tbody></table></div>}</div><aside className="detail-panel">{!selected ? <p className="state-message">Select an assignment to open its review workspace.</p> : detailLoading ? <p className="state-message">Loading review...</p> : detailError ? <div className="state-message error-state" role="alert"><p>{detailError}</p><button className="secondary-button" onClick={() => void select(selected)}>Try again</button></div> : <><div className="detail-heading"><div><p className="eyebrow">Assignment</p><h2>{selected.application.organizationName}</h2></div><span className={`status-pill status-${selected.application.status.toLowerCase()}`}>{readableApplicationStatus(selected.application.status)}</span></div><dl className="application-details"><dt>Funding round</dt><dd>{selected.application.fundingRound.name}</dd><dt>Requested amount</dt><dd>{selected.application.requestedAmount}</dd><dt>Due</dt><dd>{new Date(selected.dueAt).toLocaleString()}{assignmentIsOverdue(selected) && " (overdue)"}</dd><dt>Assignment</dt><dd>{selected.removedAt ? `Removed ${new Date(selected.removedAt).toLocaleString()}` : "Active"}</dd></dl>{reviewBlocked && <p className="archive-notice">This assignment is not available for review because it has been removed or its application is archived, decided, or not ready.</p>}{conflict && <p className="archive-notice">Conflict declared. Review actions are now blocked.</p>}{actionError && <p className="form-error" role="alert">{actionError}</p>}{!review && !reviewBlocked && !conflict && <button className="primary-button" disabled={pending !== null} onClick={() => void mutate("create", selected.id, () => createReview(token!, selected.id, {}))}>{pending === "create" ? "Creating..." : "Start draft review"}</button>}{review && <ReviewEditor review={review} pending={pending} onSave={(input) => mutate("save", selected.id, () => updateReview(token!, review.id, input))} onComplete={(input) => mutate("complete", selected.id, async () => { const saved = await updateReview(token!, review.id, input); return completeReview(token!, saved.id); })} />}{!reviewBlocked && !conflict && review?.status !== "COMPLETED" && <form className="conflict-form" onSubmit={(event) => { event.preventDefault(); if (!conflictReason.trim()) { setActionError("A conflict reason is required."); return; } void mutate("conflict", selected.id, async () => { await declareConflict(token!, selected.id, conflictReason.trim()); }, () => setConflict(true)); }}><label>Conflict reason<textarea value={conflictReason} onChange={(event) => setConflictReason(event.target.value)} /></label><button className="danger-button" disabled={pending !== null}>{pending === "conflict" ? "Declaring..." : "Declare conflict"}</button></form>}</>}</aside></div></section>;
}
