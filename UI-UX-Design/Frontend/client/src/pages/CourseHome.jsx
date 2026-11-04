import { useState } from 'react'; import { useOutletContext, Link } from 'react-router-dom'; import { api } from '../api'; import { Progress, Modal } from '../components/ui'; import { Megaphone, Plus, PlayCircle } from 'lucide-react';
export default function CourseHome() {
  const { course: c, reload, user } = useOutletContext(); const [open, setOpen] = useState(false); const [f, setF] = useState({ title: '', body: '' });
  const next = c.modules.flatMap(m => m.lessons).find(l => !l.completed);
  return <div className="space-y-6">
    <div className="rounded-2xl p-8 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.color}, #0f172a)` }}>
      <div className="text-sm opacity-80">{c.code} · {c.term}</div><h1 className="text-3xl font-bold mt-1">{c.name}</h1><p className="mt-2 max-w-2xl opacity-90">{c.description}</p>
      <div className="mt-4 text-sm opacity-80">Instructor: {c.teacher?.name} · {c.studentCount} students</div>
      {user.role === 'student' && <div className="mt-6 max-w-md"><div className="flex justify-between text-sm mb-1"><span>Your progress</span><span>{c.progress.percent}%</span></div><Progress value={c.progress.percent} color="#fff" h="h-2.5" />
        {next && <Link to={`lessons/${next.id}`} className="inline-flex items-center gap-2 mt-4 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium"><PlayCircle size={16} />Continue: {next.title}</Link>}</div>}
    </div>
    <div className="card p-6"><div className="flex justify-between items-center mb-4"><h2 className="font-semibold flex items-center gap-2"><Megaphone size={18} />Announcements</h2>{c.canEdit && <button className="btn-ghost" onClick={() => setOpen(true)}><Plus size={14} />Post</button>}</div>
      {c.announcements.map(a => <div key={a.id} className="border-t border-slate-100 py-3"><div className="font-medium">{a.title}</div><div className="text-sm text-slate-600">{a.body}</div><div className="text-xs text-slate-400 mt-1">{new Date(a.createdAt).toLocaleString()}</div></div>)}</div>
    <Modal open={open} onClose={() => setOpen(false)} title="New announcement"><form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.post(`/courses/${c.id}/announcements`, f); setOpen(false); setF({ title: '', body: '' }); reload(); }}>
      <input required className="input" placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /><textarea className="input" rows={4} placeholder="Message" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /><button className="btn-primary w-full">Post</button></form></Modal>
  </div>;
}
