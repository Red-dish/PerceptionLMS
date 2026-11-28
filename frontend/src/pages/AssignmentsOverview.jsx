import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { useCourseItems } from '../lib/useCourseItems';

function statusFor(assignment, role) {
  if (role === 'student' && assignment.my_submission) {
    if (assignment.my_submission.released) return 'Graded';
    return 'Submitted';
  }
  return new Date(assignment.due_at).getTime() < Date.now() ? 'Past due' : 'Upcoming';
}

const badgeTone = {
  Graded: 'bg-emerald-100 text-emerald-800',
  Submitted: 'bg-blue-100 text-blue-800',
  'Past due': 'bg-amber-100 text-amber-900',
  Upcoming: 'bg-brand-mint text-brand-forest',
};

export default function AssignmentsOverview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useCourseItems('assignments');
  const [course, setCourse] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const assignments = useMemo(() => (data?.items || [])
    .filter((item) => course === 'all' || item.course_id === course)
    .filter((item) => status === 'all' || statusFor(item, user.role) === status)
    .filter((item) => `${item.title} ${item.course_code}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at)), [data, course, status, query, user.role]);

  return (
    <div className="space-y-5">
      <PageHeader title="Assignments" subtitle="Coursework and deadlines from all your courses." />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data && <Loading label="Loading coursework…" />}
      {data && <>
        {data.unavailable.length > 0 && <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">Could not load: {data.unavailable.map((item) => `${item.course} (${item.message})`).join('; ')}. <button type="button" className="underline" onClick={reload}>Retry</button></p>}
        <div className="card p-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">Course
            <select className="input mt-1" value={course} onChange={(event) => setCourse(event.target.value)}>
              <option value="all">All courses</option>
              {data.courses.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Status
            <select className="input mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {['Upcoming', 'Past due', ...(user.role === 'student' ? ['Submitted', 'Graded'] : [])].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Search
            <span className="relative mt-1 block"><Search size={17} aria-hidden="true" className="absolute left-3 top-3 text-brand-muted" /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Assignment or course" /></span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold">Coursework</h2><span className="text-sm text-brand-muted">{assignments.length} shown</span></div>
        {assignments.length === 0 && <div className="card p-5"><Empty>No assignments match your filters.</Empty></div>}
        <ul className="space-y-3">
          {assignments.map((item) => {
            const state = statusFor(item, user.role);
            return (
              <li key={`${item.course_id}-${item.id}`}>
                <Link to={`/courses/${item.course_id}/assignments/${item.id}`} className="card p-4 sm:p-5 flex flex-wrap items-center gap-4 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-forest transition-shadow">
                  <span className="grid h-11 w-11 rounded-xl bg-brand-mint place-items-center text-brand-forest"><ClipboardList size={20} aria-hidden="true" /></span>
                  <span className="flex-1 min-w-[180px]"><span className="block text-xs font-semibold text-brand-forest">{item.course_code}{item.kind === 'quiz' ? ' · Quiz' : ''}</span><span className="block font-semibold text-brand-ink">{item.title}</span><span className="block text-sm text-brand-muted">Due {formatDateTime(item.due_at)}</span></span>
                  <span className={`badge ${badgeTone[state]}`}>{state}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </>}
    </div>
  );
}
