// Date and status helpers kept separate so the calendar can be tested with Node.
// All visible dates use the viewer's local timezone, matching the existing UI.
export function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthCells(year, month) {
  const mondayOffset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const count = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - mondayOffset + i, 12));
}

// Never mistake a lecturer's past assignment for a missing submission.
// A quiz attempt isn't reliably represented by my_submission either.
export function assignmentStatus(assignment, role, now = new Date()) {
  const due = new Date(assignment.due_at);
  if (Number.isNaN(due.getTime())) return 'unknown';
  if (role === 'student' && assignment.kind !== 'quiz' && assignment.my_submission) return 'submitted';
  if (due >= now) return 'upcoming';
  return role === 'student' && assignment.kind !== 'quiz' ? 'overdue' : 'past';
}

export function sortByDue(items) {
  return [...items].sort((a, b) => {
    const diff = new Date(a.due_at) - new Date(b.due_at);
    return diff || String(a.title).localeCompare(String(b.title));
  });
}
