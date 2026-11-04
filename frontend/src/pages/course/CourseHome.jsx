import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pin, Plus, Trash2 } from 'lucide-react';
import { Empty, ErrorNote, Loading, Modal, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';

const emptyPost = { title: '', body: '', pinned: false };

function NewAnnouncement({ courseId, open, onClose, onPosted }) {
  const [form, setForm] = useState(emptyPost);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/announcements`, form);
      setForm(emptyPost);
      onPosted();
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New announcement">
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="announcement-title">Title</label>
          <input
            id="announcement-title"
            required
            maxLength={200}
            className="input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="announcement-body">Message</label>
          <textarea
            id="announcement-body"
            required
            rows={5}
            maxLength={10000}
            className="input"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(event) => setForm({ ...form, pinned: event.target.checked })}
          />
          Pin to the top
        </label>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Posting…' : 'Post announcement'}</button>
      </form>
    </Modal>
  );
}

export default function CourseHome() {
  const { course, canEdit } = useOutletContext();
  const [posting, setPosting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const path = `/courses/${course.id}/announcements`;
  const { data: announcements, error, loading, reload } = useLoad(() => api.get(path), [path]);

  const remove = async (announcement) => {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    setDeleteError(null);
    try {
      await api.del(`${path}/${announcement.id}`);
      reload();
    } catch (problem) {
      setDeleteError(problem);
    }
  };

  return (
    <div>
      <PageHeader title={course.title} subtitle={`${course.code} · ${course.term}`}>
        {canEdit && (
          <button type="button" className="btn-primary" onClick={() => setPosting(true)}>
            <Plus size={16} aria-hidden="true" />
            Announcement
          </button>
        )}
      </PageHeader>

      <h2 className="text-lg font-semibold mb-3">Announcements</h2>
      {loading && !announcements && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      <div className="mb-3"><ErrorNote error={deleteError} /></div>
      {announcements?.length === 0 && <Empty>No announcements yet.</Empty>}

      <div className="space-y-3">
        {announcements?.map((announcement) => (
          <article key={announcement.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold flex items-center gap-2">
                  {announcement.pinned && <Pin size={14} className="text-blue-600 shrink-0" aria-label="Pinned" />}
                  {announcement.title}
                </h3>
                <div className="text-xs text-slate-500">
                  {announcement.author_name} · {formatDate(announcement.created_at)}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Delete ${announcement.title}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => remove(announcement)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{announcement.body}</p>
          </article>
        ))}
      </div>

      {canEdit && (
        <NewAnnouncement
          courseId={course.id}
          open={posting}
          onClose={() => setPosting(false)}
          onPosted={() => {
            setPosting(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
