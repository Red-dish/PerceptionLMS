import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, isPast } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import AssignmentForm from './AssignmentForm';

export function submissionBadge(assignment) {
  const submission = assignment.my_submission;
  if (submission?.released) {
    return { text: `${submission.mark}/${assignment.max_mark}`, tone: 'bg-emerald-100 text-emerald-700' };
  }
  if (submission?.late) return { text: 'Submitted late', tone: 'bg-amber-100 text-amber-700' };
  if (submission) return { text: 'Submitted', tone: 'bg-blue-100 text-blue-700' };
  if (isPast(assignment.due_at)) return { text: 'Missing', tone: 'bg-red-100 text-red-700' };
  return { text: 'To do', tone: 'bg-slate-200 text-slate-700' };
}

export default function Assignments() {
  const { course, myRole, canEdit } = useOutletContext();
  const [creating, setCreating] = useState(false);
  const path = `/courses/${course.id}/assignments`;
  const { data: assignments, error, loading, reload } = useLoad(() => api.get(path), [path]);

  return (
    <div>
      <PageHeader title="Assignments">
        {canEdit && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Assignment
          </button>
        )}
      </PageHeader>

      {loading && !assignments && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {assignments?.length === 0 && <Empty>No assignments yet.</Empty>}

      {assignments?.length > 0 && (
        <ul className="card divide-y divide-slate-100">
          {assignments.map((assignment) => {
            const badge = myRole === 'student' ? submissionBadge(assignment) : null;
            return (
              <li key={assignment.id}>
                <Link to={`${path}/${assignment.id}`} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0">
                    <ClipboardList size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{assignment.title}</div>
                    <div className="text-xs text-slate-500">
                      Due {formatDateTime(assignment.due_at)} · {assignment.max_mark} marks · worth {assignment.weight}%
                    </div>
                  </div>
                  {badge && <span className={`badge shrink-0 ${badge.tone}`}>{badge.text}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <AssignmentForm
          courseId={course.id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
