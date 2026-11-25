import { ArrowUpRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { roleLabels } from '../lib/format';

export default function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.id}`} className="card group block overflow-hidden p-5 transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="badge bg-brand-mint text-brand-forest">{course.code || 'Course'}</span>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint/60 text-brand-forest"><BookOpen size={19} aria-hidden="true" /></span>
      </div>
      <h3 className="font-display text-xl font-semibold leading-snug text-brand-ink group-hover:text-brand-forest">{course.title}</h3>
      <p className="mt-2 text-sm text-brand-muted">{course.term || 'Course'} · {roleLabels[course.my_role] || 'Member'}</p>
      <span className="mt-6 flex items-center justify-between border-t border-brand-line pt-4 text-sm font-bold text-brand-forest">Open course <ArrowUpRight size={18} aria-hidden="true" /></span>
    </Link>
  );
}
