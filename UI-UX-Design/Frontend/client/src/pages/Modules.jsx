import { useState } from 'react'; import { useOutletContext, Link } from 'react-router-dom'; import { api } from '../api'; import { Modal, Progress } from '../components/ui';
import { CheckCircle2, Circle, FileText, Plus, Trash2, ChevronDown } from 'lucide-react';
export default function Modules() {
  const { course: c, reload, user } = useOutletContext(); const [modOpen, setModOpen] = useState(false); const [lessonFor, setLessonFor] = useState(null); const [closed, setClosed] = useState({});
  const [t, setT] = useState(''); const [lf, setLf] = useState({ title: '', content: '', duration: 15 });
  const toggle = async lid => { await api.post(`/lessons/${lid}/complete`); reload(); };
  return <div>
    <div className="flex justify-between items-center mb-4"><h1 className="text-2xl font-bold">Modules</h1>{c.canEdit && <button className="btn-primary" onClick={() => setModOpen(true)}><Plus size={16} />Module</button>}</div>
    {user.role === 'student' && <div className="card p-4 mb-4 flex items-center gap-4"><span className="text-sm font-medium whitespace-nowrap">Course progress</span><Progress value={c.progress.percent} color={c.color} /><span className="text-sm font-semibold">{c.progress.percent}%</span></div>}
    <div className="space-y-4">{c.modules.map(m => { const done = m.lessons.filter(l => l.completed).length; return <div key={m.id} className="card overflow-hidden">
      <div className="bg-slate-100 px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setClosed({ ...closed, [m.id]: !closed[m.id] })}><ChevronDown size={18} className={`transition ${closed[m.id] ? '-rotate-90' : ''}`} /><span className="font-semibold flex-1">{m.title}</span>
        {user.role === 'student' && <span className="text-xs text-slate-500">{done}/{m.lessons.length} complete</span>}
        {c.canEdit && <><button className="text-blue-700 text-sm" onClick={e => { e.stopPropagation(); setLessonFor(m.id); }}><Plus size={16} /></button><button className="text-red-500" onClick={async e => { e.stopPropagation(); if (confirm('Delete module?')) { await api.del(`/modules/${m.id}`); reload(); } }}><Trash2 size={15} /></button></>}</div>
      {!closed[m.id] && m.lessons.map(l => <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 hover:bg-slate-50">
        <FileText size={16} className="text-slate-400" /><Link to={`/courses/${c.id}/lessons/${l.id}`} className="flex-1 text-sm hover:underline">{l.title}</Link><span className="text-xs text-slate-400">{l.duration} min</span>
        {user.role === 'student' ? <button onClick={() => toggle(l.id)}>{l.completed ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-slate-300" />}</button>
          : c.canEdit && <button className="text-slate-400 hover:text-red-500" onClick={async () => { await api.del(`/lessons/${l.id}`); reload(); }}><Trash2 size={14} /></button>}</div>)}
    </div>; })}</div>
    <Modal open={modOpen} onClose={() => setModOpen(false)} title="Add module"><form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.post(`/courses/${c.id}/modules`, { title: t }); setT(''); setModOpen(false); reload(); }}><input required className="input" placeholder="Module title" value={t} onChange={e => setT(e.target.value)} /><button className="btn-primary w-full">Add</button></form></Modal>
    <Modal open={!!lessonFor} onClose={() => setLessonFor(null)} title="Add lesson"><form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.post(`/modules/${lessonFor}/lessons`, lf); setLf({ title: '', content: '', duration: 15 }); setLessonFor(null); reload(); }}>
      <input required className="input" placeholder="Lesson title" value={lf.title} onChange={e => setLf({ ...lf, title: e.target.value })} /><textarea className="input" rows={6} placeholder="Content (markdown-ish)" value={lf.content} onChange={e => setLf({ ...lf, content: e.target.value })} />
      <input type="number" className="input" value={lf.duration} onChange={e => setLf({ ...lf, duration: e.target.value })} /><button className="btn-primary w-full">Add lesson</button></form></Modal>
  </div>;
}
