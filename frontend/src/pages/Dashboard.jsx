import { Link } from 'react-router-dom';
import { BookOpen, Clock, GraduationCap, Megaphone, ShieldCheck, Users } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import { Empty, ErrorNote, Loading, PageHeader, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const subtitles = {
  student: 'Here is what is coming up in your courses.',
  lecturer: 'Here is what is coming up in the courses you teach.',
  admin: 'Here is an overview of the college.',
};

function firstName(name) {
  return name.split(' ')[0];
}

function Upcoming({ assignments, courseCode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <Clock size={16} aria-hidden="true" />
        Coming up
      </h2>
      {assignments.length === 0 && <Empty>Nothing is due.</Empty>}
      {assignments.map((assignment) => (
        <Link
          key={assignment.id}
          to={`/courses/${assignment.course_id}/assignments/${assignment.id}`}
          className="block py-2 border-b last:border-0 border-slate-100 hover:bg-slate-50"
        >
          <div className="text-sm font-medium">{assignment.title}</div>
          <div className="text-xs text-slate-500">
            {courseCode(assignment.course_id)} · due {formatDateTime(assignment.due_at)}
          </div>
        </Link>
      ))}
    </section>
  );
}

function Announcements({ announcements, courseCode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <Megaphone size={16} aria-hidden="true" />
        Announcements
      </h2>
      {announcements.length === 0 && <Empty>No announcements yet.</Empty>}
      {announcements.map((announcement) => (
        <Link
          key={announcement.id}
          to={`/courses/${announcement.course_id}`}
          className="block py-2 border-b last:border-0 border-slate-100 hover:bg-slate-50"
        >
          <div className="text-sm font-medium">{announcement.title}</div>
          <div className="text-xs text-slate-500">
            {courseCode(announcement.course_id)} · {formatDate(announcement.created_at)}
          </div>
        </Link>
      ))}
    </section>
  );
}

function RoleStats({ role, dashboard, people }) {
  if (role === 'admin') {
    const count = (wanted) => people.filter((person) => person.role === wanted).length;
    return (
      <>
        <Stat icon={BookOpen} label="Courses" value={dashboard.courses.length} />
        <Stat icon={GraduationCap} label="Students" value={count('student')} tone="violet" />
        <Stat icon={Users} label="Lecturers" value={count('lecturer')} tone="green" />
        <Stat icon={ShieldCheck} label="Admins" value={count('admin')} tone="amber" />
      </>
    );
  }
  return (
    <>
      <Stat icon={BookOpen} label={role === 'student' ? 'Enrolled courses' : 'Courses you teach'} value={dashboard.courses.length} />
      <Stat icon={Clock} label="Assignments due" value={dashboard.upcoming.length} tone="amber" />
      <Stat icon={Megaphone} label="Recent announcements" value={dashboard.announcements.length} tone="violet" />
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const [dashboard, people] = await Promise.all([
      api.get('/me/dashboard'),
      user.role === 'admin' ? api.get('/admin/users') : null,
    ]);
    return { dashboard, people };
  }, [user.role]);

  const header = <PageHeader title={`Good day, ${firstName(user.name)}`} subtitle={subtitles[user.role]} />;

  if (loading && !data) return <>{header}<Loading /></>;
  if (error && !data) return <>{header}<ErrorNote error={error} onRetry={reload} /></>;

  const { dashboard, people } = data;
  const courseCode = (id) => dashboard.courses.find((course) => course.id === id)?.code ?? 'Course';

  return (
    <div>
      {header}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <RoleStats role={user.role} dashboard={dashboard} people={people} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Courses</h2>
          {dashboard.courses.length === 0 && (
            <Empty>
              {user.role === 'admin'
                ? <>No courses yet. <Link to="/courses" className="link">Create the first one</Link>.</>
                : 'You are not enrolled in any courses yet. Ask an administrator to add you.'}
            </Empty>
          )}
          <div className="grid sm:grid-cols-2 gap-5">
            {dashboard.courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
        <div className="space-y-5">
          <Upcoming assignments={dashboard.upcoming} courseCode={courseCode} />
          <Announcements announcements={dashboard.announcements} courseCode={courseCode} />
        </div>
      </div>
    </div>
  );
}
