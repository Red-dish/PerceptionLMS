import { useEffect, useState } from 'react'; import { api } from '../api'; import { PageHeader } from '../components/ui';
export default function Calendar() {
  const [items, setItems] = useState([]); const [m, setM] = useState(new Date());
  useEffect(() => { api.get('/courses').then(async cs => { const all = await Promise.all(cs.map(c => api.get(`/courses/${c.id}`))); setItems(all.flatMap(c => c.assignments.map(a => ({ ...a, color: c.color, code: c.code })))); }); }, []);
  const y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return <div><PageHeader title="Calendar" sub="Assignment due dates"><button className="btn-ghost" onClick={() => setM(new Date(y, mo - 1))}>‹</button><span className="btn">{m.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button className="btn-ghost" onClick={() => setM(new Date(y, mo + 1))}>›</button></PageHeader>
    <div className="card grid grid-cols-7 overflow-hidden">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="p-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b">{d}</div>)}
      {cells.map((d, i) => { const ds = d && `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; return <div key={i} className="min-h-24 border-b border-r border-slate-100 p-1.5"><div className="text-xs text-slate-500">{d}</div>
        {d && items.filter(a => a.dueDate === ds).map(a => <div key={a.id} className="text-[11px] text-white rounded px-1.5 py-0.5 mt-1 truncate" style={{ background: a.color }}>{a.code}: {a.title}</div>)}</div>; })}</div></div>;
}
