import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, RefreshCw } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { useCourseItems } from '../lib/useCourseItems';

export default function GradingHub() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useCourseItems('assignments');
  const [course, setCourse] = useState('all');
  const [counts, setCounts] = useState({});
  const [countError, setCountError] = useState(null);
  const [checking, setChecking] = useState(false);

  if (user.role === 'student') return <Navigate to="/" replace />;

  const assignments = (data?.items || [])
    .filter((item) => item.course_role !== 'student' && (course === 'all' || item.course_id === course))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const staffCourses = (data?.courses || []).filter((item) => item.my_role !== 'student');

  async function checkSubmissions() {
    setCountError(null);
    setChecking(true);
    const results = await Promise.allSettled(assignments.map((item) =>
      api.get(`/courses/${item.course_id}/assignments/${item.id}/submissions`)
    ));
    const next = {};
    let failures = 0;
    results.forEach((result, index) => {
      const item = assignments[index];
      if (result.status === 'fulfilled') {
        const submissions = result.value;
        next[`${item.course_id}:${item.id}`] = {
          total: submissions.length,
          needsMarking: submissions.filter((s) => s.mark == null).length,
          unreleased: submissions.filter((s) => s.mark != null && !s.released).length,
        };
      } else failures += 1;
    });
    setCounts((old) => ({ ...old, ...next }));
    if (failures) setCountError(`${failures} assignment${failures === 1 ? '' : 's'} could not be checked. Open the assignment to see more details.`);
    setChecking(false);
  }

  return <div className="space-y-5">
    <PageHeader title="Grading" subtitle="Review coursework submissions and open the existing marking screens." />
    <ErrorNote error={error} onRetry={reload} />
    {loading && !data && <Loading label="Loading teaching assignments…" />}
    {data && <>
      {data.unavailable.length > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Could not load assignments for: {data.unavailable.map((item) => item.course).join(', ')}. <button type="button" className="underline" onClick={reload}>Retry</button></p>}
      <div className="card p-4 flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm font-medium flex-1 min-w-[180px] max-w-sm">Course
          <select className="input mt-1" value={course} onChange={(event) => setCourse(event.target.value)}><option value="all">All courses</option>{staffCourses.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select>
        </label>
        <button type="button" onClick={checkSubmissions} disabled={checking || assignments.length === 0} className="btn-primary"><RefreshCw size={16} aria-hidden="true" />{checking ? 'Checking…' : 'Check marking progress'}</button>
      </div>
      {countError && <p role="alert" className="text-sm text-amber-800">{countError}</p>}
      {assignments.length === 0 && <div className="card p-5"><Empty>No assignments available to mark.</Empty></div>}
      <div className="space-y-3">
        {assignments.map((item) => {
          const status = counts[`${item.course_id}:${item.id}`];
          return <article key={`${item.course_id}-${item.id}`} className="card p-4 sm:p-5 flex flex-wrap gap-4 items-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-mint text-brand-forest"><ClipboardCheck size={20} aria-hidden="true" /></span>
            <div className="flex-1 min-w-[180px]"><p className="text-xs font-semibold text-brand-forest">{item.course_code}{item.kind === 'quiz' ? ' · Quiz' : ''}</p><h2 className="font-display text-lg font-semibold">{item.title}</h2><p className="text-sm text-brand-muted">Due {formatDateTime(item.due_at)}</p>{status && <div className="mt-2 text-sm flex flex-wrap gap-x-3 gap-y-1"><span><strong>{status.needsMarking}</strong> to mark</span><span><strong>{status.unreleased}</strong> awaiting release</span><span className="inline-flex items-center gap-1"><CheckCheck size={14} /> {status.total} submissions</span></div>}</div>
            <Link to={`/courses/${item.course_id}/assignments/${item.id}`} className="btn-primary">Open marking</Link>
          </article>;
        })}
      </div>
    </>}
  </div>;
}
