import { useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Empty, ErrorNote, Loading } from '../../components/ui';
import { api, openDownload } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import { LateBadge, StatusBadge } from './grading';

function DownloadButton({ path, fileName }) {
  const [error, setError] = useState(null);

  const download = async () => {
    setError(null);
    try {
      await openDownload(path);
    } catch (problem) {
      setError(problem);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" className="text-sm link inline-flex items-center gap-1 break-all text-left" onClick={download}>
        <Download size={14} aria-hidden="true" className="shrink-0" />
        {fileName}
      </button>
      <ErrorNote error={error} />
    </div>
  );
}

function SubmissionPanel({ submission, path }) {
  const studentPath = `${path}/submissions/${submission.student_id}`;
  const history = [...(submission.history ?? [])].sort((a, b) => b.attempt - a.attempt);

  return (
    <section className="space-y-4 min-w-0">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            {submission.attempt > 1 ? `Attempt ${submission.attempt}` : 'Submission'}
          </h2>
          <LateBadge submission={submission} />
        </div>

        {submission.submitted_at ? (
          <>
            <p className="text-xs text-slate-500">Submitted {formatDateTime(submission.submitted_at)}</p>
            {submission.text && (
              <div className="text-sm whitespace-pre-wrap break-words bg-slate-50 border border-slate-100 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
                {submission.text}
              </div>
            )}
            {submission.file_name && <DownloadButton path={`${studentPath}/download`} fileName={submission.file_name} />}
            {!submission.text && !submission.file_name && <Empty>This submission is empty.</Empty>}
          </>
        ) : (
          <Empty>Nothing was submitted online. This mark was entered by hand, for example for work done in class.</Empty>
        )}
      </div>

      {history.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Earlier attempts</h2>
          <ul className="divide-y divide-slate-100">
            {history.map((attempt) => (
              <li key={attempt.attempt} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">Attempt {attempt.attempt}</span>
                  {attempt.submitted_at && (
                    <span className="text-xs text-slate-500">{formatDateTime(attempt.submitted_at)}</span>
                  )}
                  {attempt.late && <span className="badge bg-amber-100 text-amber-700">Late</span>}
                  {attempt.mark !== null && attempt.mark !== undefined && (
                    <span className="text-xs text-slate-600">Marked {attempt.mark}</span>
                  )}
                </div>
                {attempt.text && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-600">Show answer</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words">{attempt.text}</p>
                  </details>
                )}
                {attempt.file_name && (
                  <DownloadButton
                    path={`${studentPath}/attempts/${attempt.attempt}/download`}
                    fileName={attempt.file_name}
                  />
                )}
                {attempt.feedback && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">Feedback: {attempt.feedback}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function GradeForm({ submission, assignment, path, onSaved, onCleared, next }) {
  const [mark, setMark] = useState(submission.mark ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [release, setRelease] = useState(submission.released);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const gradePath = `${path}/submissions/${submission.student_id}/grade`;
  const hasMark = submission.mark !== null && submission.mark !== undefined;
  const penalty = assignment.late_penalty_percent ?? 0;
  const showPenalty = hasMark && submission.final_mark !== null && submission.final_mark !== undefined
    && submission.final_mark !== submission.mark;

  const save = async (goNext) => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.put(gradePath, { mark: Number(mark), feedback, release });
      await onSaved(goNext);
      if (!goNext) setSaved(true);
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    const warning = submission.submitted_at
      ? 'Clear this mark and feedback? The submission is kept.'
      : 'Clear this mark? Nothing was submitted online, so this student will have no record for the assignment.';
    if (!window.confirm(warning)) return;
    setError(null);
    setSaving(true);
    try {
      await api.del(gradePath);
      setMark('');
      setFeedback('');
      setRelease(false);
      setSaved(false);
      await onCleared(!submission.submitted_at);
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    save(false);
  };

  return (
    <form className="card p-4 space-y-4" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Mark</h2>
        <StatusBadge submission={submission} />
      </div>

      <div>
        <label className="label" htmlFor="grade-mark">Mark out of {assignment.max_mark}</label>
        <input
          id="grade-mark"
          type="number"
          inputMode="numeric"
          min={0}
          max={assignment.max_mark}
          step={1}
          required
          className="input"
          value={mark}
          onChange={(event) => {
            setMark(event.target.value);
            setSaved(false);
          }}
        />
        {submission.late && penalty > 0 && (
          <p className="text-xs text-amber-700 mt-1">
            {penalty}% is taken off for each day late.
            {showPenalty && ` After the penalty: ${submission.final_mark}/${assignment.max_mark}.`}
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="grade-feedback">Feedback</label>
        <textarea
          id="grade-feedback"
          rows={8}
          maxLength={5000}
          className="input"
          value={feedback}
          onChange={(event) => {
            setFeedback(event.target.value);
            setSaved(false);
          }}
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={release}
          onChange={(event) => {
            setRelease(event.target.checked);
            setSaved(false);
          }}
        />
        <span>
          Release to the student
          <span className="block text-xs text-slate-500">Leave this off to hold the mark until you release them all.</span>
        </span>
      </label>

      <ErrorNote error={error} />
      {saved && <p role="status" className="text-sm text-emerald-700">Saved.</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={saving || mark === ''}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {next && (
          <button type="button" className="btn-ghost" disabled={saving || mark === ''} onClick={() => save(true)}>
            Save and next
          </button>
        )}
        {hasMark && (
          <button type="button" className="btn-danger" disabled={saving} onClick={clear}>
            Clear mark
          </button>
        )}
      </div>
    </form>
  );
}

export default function GradeSubmission() {
  const { assignmentId, studentId } = useParams();
  const { course, canEdit } = useOutletContext();
  const navigate = useNavigate();
  const path = `/courses/${course.id}/assignments/${assignmentId}`;
  const assignmentLoad = useLoad(() => api.get(path), [path]);
  const submissionsLoad = useLoad(() => api.get(`${path}/submissions`), [path]);

  if (!canEdit) return <Navigate to={path} replace />;

  const assignment = assignmentLoad.data;
  const submissions = submissionsLoad.data;
  const loadError = assignmentLoad.error ?? submissionsLoad.error;

  if ((!assignment || !submissions) && loadError) {
    return (
      <div className="space-y-3">
        <ErrorNote
          error={loadError}
          onRetry={() => {
            assignmentLoad.reload();
            submissionsLoad.reload();
          }}
        />
        <Link to={path} className="link text-sm">Back to the assignment</Link>
      </div>
    );
  }
  if (!assignment || !submissions) return <Loading />;

  const index = submissions.findIndex((submission) => submission.student_id === studentId);
  const submission = submissions[index];
  const previous = index > 0 ? submissions[index - 1] : null;
  const next = index >= 0 && index < submissions.length - 1 ? submissions[index + 1] : null;
  const studentPath = (other) => `${path}/submissions/${other.student_id}`;

  if (!submission) {
    return (
      <div className="space-y-3">
        <Empty>This student has no submission or mark for this assignment.</Empty>
        <Link to={path} className="link text-sm">Back to the assignment</Link>
      </div>
    );
  }

  const onSaved = async (goNext) => {
    await submissionsLoad.reload();
    if (goNext && next) navigate(studentPath(next));
  };

  // Clearing a mark that had no submission removes the student from the list.
  const onCleared = async (removed) => {
    if (removed) {
      navigate(next ? studentPath(next) : previous ? studentPath(previous) : path, { replace: true });
    }
    await submissionsLoad.reload();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link to={path} className="link text-sm">Back to {assignment.title}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 break-words">{submission.student_name}</h1>
            <p className="text-sm text-slate-500">
              {assignment.title} · student {index + 1} of {submissions.length}
            </p>
          </div>
          <nav aria-label="Students" className="flex gap-2">
            {previous ? (
              <Link to={studentPath(previous)} className="btn-ghost" title={previous.student_name}>
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span className="btn-ghost opacity-50 cursor-not-allowed" aria-disabled="true">
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </span>
            )}
            {next ? (
              <Link to={studentPath(next)} className="btn-ghost" title={next.student_name}>
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span className="btn-ghost opacity-50 cursor-not-allowed" aria-disabled="true">
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            )}
          </nav>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SubmissionPanel submission={submission} path={path} />
        <div className="lg:sticky lg:top-4 self-start">
          <GradeForm
            // A fresh form for each student.
            key={submission.student_id}
            submission={submission}
            assignment={assignment}
            path={path}
            next={next}
            onSaved={onSaved}
            onCleared={onCleared}
          />
        </div>
      </div>
    </div>
  );
}
