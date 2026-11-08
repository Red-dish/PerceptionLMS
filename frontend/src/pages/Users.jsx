import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ErrorNote, Loading, Modal, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { roleLabels } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const emptyUser = { email: '', name: '', role: 'student' };

function RoleSelect({ id, value, onChange, disabled, label }) {
  return (
    <select id={id} aria-label={label} className="input" value={value} onChange={onChange} disabled={disabled}>
      {Object.entries(roleLabels).map(([role, text]) => <option key={role} value={role}>{text}</option>)}
    </select>
  );
}

function AddUser({ open, onClose, onAdded }) {
  const [form, setForm] = useState(emptyUser);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      setForm(emptyUser);
      onAdded();
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a person">
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="user-name">Name</label>
          <input id="user-name" required maxLength={120} className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="user-email">Google account email</label>
          <input id="user-email" type="email" required className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="user-role">Role</label>
          <RoleSelect id="user-role" value={form.role} onChange={set('role')} />
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Adding…' : 'Add person'}</button>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { data: users, error, loading, reload } = useLoad(() => api.get('/admin/users'), []);

  const update = async (user, changes) => {
    setSaveError(null);
    try {
      await api.patch(`/admin/users/${user.id}`, changes);
    } catch (problem) {
      setSaveError(problem);
    }
    reload();
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Only people added here can sign in.">
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden="true" />
          Add person
        </button>
      </PageHeader>

      {loading && !users && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      <div className="mb-3"><ErrorNote error={saveError} /></div>

      {users && (
        <ul className="card divide-y divide-slate-100">
          {users.map((user) => (
            <li key={user.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">
                  {user.name}
                  {!user.active && <span className="badge bg-slate-200 text-slate-700 ml-2">Deactivated</span>}
                </div>
                <div className="text-sm text-slate-500 break-all">{user.email}</div>
              </div>
              <div className="w-32">
                <RoleSelect
                  label={`Role for ${user.name}`}
                  value={user.role}
                  disabled={user.id === me.id}
                  onChange={(event) => update(user, { role: event.target.value })}
                />
              </div>
              <button
                type="button"
                className={user.active ? 'btn-danger' : 'btn-ghost'}
                disabled={user.id === me.id}
                onClick={() => update(user, { active: !user.active })}
              >
                {user.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddUser
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          reload();
        }}
      />
    </div>
  );
}
