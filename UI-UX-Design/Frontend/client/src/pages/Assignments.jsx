import { useState } from 'react'; import { useOutletContext } from 'react-router-dom'; import { api } from '../api'; import { Modal } from '../components/ui'; import { ClipboardList, Plus, Trash2 } from 'lucide-react';
export default function Assignments() {
  const { course: c, reload, user } = useOutletContext(); const [open, setOpen] = useState(false); const [sub, setSub] = useState(null); const [text, setText] = useState('');
  const [f, setF] = useState({ title: '', description: '', points: 100, dueDate: new Date().toISOString().slice(0, 10) });
  return <div><div className="flex justify-between items-center mb-4"><h1 className="text-2xl font-bold">Assignments</h1>{c.canEdit && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Assignment</button>}</div>
    <div className="card divide-y divide-slate-100">{c.assignments.map(a => <div key={a.id} className="p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 grid place-items-center"><ClipboardList size={18} /></div>
      <div className="flex-1"><div className="font-medium">{a.title}</div><div className="text-xs text-slate-500">Due {a.dueDate} · {a.points} pts{c.canEdit && ` · ${a.submissionCount} submissions`}</div><div className="text-sm text-slate-600 mt-1">{a.description}</div></div>
      {user.role === 'student' ? (a.submission?.grade != null ? <span className="badge bg-emerald-100 text-emerald-700">{a.submission.grade}/{a.points}</span> :
        <button className={a.submission ? 'btn-ghost' : 'btn-primary'} onClick={() => { setSub(a); setText(a.submission?.content || ''); }}>{a.submission ? 'Resubmit' : 'Submit'}</button>)
        : <button className="text-slate-400 hover:text-red-500" onClick={async () => { if (confirm('Delete?')) { await api.del(`/assignments/${a.id}`); reload(); } }}><Trash2 size={16} /></button>}</div>)}</div>
    <Modal open={open} onClose={() => setOpen(false)} title="New assignment"><form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.post(`/courses/${c.id}/assignments`, f); setOpen(false); reload(); }}>
      <input required className="input" placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /><textarea className="input" placeholder="Instructions" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-3"><div><label className="label">Points</label><input type="number" className="input" value={f.points} onChange={e => setF({ ...f, points: e.target.value })} /></div><div><label className="label">Due</label><input type="date" className="input" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></div></div>
      <button className="btn-primary w-full">Create</button></form></Modal>
    <Modal open={!!sub} onClose={() => setSub(null)} title={`Submit: ${sub?.title}`}><form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.post(`/assignments/${sub.id}/submit`, { content: text }); setSub(null); reload(); }}>
      <textarea required className="input" rows={6} placeholder="Your answer or a link to your work" value={text} onChange={e => setText(e.target.value)} /><button className="btn-primary w-full">Submit</button></form></Modal>
  </div>;
}
