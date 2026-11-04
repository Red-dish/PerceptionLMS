import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../api'; import { useAuth } from '../auth';
import { PageHeader, Modal, Progress } from '../components/ui'; import { Plus } from 'lucide-react';
export default function Courses() {
  const { user } = useAuth(); const [list, setList] = useState([]); const [tab, setTab] = useState('mine'); const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', name: '', description: '', color: '#2563eb' });
  const load = () => (tab === 'mine' ? api.get('/courses') : api.get('/courses/catalog')).then(setList); useEffect(() => { load(); }, [tab]);
  const create = async e => { e.preventDefault(); await api.post('/courses', f); setOpen(false); setF({ code: '', name: '', description: '', color: '#2563eb' }); load(); };
  return <div><PageHeader title="Courses" sub="All your courses this term">{user.role !== 'student' && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New course</button>}</PageHeader>
    {user.role === 'student' && <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">{[['mine', 'My courses'], ['catalog', 'Browse catalog']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-md text-sm ${tab === k ? 'bg-white shadow font-medium' : 'text-slate-600'}`}>{l}</button>)}</div>}
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Course</th><th>Teacher</th><th>Term</th><th>Students</th><th className="w-48">{tab === 'mine' && user.role === 'student' ? 'Progress' : ''}</th></tr></thead>
      <tbody>{list.map(c => <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-3"><span className="w-3 h-8 rounded" style={{ background: c.color }} />
        {tab === 'mine' ? <Link to={`/courses/${c.id}`} className="font-medium text-blue-700 hover:underline">{c.code} — {c.name}</Link> : <span className="font-medium">{c.code} — {c.name}</span>}</div></td>
        <td>{c.teacher?.name}</td><td>{c.term}</td><td>{c.studentCount}</td>
        <td className="pr-3">{tab === 'mine' ? (c.progress && <div className="flex items-center gap-2"><Progress value={c.progress.percent} color={c.color} /><span className="text-xs w-9">{c.progress.percent}%</span></div>) :
          c.enrolled ? <span className="badge bg-emerald-100 text-emerald-700">Enrolled</span> : <button className="btn-primary py-1" onClick={async () => { await api.post(`/courses/${c.id}/enroll`); load(); }}>Enroll</button>}</td></tr>)}</tbody></table></div>
    <Modal open={open} onClose={() => setOpen(false)} title="Create course"><form onSubmit={create} className="space-y-3">
      <div className="grid grid-cols-3 gap-3"><div><label className="label">Code</label><input required className="input" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div><div className="col-span-2"><label className="label">Name</label><input required className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div></div>
      <div><label className="label">Description</label><textarea className="input" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">Colour</label><input type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></div>
      <button className="btn-primary w-full">Create</button></form></Modal>
  </div>;
}
