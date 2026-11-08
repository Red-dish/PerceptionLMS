import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { Empty, ErrorNote, Modal, PageHeader } from '../../components/ui';
import { api, fileProblem, MAX_UPLOAD_MB, openDownload, uploadFile } from '../../lib/api';

function NewModule({ courseId, open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [published, setPublished] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/modules`, { title, published });
      setTitle('');
      setPublished(false);
      onCreated();
    } catch (problem) {
      setError(problem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New module">
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="module-title">Title</label>
          <input id="module-title" required maxLength={200} className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          Publish now, so students can see it
        </label>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Creating…' : 'Create module'}</button>
      </form>
    </Modal>
  );
}

function AddMaterial({ courseId, module, onClose, onAdded }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    const materials = `/courses/${courseId}/modules/${module.id}/materials`;
    try {
      const created = await api.post(materials, {
        title,
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
      });
      try {
        await uploadFile(created.upload, file);
      } catch (uploadError) {
        // The API has saved the material by now. Remove it so students don't see a broken file.
        await api.del(`${materials}/${created.material.id}`).catch(() => {});
        throw uploadError;
      }
      onAdded();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Add material to ${module.title}`}>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="material-title">Title</label>
          <input id="material-title" required maxLength={200} className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="material-file">File, up to {MAX_UPLOAD_MB} MB</label>
          <input id="material-file" type="file" required className="input" onChange={(event) => setFile(event.target.files[0] ?? null)} />
        </div>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Uploading…' : 'Add material'}</button>
      </form>
    </Modal>
  );
}

export default function Modules() {
  const { course, modules, canEdit, reload } = useOutletContext();
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const base = `/courses/${course.id}/modules`;

  const act = async (action) => {
    setActionError(null);
    try {
      await action();
    } catch (problem) {
      setActionError(problem);
    }
  };

  const togglePublished = (module) =>
    act(async () => {
      await api.patch(`${base}/${module.id}`, { published: !module.published });
      await reload();
    });

  const removeModule = (module) => {
    if (!window.confirm(`Delete "${module.title}" and all of its materials?`)) return;
    act(async () => {
      await api.del(`${base}/${module.id}`);
      await reload();
    });
  };

  const removeMaterial = (module, material) => {
    if (!window.confirm(`Delete "${material.title}"?`)) return;
    act(async () => {
      await api.del(`${base}/${module.id}/materials/${material.id}`);
      await reload();
    });
  };

  const download = (module, material) =>
    act(() => openDownload(`${base}/${module.id}/materials/${material.id}/download`));

  return (
    <div>
      <PageHeader title="Modules">
        {canEdit && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Module
          </button>
        )}
      </PageHeader>

      <div className="mb-3"><ErrorNote error={actionError} /></div>
      {modules.length === 0 && <Empty>No modules yet.</Empty>}

      <div className="space-y-4">
        {modules.map((module) => (
          <section key={module.id} className="card overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold flex-1 min-w-[160px]">{module.title}</h2>
              {canEdit && (
                <>
                  <span className={`badge ${module.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {module.published ? 'Published' : 'Draft'}
                  </span>
                  <button type="button" className="text-sm link" onClick={() => togglePublished(module)}>
                    {module.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button type="button" className="text-sm link" onClick={() => setAddingTo(module)}>Add material</button>
                  <button
                    type="button"
                    aria-label={`Delete ${module.title}`}
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeModule(module)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
            {module.materials.length === 0 && <div className="px-4"><Empty>No materials yet.</Empty></div>}
            <ul>
              {module.materials.map((material) => (
                <li key={material.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100">
                  <FileText size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{material.title}</div>
                    <div className="text-xs text-slate-500 truncate">{material.file_name}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Download ${material.title}`}
                    className="text-blue-700 hover:text-blue-900"
                    onClick={() => download(module, material)}
                  >
                    <Download size={16} />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Delete ${material.title}`}
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => removeMaterial(module, material)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canEdit && (
        <NewModule
          courseId={course.id}
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {addingTo && (
        <AddMaterial
          courseId={course.id}
          module={addingTo}
          onClose={() => setAddingTo(null)}
          onAdded={() => {
            setAddingTo(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
