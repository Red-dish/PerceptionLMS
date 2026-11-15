import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Download, EyeOff, Pencil, Send } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../../components/ui';
import { api, fileProblem, MAX_UPLOAD_MB, openDownload, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import AssignmentForm from './AssignmentForm';
import { gradingStatus, LateBadge, markText, StatusBadge } from './grading';

function StudentSubmission({ assignment, path, onSubmitted }) {
  const { user } = useAuth();
  const submission = assignment.my_submission;
  const [text, setText] = useState(submission?.text ?? '');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body = { text: text.trim() ? text : null };
      if (file) body.file = { file_name: file.name, content_type: file.type || 'application/octet-stream' };
      const created = await api.post(`${path}/submission`, body);
      if (file) await uploadFile(created.upload, file);
      setFile(null);
      onSubmitted();
    } catch (failure) {
      // A failed upload leaves a submission with no file behind, so reload to show what was saved.
      setError(failure);
      onSubmitted();
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setDownloadError(null);
    try {
      await openDownload(`${path}/submissions/${user.id}/download`);
    } catch (problem) {
      setDownloadError(problem);
    }
  };

  return (
    <section className="space-y-4">
      {submission && (
        <div className="card p-4">
          <h2 className="font-semibold mb-1">Your submission</h2>
          <p className="text-xs text-slate-500 mb-2">
            Submitted {formatDateTime(submission.submitted_at)}
            {submission.late && <span className="badge bg-amber-100 text-amber-700 ml-2">Late</span>}
          </p>
          {submission.text && <p className="text-sm whitespace-pre-wrap">{submission.text}</p>}
          {submission.file_name && (
            <button type="button" className="text-sm link inline-flex items-center gap-1 mt-2" onClick={download}>
              <Download size={14} aria-hidden="true" />
              {submission.file_name}
            </button>
          )}
          <div className="mt-2"><ErrorNote error={downloadError} /></div>
          {submission.released && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="font-semibold">Mark: {submission.mark}/{assignment.max_mark}</div>
              {submission.feedback && <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{submission.feedback}</p>}
            </div>
          )}
        </div>
      )}

      {/* The API refuses a resubmission once the mark is released. */}
      {!submission?.released && (
        <form className="card p-4 space-y-3" onSubmit={submit}>
          <h2 className="font-semibold">{submission ? 'Resubmit' : 'Submit your work'}</h2>
          <div>
            <label className="label" htmlFor="submission-text">Your answer</label>
            <textarea id="submission-text" rows={5} maxLength={20000} className="input" value={text} onChange={(event) => setText(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="submission-file">File, up to {MAX_UPLOAD_MB} MB</label>
            <input id="submission-file" type="file" className="input" onChange={(event) => setFile(event.target.files[0] ?? null)} />
          </div>
          <p className="text-xs text-slate-500">Add an answer, a file or both.</p>
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={saving || (!text.trim() && !file)}>
            {saving ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}
    </section>
  );
}

function ReleaseAll({ submissions, path, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const held = submissions.filter((submission) => gradingStatus(submission) === 'held').length;
  const released = submissions.filter((submission) => gradingStatus(submission) === 'released').length;

  const run = async (release) => {
    const count = release ? held : released;
    const question = release
      ? `Release ${count} mark${count === 1 ? '' : 's'}? Students will see their mark and feedback.`
      : `Hide ${count} released mark${count === 1 ? '' : 's'} from students again?`;
    if (!window.confirm(question)) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { updated } = await api.post(`${path}/release`, { release });
      setMessage(`${release ? 'Released' : 'Hid'} ${updated} mark${updated === 1 ? '' : 's'}.`);
      onDone();
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  };

  if (!held && !released) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {held > 0 && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => run(true)}>
            <Send size={14} aria-hidden="true" />
            Release {held} mark{held === 1 ? '' : 's'}
          </button>
        )}
        {released > 0 && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(false)}>
            <EyeOff size={14} aria-hidden="true" />
            Hide released marks
          </button>
        )}
      </div>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <ErrorNote error={error} />
    </div>
  );
}

function Submissions({ assignment, path }) {
  const { data: submissions, error, loading, reload } = useLoad(() => api.get(`${path}/submissions`), [path]);
  const counts = { todo: 0, held: 0, released: 0 };
  submissions?.forEach((submission) => {
    counts[gradingStatus(submission)] += 1;
  });
  const firstToMark = submissions?.find((submission) => gradingStatus(submission) === 'todo');

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Submissions</h2>
          {submissions?.length > 0 && (
            <p className="text-sm text-slate-500">
              {counts.todo} to mark · {counts.held} marked, not released · {counts.released} released
            </p>
          )}
        </div>
        {firstToMark && (
          <Link to={`${path}/submissions/${firstToMark.student_id}`} className="btn-primary">
            Start marking
          </Link>
        )}
      </div>
      {loading && !submissions && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {submissions?.length === 0 && <Empty>No submissions yet.</Empty>}
      {submissions?.length > 0 && (
        <>
          <ReleaseAll submissions={submissions} path={path} onDone={reload} />
          <ul className="card divide-y divide-slate-100">
            {submissions.map((submission) => (
              <li key={submission.student_id}>
                <Link
                  to={`${path}/submissions/${submission.student_id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 hover:bg-slate-50"
                >
                  <span className="font-medium text-blue-700 min-w-0 break-words">{submission.student_name}</span>
                  <StatusBadge submission={submission} />
                  <LateBadge submission={submission} />
                  <span className="text-xs text-slate-500">
                    {submission.submitted_at ? formatDateTime(submission.submitted_at) : 'Marked by hand'}
                  </span>
                  <span className="ml-auto font-semibold text-slate-900">{markText(submission, assignment.max_mark)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function AssignmentDetail() {
  const { assignmentId } = useParams();
  const { course, myRole, canEdit } = useOutletContext();
  const [editing, setEditing] = useState(false);
  const list = `/courses/${course.id}/assignments`;
  const path = `${list}/${assignmentId}`;
  const { data: assignment, error, loading, reload } = useLoad(() => api.get(path), [path]);

  if (loading && !assignment) return <Loading />;
  if (error && !assignment) {
    return (
      <div className="space-y-3">
        <ErrorNote error={error} onRetry={error.status === 404 ? undefined : reload} />
        <Link to={list} className="link text-sm">Back to assignments</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={list} className="link text-sm">Back to assignments</Link>
        <div className="mt-2">
          <PageHeader
            title={assignment.title}
            subtitle={`Due ${formatDateTime(assignment.due_at)} · ${assignment.max_mark} marks · worth ${assignment.weight}%`}
          >
            {canEdit && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            )}
          </PageHeader>
        </div>
        {assignment.instructions && <p className="text-sm text-slate-700 whitespace-pre-wrap">{assignment.instructions}</p>}
      </div>

      {myRole === 'student'
        ? <StudentSubmission assignment={assignment} path={path} onSubmitted={reload} />
        : <Submissions assignment={assignment} path={path} />}

      {editing && (
        <AssignmentForm
          courseId={course.id}
          assignment={assignment}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
