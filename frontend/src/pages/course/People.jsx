import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Empty, ErrorNote, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { roleLabels } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';

// Enrolments are admin-only in the API, and so is this page.
export default function People() {
  const { course } = useOutletContext();
  const path = `/admin/courses/${course.id}/members`;
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('student');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [members, users] = await Promise.all([api.get(path), api.get('/admin/users')]);
    return { members, users };
  }, [path]);

  const act = async (action) => {
    setSaveError(null);
    setSaving(true);
    try {
      await action();
      await reload();
    } catch (problem) {
      setSaveError(problem);
    } finally {
      setSaving(false);
    }
  };

  const enrol = (event) => {
    event.preventDefault();
    act(async () => {
      await api.put(`${path}/${userId}`, { role });
      setUserId('');
    });
  };

  const remove = (member) => {
    if (!window.confirm(`Remove ${member.name} from this course?`)) return;
    act(() => api.del(`${path}/${member.user_id}`));
  };

  const enrolled = new Set(data?.members.map((member) => member.user_id));
  const available = data?.users.filter((user) => user.active && user.role !== 'admin' && !enrolled.has(user.id)) ?? [];

  return (
    <div>
      <PageHeader title="People" subtitle="Enrol lecturers and students in this course." />
      {loading && !data && <Loading />}
      <ErrorNote error={error} onRetry={reload} />

      {data && (
        <div className="space-y-5">
          <form className="card p-4 grid sm:grid-cols-[1fr_140px_auto] gap-3 items-end" onSubmit={enrol}>
            <div>
              <label className="label" htmlFor="enrol-user">Person</label>
              <select id="enrol-user" required className="input" value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Choose someone</option>
                {available.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="enrol-role">Course role</label>
              <select id="enrol-role" className="input" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="student">{roleLabels.student}</option>
                <option value="lecturer">{roleLabels.lecturer}</option>
              </select>
            </div>
            <button className="btn-primary" disabled={saving}>Enrol</button>
          </form>
          <ErrorNote error={saveError} />

          {data.members.length === 0 && <Empty>Nobody is enrolled yet.</Empty>}
          {data.members.length > 0 && (
            <ul className="card divide-y divide-slate-100">
              {data.members.map((member) => (
                <li key={member.user_id} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-slate-500 break-all">{member.email}</div>
                  </div>
                  <span className="badge bg-slate-200 text-slate-700">{roleLabels[member.role]}</span>
                  <button type="button" className="btn-danger" disabled={saving} onClick={() => remove(member)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
