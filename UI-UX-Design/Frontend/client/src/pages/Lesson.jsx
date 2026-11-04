import { useEffect, useState } from 'react'; import { useOutletContext, useParams, Link } from 'react-router-dom'; import { api } from '../api'; import { CheckCircle2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
const render = t => (t || '').split('\n').map((line, i) => line.startsWith('## ') ? <h2 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2> : line.startsWith('- ') ? <li key={i} className="ml-5 list-disc">{line.slice(2)}</li> : line ? <p key={i} className="my-2" dangerouslySetInnerHTML={{ __html: line.replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} /> : null);
export default function Lesson() {
  const { course: c, reload, user } = useOutletContext(); const { lid } = useParams(); const [l, setL] = useState(null); const [edit, setEdit] = useState(false);
  const load = () => api.get(`/lessons/${lid}`).then(setL); useEffect(() => { load(); setEdit(false); }, [lid]);
  if (!l) return null;
  return <div className="card p-8">
    <div className="text-xs uppercase tracking-wide text-slate-400">{l.module} · {l.duration} min</div>
    {edit ? <form className="space-y-3 mt-2" onSubmit={async e => { e.preventDefault(); await api.put(`/lessons/${l.id}`, { title: l.title, content: l.content }); setEdit(false); reload(); }}>
      <input className="input" value={l.title} onChange={e => setL({ ...l, title: e.target.value })} /><textarea className="input font-mono" rows={12} value={l.content} onChange={e => setL({ ...l, content: e.target.value })} /><button className="btn-primary">Save</button></form> : <>
      <div className="flex justify-between items-start"><h1 className="text-3xl font-bold mt-1">{l.title}</h1>{c.canEdit && <button className="btn-ghost" onClick={() => setEdit(true)}><Pencil size={14} />Edit</button>}</div>
      <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl my-6 grid place-items-center text-slate-400">▶ Lesson video placeholder</div>
      <div className="prose max-w-none text-slate-700">{render(l.content)}</div></>}
    <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
      {l.prev ? <Link className="btn-ghost" to={`/courses/${c.id}/lessons/${l.prev}`}><ChevronLeft size={16} />Previous</Link> : <span />}
      {user.role === 'student' && <button onClick={async () => { await api.post(`/lessons/${l.id}/complete`); load(); reload(); }} className={l.completed ? 'btn bg-emerald-100 text-emerald-700' : 'btn-primary'}><CheckCircle2 size={16} />{l.completed ? 'Completed' : 'Mark as complete'}</button>}
      {l.next ? <Link className="btn-ghost" to={`/courses/${c.id}/lessons/${l.next}`}>Next<ChevronRight size={16} /></Link> : <span />}
    </div></div>;
}
