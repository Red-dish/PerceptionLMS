import { useState } from 'react';
import { ErrorNote, Modal } from '../../components/ui';
import { api } from '../../lib/api';
import { fromLocalInput, toLocalInput } from '../../lib/format';

function startingValues(assignment) {
  return {
    title: assignment?.title ?? '',
    instructions: assignment?.instructions ?? '',
    due_at: assignment ? toLocalInput(assignment.due_at) : '',
    weight: assignment?.weight ?? 0,
    max_mark: assignment?.max_mark ?? 100,
  };
}

// Creates an assignment, or edits one when "assignment" is passed in.
// Mount it only while it is open, so it starts from fresh values each time.
export default function AssignmentForm({ courseId, assignment, onClose, onSaved }) {
  const [form, setForm] = useState(() => startingValues(assignment));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const path = `/courses/${courseId}/assignments`;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const body = {
      ...form,
      due_at: fromLocalInput(form.due_at),
      weight: Number(form.weight),
      max_mark: Number(form.max_mark),
    };
    try {
      if (assignment) await api.patch(`${path}/${assignment.id}`, body);
      else await api.post(path, body);
      onSaved();
    } catch (problem) {
      setError(problem);
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={assignment ? 'Edit assignment' : 'New assignment'}>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="assignment-title">Title</label>
          <input id="assignment-title" required maxLength={200} className="input" value={form.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label" htmlFor="assignment-instructions">Instructions</label>
          <textarea id="assignment-instructions" rows={4} maxLength={10000} className="input" value={form.instructions} onChange={set('instructions')} />
        </div>
        <div>
          <label className="label" htmlFor="assignment-due">Due</label>
          <input id="assignment-due" type="datetime-local" required className="input" value={form.due_at} onChange={set('due_at')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="assignment-weight">Weight (%)</label>
            <input id="assignment-weight" type="number" min={0} max={100} required className="input" value={form.weight} onChange={set('weight')} />
          </div>
          <div>
            <label className="label" htmlFor="assignment-max">Maximum mark</label>
            <input id="assignment-max" type="number" min={1} max={1000} required className="input" value={form.max_mark} onChange={set('max_mark')} />
          </div>
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save assignment'}</button>
      </form>
    </Modal>
  );
}
