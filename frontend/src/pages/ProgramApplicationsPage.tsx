import { useEffect, useRef, useState, type FormEvent } from "react";

import { ApiError } from "../services/api";
import { beginReview, createApplication, getApplication, listApplications, recordDecision, setArchiveState, updateApplication } from "../services/applications";
import { createAssignment, listApplicationAssignments, listReviewers, removeAssignment, updateAssignmentDueAt, type ReviewerOption } from "../services/assignments";
import { useAuth } from "../auth/AuthProvider";
import type { Application, ApplicationDiscovery, ApplicationInput, ApplicationStatus, FundingDecisionStatus } from "../types/application";
import type { ReviewerAssignment } from "../types/assignment";

const initialFilters: ApplicationDiscovery = { sortBy: "submittedAt", sortDirection: "desc", page: 1, pageSize: 20 };
const emptyInput: ApplicationInput = { organizationName: "", contactEmail: "", fundingRoundId: "", requestedAmount: "", submittedAt: "" };

function message(error: unknown) { return error instanceof ApiError ? error.message : "We could not complete that request. Please try again."; }
export function dateTimeInputFromIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
export function localDateTimeToIso(value: string) { return new Date(value).toISOString(); }
function readableStatus(status: ApplicationStatus) { return status.replaceAll("_", " "); }

