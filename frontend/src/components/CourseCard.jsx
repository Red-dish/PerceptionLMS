import { Link } from 'react-router-dom';
import { roleLabels } from '../lib/format';

export default function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.id}`} className="card overflow-hidden hover:shadow-md transition group block">
      <div className="h-20 p-4 bg-gradient-to-br from-blue-600 to-indigo-700">
        <span className="badge bg-white/25 text-white">{course.term}</span>
      </div>
      <div className="p-4">
        <div className="text-xs font-semibold text-blue-700">{course.code}</div>
        <div className="font-semibold text-slate-900 group-hover:underline">{course.title}</div>
        <div className="text-sm text-slate-500 mt-1">{roleLabels[course.my_role]}</div>
      </div>
    </Link>
  );
}
