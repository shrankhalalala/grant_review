import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "../auth/AuthProvider";
import { listReviewers, type ReviewerOption } from "../services/assignments";
import { getCalibration } from "../services/calibration";
import { listFundingRounds } from "../services/fundingRounds";
import { bulkAssign, exportCsv } from "../services/reporting";
import { ApiError } from "../services/api";
import { localDateTimeToIso } from "./ProgramApplicationsPage";
import type { FundingRound } from "../types/fundingRound";
import type { BulkAssignmentResult } from "../types/reporting";
import type { CalibrationReport } from "../types/calibration";

const message = (error: unknown) => error instanceof ApiError ? error.message : "We could not complete that request.";
const score = (value: number) => value.toFixed(2);

export function ReportsPage() {
  const { token } = useAuth();
  const [rounds, setRounds] = useState<FundingRound[] | null>(null);
  const [reviewers, setReviewers] = useState<ReviewerOption[] | null>(null);
  const [roundId, setRoundId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [results, setResults] = useState<BulkAssignmentResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationReport | null>(null);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const version = useRef(0);
  const calibrationVersion = useRef(0);
  const actionSequence = useRef(0);
  const activeBulkRequest = useRef<number | null>(null);
  const activeExportRequest = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([listFundingRounds(token), listReviewers(token)])
      .then(([nextRounds, nextReviewers]) => { if (active) { setRounds(nextRounds); setReviewers(nextReviewers); } })
      .catch((cause) => active && setError(message(cause)));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const request = ++calibrationVersion.current;
    setCalibration(null);
    setCalibrationError(null);
    getCalibration(token, roundId || undefined)
      .then((next) => { if (calibrationVersion.current === request) setCalibration(next); })
      .catch((cause) => { if (calibrationVersion.current === request) setCalibrationError(message(cause)); });
  }, [token, roundId]);

  const changeRound = (id: string) => {
    version.current++;
    activeBulkRequest.current = null;
    activeExportRequest.current = null;
    setBulkPending(false);
    setExportPending(false);
    setRoundId(id);
    setResults(null);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || bulkPending) return;
    if (!roundId || !selected.length || !dueAt) {
      setError("Select a funding round, at least one reviewer, and a due date.");
      return;
    }
    const current = version.current;
    const request = ++actionSequence.current;
    activeBulkRequest.current = request;
    setBulkPending(true);
    setError(null);
    try {
      const next = await bulkAssign(token, roundId, selected, localDateTimeToIso(dueAt));
      if (current === version.current) setResults(next);
    } catch (cause) {
      if (current === version.current) setError(message(cause));
    } finally {
      if (activeBulkRequest.current === request) { activeBulkRequest.current = null; setBulkPending(false); }
    }
  };

  const download = async () => {
    if (!token || !roundId || exportPending) return;
    const current = version.current;
    const request = ++actionSequence.current;
    activeExportRequest.current = request;
    setExportPending(true);
    setError(null);
    try { await exportCsv(token, roundId); }
    catch (cause) { if (current === version.current) setError(message(cause)); }
    finally {
      if (activeExportRequest.current === request) { activeExportRequest.current = null; setExportPending(false); }
    }
  };

  return <section className="reports-page">
    <div className="page-heading"><div><p className="eyebrow">Program office</p><h1>Reports</h1><p>Coordinate round-level reviews and export completed work.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {rounds === null || reviewers === null ? <p className="state-message">Loading reporting tools...</p> : rounds.length === 0 ? <p className="state-message">No funding rounds are available.</p> : <form className="report-form" onSubmit={submit}>
      <label>Funding round<select aria-label="Funding round" value={roundId} onChange={(event) => changeRound(event.target.value)}><option value="">All funding rounds</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
      <fieldset><legend>Reviewers</legend>{reviewers.map((reviewer) => <label className="checkbox" key={reviewer.id}><input type="checkbox" checked={selected.includes(reviewer.id)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, reviewer.id] : value.filter((id) => id !== reviewer.id))}/>{reviewer.name} ({reviewer.email})</label>)}{!reviewers.length && <p>No reviewers are available.</p>}</fieldset>
      <label>Due date<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label>
      <div className="form-actions"><button className="primary-button" disabled={bulkPending}>{bulkPending ? "Working..." : "Bulk assign"}</button><button className="secondary-button" type="button" disabled={exportPending || !roundId} onClick={() => void download()}>{exportPending ? "Exporting..." : "Export completed reviews CSV"}</button></div>
    </form>}
    <section className="report-section calibration-section" aria-labelledby="calibration-title">
      <h2 id="calibration-title">Reviewer Calibration</h2>
      <p className="muted">Completed-review scoring tendencies only. This is descriptive, not a measure of reviewer quality.</p>
      {calibration === null && !calibrationError && <p className="state-message">Loading calibration...</p>}
      {calibrationError && <p className="form-error">{calibrationError}</p>}
      {calibration && calibration.reviewers.length === 0 && <p className="state-message">No completed reviews are available for this scope.</p>}
      {calibration && calibration.reviewers.length > 0 && <div className="table-wrap"><p>Overall benchmark: <strong>{score(calibration.globalOverallAverage)}</strong></p><table><thead><tr><th>Reviewer</th><th>Completed</th><th>Impact</th><th>Feasibility</th><th>Budget</th><th>Overall</th><th>vs overall</th><th>Tendency</th></tr></thead><tbody>{calibration.reviewers.map((reviewer) => <tr key={reviewer.reviewerId}><td>{reviewer.reviewerName}<span>{reviewer.reviewerEmail}</span></td><td>{reviewer.completedReviewCount}</td><td>{score(reviewer.averageImpact)}</td><td>{score(reviewer.averageFeasibility)}</td><td>{score(reviewer.averageBudgetJustification)}</td><td>{score(reviewer.overallAverage)}</td><td>{reviewer.overallDifference > 0 ? "+" : ""}{score(reviewer.overallDifference)}</td><td>{reviewer.tendency}</td></tr>)}</tbody></table></div>}
    </section>
    {results && <section className="report-section"><h2>Assignment results</h2>{results.map((result, index) => <p key={`${result.applicationId}-${result.reviewerId}-${index}`} className={result.success ? "result-success" : "form-error"}>{result.applicationId} - {reviewers?.find((reviewer) => reviewer.id === result.reviewerId)?.name ?? result.reviewerId}: {result.success ? "Assigned" : result.reason}</p>)}</section>}
  </section>;
}
