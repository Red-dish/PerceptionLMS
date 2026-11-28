import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CalendarDays, Clock, GraduationCap, Megaphone, ShieldCheck, Users } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import { Empty, ErrorNote, Loading, PageHeader, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const subtitles = {
  student: 'Your courses, deadlines and announcements in one place.',
  lecturer: 'An overview of the courses you teach and what needs attention.',
  admin: 'A view of the college and its active learning spaces.',
};

function Upcoming({ assignments, courseCode }) {
  return <section className="card p-5 sm:p-6" aria-labelledby="upcoming-title">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="upcoming-title" className="flex items-center gap-2 font-display text-xl font-semibold"><Clock size={19} className="text-brand-forest" aria-hidden="true" /> Coming up</h2><Link to="/calendar" className="link inline-flex items-center gap-1 text-sm font-semibold"><CalendarDays size={15} aria-hidden="true" /> View calendar</Link></div>
    {assignments.length === 0 && <Empty>Nothing is due.</Empty>}
    <div className="divide-y divide-brand-line">{assignments.map((a) => (
      <Link key={`${a.course_id}-${a.id}`} to={`/courses/${a.course_id}/assignments/${a.id}`} className="block rounded-lg py-3 hover:bg-brand-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-forest">
        <p className="text-sm font-semibold text-brand-ink">{a.title}</p>
        <p className="mt-1 text-xs text-brand-muted">{courseCode(a.course_id)} · Due {formatDateTime(a.due_at)}</p>
      </Link>
    ))}</div>
  </section>;
}

function Announcements({ announcements, courseCode }) {
  return <section className="card p-5 sm:p-6" aria-labelledby="announcements-title">
    <h2 id="announcements-title" className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><Megaphone size={19} className="text-brand-forest" aria-hidden="true" /> Announcements</h2>
    {announcements.length === 0 && <Empty>No announcements yet.</Empty>}
    <div className="divide-y divide-brand-line">{announcements.map((a) => (
      <Link key={`${a.course_id}-${a.id}`} to={`/courses/${a.course_id}`} className="block rounded-lg py-3 hover:bg-brand-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-forest">
        <p className="text-sm font-semibold text-brand-ink">{a.title}</p>
        <p className="mt-1 text-xs text-brand-muted">{courseCode(a.course_id)} · {formatDate(a.created_at)}</p>
      </Link>
    ))}</div>
  </section>;
}

function RoleStats({ role, dashboard, people }) {
  if (role === 'admin') {
    const count = (wanted) => (people || []).filter((p) => p.role === wanted).length;
    return <>
      <Stat icon={BookOpen} label="Courses" value={dashboard.courses.length} />
      <Stat icon={GraduationCap} label="Students" value={count('student')} tone="violet" />
      <Stat icon={Users} label="Lecturers" value={count('lecturer')} tone="green" />
      <Stat icon={ShieldCheck} label="Admins" value={count('admin')} tone="amber" />
    </>;
  }
  return <>
    <Stat icon={BookOpen} label={role === 'student' ? 'Enrolled courses' : 'Courses you teach'} value={dashboard.courses.length} />
    <Stat icon={Clock} label="Assignments due" value={dashboard.upcoming.length} tone="amber" />
    <Stat icon={Megaphone} label="Recent announcements" value={dashboard.announcements.length} tone="violet" />
  </>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const [dashboard, people] = await Promise.all([
      api.get('/me/dashboard'),
      user.role === 'admin' ? api.get('/admin/users') : Promise.resolve(null),
    ]);
    return { dashboard, people };
  }, [user.role]);
  const header = <div className="mb-8"><p className="eyebrow mb-2">Your workspace</p><PageHeader title={`Welcome, ${(user.name || 'there').split(' ')[0]}`} subtitle={subtitles[user.role]} /></div>;
  if (loading && !data) return <>{header}<Loading /></>;
  if (error && !data) return <>{header}<ErrorNote error={error} onRetry={reload} /></>;
  const { dashboard, people } = data;
  const courseCode = (id) => dashboard.courses.find((c) => c.id === id)?.code ?? 'Course';
  return <div>
    {header}
    {error && <div className="mb-5"><ErrorNote error={error} onRetry={reload} /></div>}
    <div className="mb-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><RoleStats role={user.role} dashboard={dashboard} people={people} /></div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section aria-labelledby="courses-heading">
        <div className="mb-4 flex items-center justify-between gap-2"><h2 id="courses-heading" className="font-display text-2xl font-semibold text-brand-ink">{user.role === 'student' ? 'My courses' : user.role === 'lecturer' ? 'Courses I teach' : 'Courses'}</h2><Link to="/courses" className="link inline-flex items-center gap-1 text-sm font-semibold">View all <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        {dashboard.courses.length === 0 && <div className="card p-6"><Empty>{user.role === 'admin' ? <>No courses yet. <Link to="/courses" className="link">Create the first one</Link>.</> : 'You are not enrolled in any courses yet. Ask an administrator to add you.'}</Empty></div>}
        <div className="grid gap-4 sm:grid-cols-2">{dashboard.courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>
      </section>
      <div className="space-y-5"><Upcoming assignments={dashboard.upcoming} courseCode={courseCode} /><Announcements announcements={dashboard.announcements} courseCode={courseCode} /></div>
    </div>
  </div>;
}
