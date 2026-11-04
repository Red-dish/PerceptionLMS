import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ErrorNote, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';

function tabs(myRole) {
  return [
    ['', 'Home'],
    ['modules', 'Modules'],
    ['assignments', 'Assignments'],
    // The API only lets admins read a course's member list.
    ...(myRole === 'admin' ? [['people', 'People']] : []),
  ];
}

export default function CourseLayout() {
  const { courseId } = useParams();
  const { data, error, loading, reload } = useLoad(() => api.get(`/courses/${courseId}`), [courseId]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <div className="space-y-3">
        <ErrorNote error={error} onRetry={error.status === 404 ? undefined : reload} />
        <Link to="/courses" className="link text-sm">Back to courses</Link>
      </div>
    );
  }

  const { course, my_role: myRole, modules } = data;
  const canEdit = myRole !== 'student';
  const base = `/courses/${courseId}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm mb-5">
        <Link to="/courses" className="link">Courses</Link>
        <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />
        <span className="font-medium text-blue-700">{course.code}</span>
        <span className="text-slate-500">{course.title}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <nav aria-label="Course" className="flex md:flex-col gap-1 overflow-x-auto md:w-44 shrink-0">
          {tabs(myRole).map(([path, label]) => (
            <NavLink
              key={label}
              to={path ? `${base}/${path}` : base}
              end={!path}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-2 text-sm rounded-md md:border-l-2 ${
                  isActive
                    ? 'bg-slate-200 md:bg-transparent md:border-slate-900 font-semibold text-slate-900'
                    : 'border-transparent text-blue-700 hover:bg-slate-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          <Outlet context={{ course, myRole, modules, canEdit, reload }} />
        </div>
      </div>
    </div>
  );
}