function ApplicationForm({ initialValue, submitLabel, onSubmit, onCancel }: { initialValue: ApplicationInput; submitLabel: string; onSubmit: (value: ApplicationInput) => Promise<void>; onCancel?: () => void }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(initialValue), [initialValue]);
  const change = (field: keyof ApplicationInput, next: string) => setValue((current) => ({ ...current, [field]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try { await onSubmit({ ...value, submittedAt: localDateTimeToIso(value.submittedAt) }); }
    catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  };
  return <form className="application-form" onSubmit={submit}>
    <label>Organization name<input required value={value.organizationName} onChange={(event) => change("organizationName", event.target.value)} /></label>
    <label>Contact email<input required type="email" value={value.contactEmail} onChange={(event) => change("contactEmail", event.target.value)} /></label>
    <label>Funding round ID<input aria-label="Application funding round ID" required value={value.fundingRoundId} onChange={(event) => change("fundingRoundId", event.target.value)} /></label>
    <label>Requested amount<input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="1000.00" value={value.requestedAmount} onChange={(event) => change("requestedAmount", event.target.value)} /></label>
    <label>Submitted at<input required type="datetime-local" value={value.submittedAt} onChange={(event) => change("submittedAt", event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving..." : submitLabel}</button>{onCancel && <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}

export function ProgramApplicationsPage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [result, setResult] = useState<{ applications: Application[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [failedDetailId, setFailedDetailId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const discoveryRequest = useRef(0);
  const currentFilters = useRef(filters);
  const mutationInFlight = useRef(false);
  const currentSelectedId = useRef<string | null>(null);

  const refreshList = async (query = currentFilters.current) => {
    if (!token) return;
    const request = ++discoveryRequest.current;
    setLoading(true); setError(null);
    try {
      const next = await listApplications(token, query);
      if (request === discoveryRequest.current) setResult(next);
    } catch (cause) {
      if (request === discoveryRequest.current) setError(message(cause));
    } finally {
      if (request === discoveryRequest.current) setLoading(false);
    }
  };
  useEffect(() => { currentFilters.current = filters; void refreshList(filters); }, [token, filters]);

  const select = async (id: string) => {
    if (!token) return;
    currentSelectedId.current = id; setDetailLoading(true); setActionError(null); setDetailError(null); setFailedDetailId(null); setEditing(false); setSelected(null); setShowCreate(false);
    try { const application = await getApplication(token, id); if (currentSelectedId.current === id) setSelected(application); }
    catch (cause) { if (currentSelectedId.current === id) { setDetailError(message(cause)); setFailedDetailId(id); } }
    finally { if (currentSelectedId.current === id) setDetailLoading(false); }
  };
  const applyApplication = (application: Application) => {
    setSelected(application);
    setResult((current) => current && { ...current, applications: current.applications.map((item) => item.id === application.id ? application : item) });
  };
  const mutate = async (action: string, operation: () => Promise<Application | void>) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; setPendingAction(action); setActionError(null);
    try { const application = await operation(); if (application) applyApplication(application); await refreshList(); }
    catch (cause) { setActionError(message(cause)); }
    finally { mutationInFlight.current = false; setPendingAction(null); }
  };
  const filter = (field: keyof ApplicationDiscovery, value: string | number | boolean | undefined) => setFilters((current) => {
    const next = { ...current, [field]: value, page: field === "page" ? Number(value) : 1 };
    currentFilters.current = next;
    return next;
  });
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const formValue = selected && { organizationName: selected.organizationName, contactEmail: selected.contactEmail, fundingRoundId: selected.fundingRoundId, requestedAmount: selected.requestedAmount, submittedAt: dateTimeInputFromIso(selected.submittedAt) };

  return <section className="applications-page">
    <div className="page-heading"><div><p className="eyebrow">Program office</p><h1>Applications</h1><p>Find, maintain, and move grant applications through their lifecycle.</p></div><button className="primary-button" onClick={() => { setShowCreate(true); setSelected(null); setDetailError(null); }}>New application</button></div>
    <div className="discovery-panel" aria-label="Application discovery">
      <label>Search<input aria-label="Search applications" value={filters.search ?? ""} onChange={(event) => filter("search", event.target.value || undefined)} placeholder="Organization or email" /></label>
      <label>Status<select aria-label="Status" value={filters.status ?? ""} onChange={(event) => filter("status", event.target.value || undefined)}><option value="">All statuses</option>{(["SUBMITTED", "ASSIGNED", "UNDER_REVIEW", "DECIDED"] as ApplicationStatus[]).map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}</select></label>
      <label>Funding round ID<input aria-label="Funding round ID" value={filters.fundingRoundId ?? ""} onChange={(event) => filter("fundingRoundId", event.target.value || undefined)} /></label>
      <label>Owner ID<input aria-label="Owner ID" value={filters.ownerId ?? ""} onChange={(event) => filter("ownerId", event.target.value || undefined)} /></label>
      <label>Overdue<select aria-label="Overdue" value={filters.overdue === undefined ? "" : String(filters.overdue)} onChange={(event) => filter("overdue", event.target.value === "" ? undefined : event.target.value === "true")}><option value="">Any review state</option><option value="true">Overdue reviews</option><option value="false">No overdue reviews</option></select></label>
      <label>Sort by<select aria-label="Sort by" value={filters.sortBy} onChange={(event) => filter("sortBy", event.target.value)}><option value="submittedAt">Submitted date</option><option value="requestedAmount">Requested amount</option><option value="status">Status</option></select></label>
      <label>Direction<select aria-label="Sort direction" value={filters.sortDirection} onChange={(event) => filter("sortDirection", event.target.value)}><option value="desc">Newest / highest</option><option value="asc">Oldest / lowest</option></select></label>
    </div>
    <div className="applications-layout">
      <div className="application-list" aria-live="polite">
        {loading && <p className="state-message">Loading applications...</p>}
        {error && <div className="state-message error-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void refreshList()}>Try again</button></div>}
        {!loading && !error && result?.applications.length === 0 && <p className="state-message">No applications match these filters.</p>}
        {!loading && !error && result && result.applications.length > 0 && <><div className="table-wrap"><table><thead><tr><th>Organization</th><th>Status</th><th>Amount</th><th>Submitted</th><th>State</th></tr></thead><tbody>{result.applications.map((application) => <tr key={application.id}><td><button className="application-link" onClick={() => void select(application.id)}>{application.organizationName}</button><span>{application.fundingRound.name}</span></td><td><span className={`status-pill status-${application.status.toLowerCase()}`}>{readableStatus(application.status)}</span></td><td>{application.requestedAmount}</td><td>{new Date(application.submittedAt).toLocaleDateString()}</td><td>{application.archivedAt ? "Archived" : "Active"}</td></tr>)}</tbody></table></div><div className="pagination"><span>{result.total} total</span><label>Rows<select aria-label="Rows per page" value={filters.pageSize} onChange={(event) => filter("pageSize", Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><button className="secondary-button" disabled={filters.page <= 1} onClick={() => filter("page", filters.page - 1)}>Previous</button><span>Page {filters.page} of {pages}</span><button className="secondary-button" disabled={filters.page >= pages} onClick={() => filter("page", filters.page + 1)}>Next</button></div></>}
      </div>
      <aside className="detail-panel">{showCreate ? <><h2>New application</h2><ApplicationForm initialValue={emptyInput} submitLabel="Create application" onCancel={() => setShowCreate(false)} onSubmit={async (value) => { if (!token) return; const application = await createApplication(token, value); setShowCreate(false); applyApplication(application); await refreshList(); }} /></> : detailLoading ? <p className="state-message">Loading application...</p> : detailError ? <div className="state-message error-state" role="alert"><p>{detailError}</p>{failedDetailId && <button className="secondary-button" onClick={() => void select(failedDetailId)}>Try again</button>}</div> : selected ? <ApplicationDetail application={selected} editing={editing} setEditing={setEditing} formValue={formValue!} actionError={actionError} pendingAction={pendingAction} onSubmit={async (value) => { if (!token) return; await mutate("edit", () => updateApplication(token, selected.id, value)); setEditing(false); }} onArchive={() => token && mutate(selected.archivedAt ? "restore" : "archive", () => setArchiveState(token, selected.id, !selected.archivedAt))} onBeginReview={() => token && mutate("status", () => beginReview(token, selected.id))} onDecision={(decision) => token && mutate("decision", async () => { await recordDecision(token, selected.id, decision); return getApplication(token, selected.id); })} onAssignmentChange={async (id) => { if (!token) return; if (currentSelectedId.current === id) { const refreshed = await getApplication(token, id); if (currentSelectedId.current === id) applyApplication(refreshed); } await refreshList(); }} /> : <p className="state-message">Select an application to see its details, or create a new one.</p>}</aside>
    </div>
  </section>;
}

function ApplicationDetail({ application, editing, setEditing, formValue, actionError, pendingAction, onSubmit, onArchive, onBeginReview, onDecision, onAssignmentChange }: { application: Application; editing: boolean; setEditing: (editing: boolean) => void; formValue: ApplicationInput; actionError: string | null; pendingAction: string | null; onSubmit: (value: ApplicationInput) => Promise<void>; onArchive: () => void; onBeginReview: () => void; onDecision: (decision: FundingDecisionStatus) => void; onAssignmentChange: (id: string) => Promise<void> }) {
  if (editing) return <><h2>Edit application</h2><ApplicationForm initialValue={formValue} submitLabel="Save changes" onCancel={() => setEditing(false)} onSubmit={onSubmit} /></>;
  const canBegin = !application.archivedAt && application.status === "ASSIGNED";
  const completedReviews = application.reviews.length;
  const canDecide = !application.archivedAt && application.status === "UNDER_REVIEW" && completedReviews >= 3;
  const busy = pendingAction !== null;
  return <><div className="detail-heading"><div><p className="eyebrow">Application detail</p><h2>{application.organizationName}</h2></div><span className={`status-pill status-${application.status.toLowerCase()}`}>{readableStatus(application.status)}</span></div>{application.archivedAt && <p className="archive-notice">Archived {new Date(application.archivedAt).toLocaleDateString()}. Restore it before lifecycle actions.</p>}<dl className="application-details"><dt>Contact</dt><dd>{application.contactEmail}</dd><dt>Funding round</dt><dd>{application.fundingRound.name} <small>({application.fundingRoundId})</small></dd><dt>Requested amount</dt><dd>{application.requestedAmount}</dd><dt>Submitted</dt><dd>{new Date(application.submittedAt).toLocaleString()}</dd><dt>Owner</dt><dd>{application.owner.name}</dd>{application.fundingDecision && <><dt>Decision</dt><dd>{application.fundingDecision.decision} by {application.fundingDecision.decidedBy.name}</dd></>}</dl>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="detail-actions"><button className="secondary-button" disabled={busy} onClick={() => setEditing(true)}>Edit</button><button className="secondary-button" disabled={busy} onClick={onArchive}>{pendingAction === "archive" ? "Archiving..." : pendingAction === "restore" ? "Restoring..." : application.archivedAt ? "Restore" : "Archive"}</button>{canBegin && <button className="primary-button" disabled={busy} onClick={onBeginReview}>{pendingAction === "status" ? "Starting review..." : "Begin review"}</button>}{canDecide && <><button className="primary-button" disabled={busy} onClick={() => onDecision("APPROVED")}>{pendingAction === "decision" ? "Recording decision..." : "Approve funding"}</button><button className="danger-button" disabled={busy} onClick={() => onDecision("DECLINED")}>Decline funding</button></>}</div>{!application.archivedAt && application.status === "SUBMITTED" && <p className="lifecycle-note">Assign reviewers before review can begin.</p>}{!application.archivedAt && application.status === "UNDER_REVIEW" && completedReviews < 3 && <p className="lifecycle-note">Decision available after 3 completed reviews ({completedReviews}/3).</p>}{!application.archivedAt && application.status === "DECIDED" && <p className="lifecycle-note">This application has a recorded funding decision.</p>}<AssignmentManager key={application.id} application={application} onChanged={onAssignmentChange} /></>;
}

function AssignmentManager({ application, onChanged }: { application: Application; onChanged: (id: string) => Promise<void> }) {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<ReviewerAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [reviewers, setReviewers] = useState<ReviewerOption[] | null>(null);
  const [reviewersError, setReviewersError] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const request = useRef(0);
  const currentApplicationId = useRef(application.id);
  const mutationInFlight = useRef(false);
  const mounted = useRef(true);
  const isCurrent = () => mounted.current && currentApplicationId.current === application.id;
  const refresh = async () => {
    if (!token) return;
    const sequence = ++request.current;
    if (isCurrent()) { setLoading(true); setError(null); }
    try {
      const next = await listApplicationAssignments(token, application.id);
      if (sequence === request.current && currentApplicationId.current === application.id) setAssignments(next);
    }
    catch (cause) {
      if (sequence === request.current && currentApplicationId.current === application.id) setError(message(cause));
    }
    finally {
      if (sequence === request.current && currentApplicationId.current === application.id) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    currentApplicationId.current = application.id;
    setEditingId(null);
    setDueAt("");
    if (application.archivedAt || application.status === "DECIDED") { setAssignments(null); setLoading(false); return () => { mounted.current = false; }; }
    void refresh();
    return () => { mounted.current = false; };
  }, [token, application.id, application.archivedAt, application.status]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    setReviewersError(null);
    listReviewers(token)
      .then((next) => { if (active) setReviewers(next); })
      .catch((cause) => { if (active) setReviewersError(message(cause)); });
    return () => { active = false; };
  }, [token]);
  const mutate = async (action: string, operation: () => Promise<unknown>) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    if (isCurrent()) { setPending(action); setError(null); }
    try {
      await operation();
      if (isCurrent()) await Promise.all([refresh(), onChanged(application.id)]);
    }
    catch (cause) { if (isCurrent()) setError(message(cause)); }
    finally {
      mutationInFlight.current = false;
      if (isCurrent()) setPending(null);
    }
  };
  const canAssign = !application.archivedAt && application.status !== "DECIDED";
  return <section className="assignment-manager"><div className="section-heading"><h3>Reviewer assignments</h3><span>{assignments?.length ?? 0} total</span></div>{loading && <p className="state-message">Loading assignments...</p>}{error && <div className="form-error" role="alert">{error}</div>}{!loading && assignments?.length === 0 && <p className="lifecycle-note">No reviewers have been assigned yet.</p>}{assignments && assignments.length > 0 && <div className="assignment-list">{assignments.map((assignment) => {
    const editable = !assignment.removedAt && assignment.review?.status !== "COMPLETED";
    const editAction = `edit-${assignment.id}`;
    const removeAction = `remove-${assignment.id}`;
    const editValue = dateTimeInputFromIso(assignment.dueAt);
    return <div key={assignment.id} className="assignment-row"><div><strong>{assignment.reviewer.name}</strong><span>{assignment.reviewer.email}</span><span>{assignment.removedAt ? `Removed ${new Date(assignment.removedAt).toLocaleDateString()}` : assignment.review?.status === "COMPLETED" ? "Completed review" : "Active assignment"}</span></div><div className="assignment-actions">{editingId === assignment.id ? <form className="assignment-edit-form" onSubmit={(event) => {
      event.preventDefault();
      const nextDueAt = dueAt === editValue ? assignment.dueAt : localDateTimeToIso(dueAt);
      void mutate(editAction, async () => {
        await updateAssignmentDueAt(token!, assignment.id, nextDueAt);
        setEditingId(null);
        setDueAt("");
      });
    }}><label>Due date<input aria-label={`Due date for ${assignment.reviewer.name}`} required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><div className="form-actions"><button className="primary-button" disabled={pending !== null}>{pending === editAction ? "Saving..." : "Save"}</button><button className="secondary-button" type="button" disabled={pending !== null} onClick={() => { setEditingId(null); setDueAt(""); }}>Cancel</button></div></form> : <><span>Due {new Date(assignment.dueAt).toLocaleString()}</span>{editable && <><button className="secondary-button" disabled={pending !== null} onClick={() => { setEditingId(assignment.id); setDueAt(editValue); }}>Edit due date</button><button className="danger-button" disabled={pending !== null} onClick={() => void mutate(removeAction, () => removeAssignment(token!, assignment.id))}>{pending === removeAction ? "Removing..." : "Remove"}</button></>}</>}</div></div>;
  })}</div>}{canAssign && <form className="assignment-create-form" onSubmit={(event) => { event.preventDefault(); if (reviewerId && dueAt) void mutate("create-assignment", async () => { await createAssignment(token!, application.id, { reviewerId, dueAt: localDateTimeToIso(dueAt) }); setReviewerId(""); setDueAt(""); }); }}><label>Reviewer<select required aria-label="Reviewer" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} disabled={!reviewers}><option value="">{reviewers ? "Select a reviewer" : "Loading reviewers..."}</option>{reviewers?.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} ({reviewer.email})</option>)}</select></label>{reviewersError && <p className="form-error" role="alert">{reviewersError}</p>}{reviewers?.length === 0 && <p className="lifecycle-note">No reviewers are available.</p>}<label>Due date<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><button className="primary-button" disabled={pending !== null || !reviewerId}>{pending === "create-assignment" ? "Assigning..." : "Assign reviewer"}</button></form>}</section>;
}
