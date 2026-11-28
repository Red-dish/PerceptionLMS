import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, RefreshCw } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { assignmentStatus, dateKey, monthCells, sortByDue } from '../lib/calendar';
import { formatDate, formatDateTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const statusLabels = { upcoming: 'Upcoming', overdue: 'Overdue', submitted: 'Submitted', past: 'Past due', unknown: 'Date unavailable' };
const statusStyles = {
  upcoming: 'bg-brand-mint/70 text-brand-forest',
  overdue: 'bg-red-50 text-red-800',
  submitted: 'bg-emerald-50 text-emerald-800',
  past: 'bg-amber-50 text-amber-900',
  unknown: 'bg-brand-paper text-brand-muted',
};

function Status({ assignment, role }) {
  const status = assignmentStatus(assignment, role);
  return <span className={`badge ${statusStyles[status]}`}>{statusLabels[status]}</span>;
}

function DeadlineItem({ assignment, role }) {
  return (
    <li>
      <Link to={`/courses/${assignment.course_id}/assignments/${assignment.id}`}
        className="group flex items-start gap-3 rounded-xl border border-brand-line bg-white p-3 transition hover:border-brand-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-forest">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-mint/60 text-brand-forest"><CalendarDays size={18} aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-ink group-hover:underline">{assignment.title}</p>
          <p className="mt-1 text-xs text-brand-muted">{assignment.course_code} · {formatDateTime(assignment.due_at)}{assignment.kind === 'quiz' ? ' · Quiz' : ''}</p>
          <div className="mt-2"><Status assignment={assignment} role={role} /></div>
        </div>
        <ArrowRight size={18} className="mt-1 shrink-0 text-brand-forest" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Calendar() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1, 12); });
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, loading, error, reload } = useLoad(async () => {
    // Only fetch courses the signed-in user may access. No new backend endpoint needed.
    const courses = await api.get('/courses');
    const results = await Promise.allSettled(courses.map((course) => api.get(`/courses/${course.id}/assignments`)));
    const failed = [];
    const assignments = [];
    results.forEach((result, index) => {
      const course = courses[index];
      if (result.status === 'rejected') {
        failed.push(course.code);
        return;
      }
      for (const item of result.value) {
        if (dateKey(item.due_at)) assignments.push({ ...item, course_id: course.id, course_code: course.code, course_title: course.title });
      }
    });
    if (failed.length && failed.length === courses.length) throw new Error('Could not load assignment deadlines. Check your connection and retry.');
    return { courses, assignments: sortByDue(assignments), failed };
  }, []);

  const role = user.role;
  const statusOptions = role === 'student'
    ? [['all', 'All statuses'], ['upcoming', 'Upcoming'], ['overdue', 'Overdue'], ['submitted', 'Submitted'], ['past', 'Past quizzes']]
    : [['all', 'All statuses'], ['upcoming', 'Upcoming'], ['past', 'Past due']];
  const all = data?.assignments || [];
  const visible = useMemo(() => all.filter((assignment) =>
    (courseFilter === 'all' || assignment.course_id === courseFilter) &&
    (statusFilter === 'all' || assignmentStatus(assignment, role) === statusFilter)
  ), [all, courseFilter, role, statusFilter]);
  const selected = visible.filter((assignment) => dateKey(assignment.due_at) === selectedDay);
  const next = visible.filter((assignment) => assignmentStatus(assignment, role) === 'upcoming').slice(0, 5);
  const dayMap = useMemo(() => {
    const lookup = new Map();
    visible.forEach((assignment) => {
      const key = dateKey(assignment.due_at);
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(assignment);
    });
    return lookup;
  }, [visible]);
  const cells = monthCells(month.getFullYear(), month.getMonth());
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
  const selectedLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDay}T12:00:00`));
  const today = dateKey(new Date());

  const changeMonth = (direction) => {
    const date = new Date(month.getFullYear(), month.getMonth() + direction, 1, 12);
    setMonth(date);
    setSelectedDay(dateKey(date));
  };
  const goToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12));
    setSelectedDay(dateKey(now));
  };
  const selectDay = (date) => {
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setSelectedDay(dateKey(date));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="eyebrow mb-2">Stay organised</p><PageHeader title="Assignment calendar" subtitle="See real course deadlines in one place. Select a day to open an assignment." /></div>
        <button type="button" onClick={reload} disabled={loading} className="btn-ghost"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
      </div>

      {loading && !data && <Loading label="Loading course deadlines…" />}
      {error && <ErrorNote error={error} onRetry={reload} />}
      {data?.failed.length > 0 && <ErrorNote error={`Could not load deadlines for ${data.failed.join(', ')}. Other courses are shown.`} onRetry={reload} />}

      {data && <>
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Deadline summary">
          {[
            ['Assignments', all.length],
            ['Coming up', all.filter((a) => assignmentStatus(a, role) === 'upcoming').length],
            [role === 'student' ? 'Overdue' : 'Past due', all.filter((a) => ['overdue', 'past'].includes(assignmentStatus(a, role))).length],
          ].map(([label, count]) => <div key={label} className="card p-4"><p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p><p className="mt-1 font-display text-3xl font-semibold text-brand-ink">{count}</p></div>)}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[190px] flex-1 sm:flex-none">
            <label className="label" htmlFor="calendar-course">Course</label>
            <select id="calendar-course" className="input" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="all">All courses</option>
              {data.courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
            </select>
          </div>
          <div className="min-w-[175px] flex-1 sm:flex-none">
            <label className="label" htmlFor="calendar-status">Status</label>
            <select id="calendar-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => { setCourseFilter('all'); setStatusFilter('all'); }} className="btn-ghost">Clear filters</button>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(270px,340px)]">
          <section className="card min-w-0 overflow-hidden" aria-labelledby="month-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line p-4 sm:p-5">
              <h2 id="month-heading" className="font-display text-xl font-semibold text-brand-ink">{monthLabel}</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => changeMonth(-1)} className="btn-ghost !px-3" aria-label="Previous month"><ChevronLeft size={19} /></button>
                <button type="button" onClick={goToday} className="btn-ghost">Today</button>
                <button type="button" onClick={() => changeMonth(1)} className="btn-ghost !px-3" aria-label="Next month"><ChevronRight size={19} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-brand-line" role="group" aria-label={`${monthLabel} dates`}>
              {weekdays.map((day) => <div key={day} className="bg-brand-paper py-2 text-center text-[10px] font-bold uppercase tracking-wide text-brand-muted sm:text-xs">{day}</div>)}
              {cells.map((date) => {
                const key = dateKey(date);
                const entries = dayMap.get(key) || [];
                const isCurrentMonth = date.getMonth() === month.getMonth();
                const active = key === selectedDay;
                return <button key={key} type="button" onClick={() => selectDay(date)} aria-pressed={active}
                  aria-label={`${formatDate(date)}: ${entries.length} assignment${entries.length === 1 ? '' : 's'} due`}
                  className={`relative flex min-h-[64px] min-w-0 flex-col items-center gap-1 overflow-hidden bg-white p-1 text-left transition hover:bg-brand-mint/35 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-forest sm:min-h-[104px] sm:items-stretch sm:p-2 ${!isCurrentMonth ? 'bg-brand-paper/80 text-brand-muted' : ''} ${active ? '!bg-brand-mint/60 ring-2 ring-inset ring-brand-forest' : ''}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm ${key === today ? 'bg-brand-forest text-white' : 'text-brand-ink'}`}>{date.getDate()}</span>
                  {entries.length > 0 && <>
                    <span className="rounded-full bg-brand-forest px-1.5 py-0.5 text-[10px] font-bold text-white sm:hidden">{entries.length}</span>
                    <span className="hidden truncate rounded-md bg-brand-mint/75 px-1.5 py-1 text-[11px] font-semibold text-brand-forest sm:block">{entries[0].title}</span>
                    {entries.length > 1 && <span className="hidden text-[10px] text-brand-muted sm:block">+{entries.length - 1} more</span>}
                  </>}
                </button>;
              })}
            </div>
            <div className="p-4 sm:p-5" aria-live="polite">
              <h3 className="mb-3 font-display text-lg font-semibold text-brand-ink">{selectedLabel}</h3>
              {selected.length === 0 ? <Empty>No assignments due on this day with your current filters.</Empty> : <ul className="grid gap-2">{selected.map((a) => <DeadlineItem key={`${a.course_id}-${a.id}`} assignment={a} role={role} />)}</ul>}
            </div>
          </section>

          <aside className="card p-4 sm:p-5" aria-labelledby="next-deadlines-heading">
            <h2 id="next-deadlines-heading" className="flex items-center gap-2 font-display text-xl font-semibold"><Clock3 size={19} className="text-brand-forest" aria-hidden="true" /> Next deadlines</h2>
            <p className="mb-4 mt-1 text-xs text-brand-muted">Based on your selected course and status filters.</p>
            {next.length === 0 ? <Empty>No upcoming deadlines match your filters.</Empty> : <ul className="space-y-2">{next.map((a) => <DeadlineItem key={`${a.course_id}-${a.id}`} assignment={a} role={role} />)}</ul>}
            {data.courses.length === 0 && <p className="mt-4 text-xs text-brand-muted">No courses are available for this account.</p>}
          </aside>
        </div>
      </>}
    </div>
  );
}
