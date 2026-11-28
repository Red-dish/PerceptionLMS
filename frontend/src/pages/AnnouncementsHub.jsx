import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { useCourseItems } from '../lib/useCourseItems';

export default function AnnouncementsHub() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useCourseItems('announcements');
  const [course, setCourse] = useState('all');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [draft, setDraft] = useState({ course_id: '', title: '', body: '', pinned: false, publish_at: '' });
  const staffCourses = data?.courses.filter((item) => item.my_role !== 'student') || [];
  const items = useMemo(() => (data?.items || []).filter((item) => course === 'all' || item.course_id === course).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.publish_at || b.created_at) - new Date(a.publish_at || a.created_at)), [data, course]);

  async function publish(event) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.post(`/courses/${draft.course_id}/announcements`, {
        title: draft.title.trim(), body: draft.body.trim(), pinned: draft.pinned,
        publish_at: draft.publish_at ? new Date(draft.publish_at).toISOString() : null,
      });
      setEditing(false);
      setDraft({ course_id: '', title: '', body: '', pinned: false, publish_at: '' });
      await reload();
    } catch (problem) {
      setFormError(problem);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete announcement “${item.title}”?`)) return;
    setFormError(null);
    try {
      await api.del(`/courses/${item.course_id}/announcements/${item.id}`);
      await reload();
    } catch (problem) {
      setFormError(problem);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Announcements" subtitle="Notices and updates across your courses.">
        {user.role !== 'student' && staffCourses.length > 0 && <button type="button" className="btn-primary" onClick={() => { setDraft((old) => ({ ...old, course_id: staffCourses[0].id })); setEditing(!editing); }}><Plus size={17} aria-hidden="true" /> New announcement</button>}
      </PageHeader>
      <ErrorNote error={error} onRetry={reload} />
      <ErrorNote error={formError} />
      {loading && !data && <Loading label="Loading announcements…" />}
      {editing && <form onSubmit={publish} className="card p-5 space-y-3" aria-label="Create announcement">
        <h2 className="font-display text-xl font-semibold">Publish an announcement</h2>
        <label className="label" htmlFor="announcement-course">Course</label>
        <select required id="announcement-course" className="input" value={draft.course_id} onChange={(event) => setDraft({ ...draft, course_id: event.target.value })}>{staffCourses.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select>
        <label className="label" htmlFor="announcement-title">Title</label>
        <input required maxLength={200} id="announcement-title" className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <label className="label" htmlFor="announcement-body">Message</label>
        <textarea required rows={5} maxLength={10000} id="announcement-body" className="input" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        <label className="label" htmlFor="announcement-time">Schedule publication (optional, local time)</label>
        <input type="datetime-local" id="announcement-time" className="input" value={draft.publish_at} onChange={(event) => setDraft({ ...draft, publish_at: event.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} /> Pin to top</label>
        <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={saving || !draft.course_id || !draft.title.trim() || !draft.body.trim()}>{saving ? 'Saving…' : draft.publish_at ? 'Schedule announcement' : 'Publish announcement'}</button><button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button></div>
      </form>}
      {data && <>
        {data.unavailable.length > 0 && <p role="alert" className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">Some courses could not be loaded: {data.unavailable.map((item) => item.course).join(', ')}. <button type="button" className="underline" onClick={reload}>Retry</button></p>}
        <label className="flex items-center gap-3 text-sm font-medium">Course <select className="input max-w-sm" value={course} onChange={(event) => setCourse(event.target.value)}><option value="all">All courses</option>{data.courses.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select></label>
        {items.length === 0 && <div className="card p-5"><Empty>No announcements for this selection.</Empty></div>}
        <div className="space-y-3">
          {items.map((item) => {
            const scheduled = item.publish_at && new Date(item.publish_at).getTime() > Date.now();
            const canManage = item.course_role !== 'student';
            return <article className="card p-5" key={`${item.course_id}-${item.id}`}>
              <div className="flex flex-wrap items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint text-brand-forest"><Megaphone size={19} aria-hidden="true" /></span><div className="flex-1 min-w-[180px]"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-semibold">{item.title}</h2>{item.pinned && <span className="badge bg-brand-mint text-brand-forest"><Pin size={12} aria-hidden="true" /> Pinned</span>}{scheduled && <span className="badge bg-amber-100 text-amber-900">Scheduled</span>}</div><p className="text-xs text-brand-muted">{item.course_code} · {item.author_name} · {formatDateTime(item.publish_at || item.created_at)}</p></div>{canManage && <button type="button" title="Delete announcement" aria-label={`Delete ${item.title}`} onClick={() => remove(item)} className="btn-ghost"><Trash2 size={16} aria-hidden="true" /></button>}</div>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm text-brand-ink">{item.body}</p>
              <Link to={`/courses/${item.course_id}`} className="link inline-block mt-4 text-sm">Open {item.course_code}</Link>
            </article>;
          })}
        </div>
      </>}
    </div>
  );
}
