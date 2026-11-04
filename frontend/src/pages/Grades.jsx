import { Link } from 'react-router-dom';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useLoad } from '../lib/useLoad';

// Students only get marks here once the lecturer has released them.
export default function Grades() {
  const { data: grades, error, loading, reload } = useLoad(() => api.get('/me/grades'), []);

  const courses = new Map();
  grades?.forEach((grade) => {
    if (!courses.has(grade.course_id)) courses.set(grade.course_id, { code: grade.course_code, grades: [] });
    courses.get(grade.course_id).grades.push(grade);
  });

  return (
    <div>
      <PageHeader title="Grades" subtitle="Your marks, once your lecturers release them." />
      {loading && !grades && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {grades?.length === 0 && <Empty>No marks have been released yet.</Empty>}

      <div className="space-y-5">
        {[...courses].map(([courseId, course]) => (
          <section key={courseId} className="card overflow-hidden">
            <h2 className="bg-slate-100 px-4 py-3 font-semibold">{course.code}</h2>
            <ul className="divide-y divide-slate-100">
              {course.grades.map((grade) => (
                <li key={grade.assignment_id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link to={`/courses/${courseId}/assignments/${grade.assignment_id}`} className="font-medium link">
                      {grade.assignment_title}
                    </Link>
                    <div className="text-xs text-slate-500">Worth {grade.weight}% of the final grade</div>
                    {grade.feedback && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{grade.feedback}</p>}
                  </div>
                  <span className="badge bg-emerald-100 text-emerald-700 shrink-0">{grade.mark}/{grade.max_mark}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
