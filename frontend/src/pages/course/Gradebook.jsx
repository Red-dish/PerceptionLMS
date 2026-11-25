import { useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Empty, ErrorNote, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';

function GradebookTable({ course }) {
  const base = '/courses/' + course.id;
  const { data, error, loading, reload } = useLoad(() => api.get(base + '/gradebook'), [base]);
  const [editing, setEditing] = useState(null);
  const [mark, setMark] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function edit(row, column, cell) {
    setEditing({ studentId: row.student_id, assignmentId: column.id });
    setMark(cell.mark ?? '');
    setSaveError(null);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    const assignment = base + '/assignments/' + editing.assignmentId;
    try {
      const submissions = await api.get(assignment + '/submissions');
      const current = submissions.find((entry) => entry.student_id === editing.studentId);
      if (current?.rubric_assessment) {
        throw new Error('This mark uses a rubric. Update it in the assignment marking screen.');
      }
      await api.put(assignment + '/submissions/' + editing.studentId + '/grade', {
        mark: Number(mark),
        feedback: current?.feedback ?? '',
        release: current?.released ?? false,
      });
      await reload();
      setEditing(null);
    } catch (failure) {
      setSaveError(failure);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Gradebook" subtitle="Review assignment and quiz marks for this course." />
      {error && <ErrorNote error={error} onRetry={reload} />}
      {saveError && <ErrorNote error={saveError} />}
      {loading && <Loading />}
      {data && (data.rows.length === 0 || data.columns.length === 0
        ? <Empty>The gradebook needs enrolled students and coursework.</Empty>
        : (
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{course.code} gradebook</caption>
              <thead className="bg-slate-100">
                <tr>
                  <th scope="col" className="p-3">Student</th>
                  {data.columns.map((column) => (
                    <th key={column.id} scope="col" className="min-w-36 p-3">
                      {column.title}
                      <span className="block text-xs font-normal">{column.kind === 'quiz' ? 'Quiz' : 'Assignment'} · /{column.max_mark}</span>
                    </th>
                  ))}
                  <th scope="col" className="p-3">Points</th>
                  <th scope="col" className="p-3">Percent</th>
                  <th scope="col" className="p-3">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.student_id} className="border-t border-slate-200 align-top">
                    <th scope="row" className="p-3">{row.name}<span className="block text-xs font-normal">{row.email}</span></th>
                    {data.columns.map((column) => {
                      const cell = row.cells[column.id];
                      const label = row.name + ' — ' + column.title;
                      const isEditing = editing?.studentId === row.student_id && editing.assignmentId === column.id;
                      return (
                        <td className="p-3" key={column.id}>
                          {isEditing ? (
                            <form onSubmit={save} className="space-y-1">
                              <input className="input w-24" aria-label={'Mark for ' + label} type="number" min="0" max={column.max_mark} step="1" required value={mark} disabled={saving} onChange={(event) => setMark(event.target.value)} />
                              <div className="flex gap-2">
                                <button className="link" disabled={saving}>Save</button>
                                <button className="link" type="button" disabled={saving} onClick={() => { setEditing(null); setSaveError(null); }}>Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <button className="link" type="button" aria-label={'Edit mark for ' + label} disabled={saving} onClick={() => edit(row, column, cell)}>
                              {cell.final_mark ?? 'Add mark'}
                            </button>
                          )}
                          {cell.late && <span className="block text-amber-800">Late</span>}
                          {cell.status === 'missing' && <span className="block text-red-700">Missing</span>}
                        </td>
                      );
                    })}
                    <td className="p-3 whitespace-nowrap">{row.points_earned} / {row.points_possible}</td>
                    <td className="p-3">{row.percent == null ? '—' : row.percent + '%'}</td>
                    <td className="p-3">{row.weighted_percent == null ? '—' : row.weighted_percent + '%'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

export default function Gradebook() {
  const { course, canEdit } = useOutletContext();
  return canEdit ? <GradebookTable key={course.id} course={course} /> : <Navigate to=".." replace />;
}
