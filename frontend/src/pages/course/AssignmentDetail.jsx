import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Download, Pencil } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../../components/ui';
import { api, fileProblem, MAX_UPLOAD_MB, openDownload, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import AssignmentForm from './AssignmentForm';

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

function GradeRow({ submission, assignment, path, onGraded }) {
  const [mark, setMark] = useState(submission.mark ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [release, setRelease] = useState(submission.released);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.put(`${path}/submissions/${submission.student_id}/grade`, { mark: Number(mark), feedback, release });
      onGraded();
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setError(null);
    try {
      await openDownload(`${path}/submissions/${submission.student_id}/download`);
    } catch (problem) {
      setError(problem);
    }
  };

  const id = submission.student_id;
  return (
    <li className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{submission.student_name}</span>
        {submission.late && <span className="badge bg-amber-100 text-amber-700">Late</span>}
        {submission.released && <span className="badge bg-emerald-100 text-emerald-700">Released</span>}
        <span className="text-xs text-slate-500">{formatDateTime(submission.submitted_at)}</span>
      </div>
      {submission.text && <p className="text-sm whitespace-pre-wrap">{submission.text}</p>}
      {submission.file_name && (
        <button type="button" className="text-sm link inline-flex items-center gap-1" onClick={download}>
          <Download size={14} aria-hidden="true" />
          {submission.file_name}
        </button>
      )}
      <form className="grid sm:grid-cols-[120px_1fr] gap-3" onSubmit={save}>
        <div>
          <label className="label" htmlFor={`mark-${id}`}>Mark / {assignment.max_mark}</label>
          <input id={`mark-${id}`} type="number" min={0} max={assignment.max_mark} required className="input" value={mark} onChange={(event) => setMark(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`feedback-${id}`}>Feedback</label>
          <textarea id={`feedback-${id}`} rows={2} maxLength={5000} className="input" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={release} onChange={(event) => setRelease(event.target.checked)} />
            Release to the student
          </label>
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save mark'}</button>
        </div>
      </form>
      <ErrorNote error={error} />
    </li>
  );
}

function Submissions({ assignment, path }) {
  const { data: submissions, error, loading, reload } = useLoad(() => api.get(`${path}/submissions`), [path]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Submissions</h2>
      {loading && !submissions && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {submissions?.length === 0 && <Empty>No submissions yet.</Empty>}
      {submissions?.length > 0 && (
        <ul className="card divide-y divide-slate-100">
          {submissions.map((submission) => (
            <GradeRow
              key={`${submission.student_id}-${submission.submitted_at}`}
              submission={submission}
              assignment={assignment}
              path={path}
              onGraded={reload}
            />
          ))}
        </ul>
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
