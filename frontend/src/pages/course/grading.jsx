// Small pieces shared by the lecturer's submissions overview and the grading screen.

export function gradingStatus(submission) {
  if (submission.mark === null || submission.mark === undefined) return 'todo';
  return submission.released ? 'released' : 'held';
}

const statusBadges = {
  todo: ['Needs marking', 'bg-blue-100 text-blue-700'],
  held: ['Marked, not released', 'bg-slate-100 text-slate-700'],
  released: ['Released', 'bg-emerald-100 text-emerald-700'],
};

export function StatusBadge({ submission }) {
  const [label, tone] = statusBadges[gradingStatus(submission)];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function LateBadge({ submission }) {
  if (!submission.late) return null;
  const days = submission.days_late;
  const label = days > 0 ? `Late by ${days} day${days === 1 ? '' : 's'}` : 'Late';
  return <span className="badge bg-amber-100 text-amber-700">{label}</span>;
}

// The mark the student actually gets, after any late penalty.
export function markText(submission, maxMark) {
  if (submission.mark === null || submission.mark === undefined) return '–';
  const final = submission.final_mark ?? submission.mark;
  return `${final}/${maxMark}`;
}
