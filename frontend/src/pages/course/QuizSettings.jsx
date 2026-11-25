import { useState } from 'react';
import { ErrorNote } from '../../components/ui';
import { api } from '../../lib/api';
import { fromLocalInput, toLocalInput } from '../../lib/format';

const numbers = [
  { name: 'weight', label: 'Weight (%)', min: 0, max: 100, required: true },
  { name: 'time_limit_minutes', label: 'Time limit (minutes)', min: 1, max: 600 },
  { name: 'max_attempts', label: 'Attempt limit', min: 1, max: 50 },
];
const dates = [
  { name: 'due_at', label: 'Due date', required: true },
  { name: 'available_from', label: 'Opens' },
  { name: 'available_until', label: 'Closes' },
];
const toggles = [
  ['published', 'Published'],
  ['shuffle_answers', 'Shuffle answer options'],
  ['show_score', 'Show score after submission'],
  ['show_correct_answers', 'Show correct answers after submission when scores are visible'],
];

export default function QuizSettings({ assignmentsPath, quiz, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: quiz?.title ?? '',
    instructions: quiz?.instructions ?? '',
    weight: quiz?.weight ?? 0,
    time_limit_minutes: quiz?.time_limit_minutes ?? '',
    max_attempts: quiz?.max_attempts ?? '',
    ...Object.fromEntries(dates.map(({ name }) => [name, quiz?.[name] ? toLocalInput(quiz[name]) : ''])),
    published: quiz?.published ?? false,
    shuffle_answers: quiz?.shuffle_answers ?? false,
    show_score: quiz?.show_score ?? true,
    show_correct_answers: quiz?.show_correct_answers ?? false,
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (name, value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [name]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError('Enter a quiz title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        title,
        ...Object.fromEntries(numbers.map(({ name }) => [name, form[name] === '' ? null : Number(form[name])])),
        ...Object.fromEntries(dates.map(({ name }) => [name, form[name] ? fromLocalInput(form[name]) : null])),
      };
      const result = quiz
        ? await api.patch(`${assignmentsPath}/${quiz.id}`, body)
        : await api.post(assignmentsPath, { ...body, kind: 'quiz', submission_type: 'none' });
      setSaved(true);
      onSaved(result);
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset className="space-y-4 min-w-0" disabled={busy}>
        <legend className="font-semibold mb-4">{quiz ? 'Quiz settings' : 'Quiz details'}</legend>
        <label className="block">
          <span className="label">Title</span>
          <input className="input border-slate-500" required maxLength={200} value={form.title} onChange={(event) => update('title', event.target.value)} />
        </label>
        <label className="block">
          <span className="label">Instructions</span>
          <textarea className="input border-slate-500" rows={3} maxLength={10000} value={form.instructions} onChange={(event) => update('instructions', event.target.value)} />
        </label>
        {dates.map(({ name, label, required }) => (
          <label key={name} className="block">
            <span className="label">{label}</span>
            <input className="input border-slate-500 min-w-0" type="datetime-local" required={required} value={form[name]} onChange={(event) => update(name, event.target.value)} />
          </label>
        ))}
        {numbers.map(({ name, label, min, max, required }) => (
          <label key={name} className="block">
            <span className="label">{label}</span>
            <input className="input border-slate-500" type="number" min={min} max={max} required={required} value={form[name]} onChange={(event) => update(name, event.target.value)} />
          </label>
        ))}
        <p className="text-sm text-slate-500">Leave time and attempt limits blank for unlimited.</p>
        {toggles.map(([name, label]) => (
          <label key={name} className="flex items-start gap-2 text-sm">
            <input className="mt-1" type="checkbox" checked={form[name]} onChange={(event) => update(name, event.target.checked)} />
            {label}
          </label>
        ))}
        <ErrorNote error={error} />
        <button className="btn-primary" type="submit">
          {busy ? 'Saving…' : quiz ? 'Save settings' : 'Create quiz'}
        </button>
        {saved && <p role="status" className="text-sm text-emerald-700">Settings saved.</p>}
      </fieldset>
    </form>
  );
}
