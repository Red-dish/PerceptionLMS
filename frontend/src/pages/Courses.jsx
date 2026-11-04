import { useState } from 'react';
import { Plus } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import { Empty, ErrorNote, Loading, Modal, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';

const emptyCourse = { code: '', title: '', term: '' };

function NewCourse({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyCourse);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/admin/courses', form);
      setForm(emptyCourse);
      onCreated();
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New course">
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="course-code">Code</label>
          <input id="course-code" required maxLength={20} className="input" placeholder="ICT101" value={form.code} onChange={set('code')} />
        </div>
        <div>
          <label className="label" htmlFor="course-title">Title</label>
          <input id="course-title" required maxLength={200} className="input" value={form.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label" htmlFor="course-term">Term</label>
          <input id="course-term" required maxLength={50} className="input" placeholder="2026 Term 2" value={form.term} onChange={set('term')} />
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Creating…' : 'Create course'}</button>
      </form>
    </Modal>
  );
}

export default function Courses() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [creating, setCreating] = useState(false);
  const { data: courses, error, loading, reload } = useLoad(() => api.get('/courses'), []);

  return (
    <div>
      <PageHeader title="Courses" subtitle={isAdmin ? 'Every course in the college.' : 'The courses you are enrolled in.'}>
        {isAdmin && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New course
          </button>
        )}
      </PageHeader>

      {loading && !courses && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {courses?.length === 0 && (
        <Empty>{isAdmin ? 'No courses yet.' : 'You are not enrolled in any courses yet. Ask an administrator to add you.'}</Empty>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {courses?.map((course) => <CourseCard key={course.id} course={course} />)}
      </div>

      {isAdmin && (
        <NewCourse
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
