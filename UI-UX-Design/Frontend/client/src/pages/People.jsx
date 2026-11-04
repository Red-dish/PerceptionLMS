import { useEffect, useState } from 'react'; import { useOutletContext } from 'react-router-dom'; import { api } from '../api'; import { Avatar, gradeColor } from '../components/ui'; import { UserPlus, X } from 'lucide-react';
export default function People() {
  const { course: c, reload } = useOutletContext(); const [p, setP] = useState(null); const [add, setAdd] = useState('');
  const load = () => api.get(`/courses/${c.id}/people`).then(setP); useEffect(() => { load(); }, []); if (!p) return null;
  return <div><h1 className="text-2xl font-bold mb-4">People</h1>
    {c.canEdit && <div className="card p-4 mb-4 flex gap-2"><select className="input" value={add} onChange={e => setAdd(e.target.value)}><option value="">Select a student to enroll…</option>{p.available.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>
      <button className="btn-primary" disabled={!add} onClick={async () => { await api.post(`/courses/${c.id}/enroll`, { userId: add }); setAdd(''); load(); reload(); }}><UserPlus size={16} />Enroll</button></div>}
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Name</th><th>Role</th>{c.canEdit && <><th>Progress</th><th>Attendance</th><th>Grade</th><th /></>}</tr></thead><tbody>
      <tr className="border-t border-slate-100"><td className="p-3 flex items-center gap-2"><Avatar user={p.teacher} size={8} />{p.teacher.name}</td><td><span className="badge bg-blue-100 text-blue-700">Teacher</span></td>{c.canEdit && <td colSpan={4} />}</tr>
      {p.students.map(s => <tr key={s.id} className="border-t border-slate-100"><td className="p-3"><div className="flex items-center gap-2"><Avatar user={s} size={8} /><div>{s.name}<div className="text-xs text-slate-400">{s.email}</div></div></div></td><td><span className="badge bg-slate-100">Student</span></td>
        {c.canEdit && <><td>{s.progress}%</td><td className={s.attendance < 75 ? 'text-red-600' : ''}>{s.attendance}%</td><td className={gradeColor(s.grade)}>{s.grade ?? '—'}</td><td><button className="text-slate-400 hover:text-red-500" onClick={async () => { if (confirm('Remove student?')) { await api.del(`/courses/${c.id}/enroll/${s.id}`); load(); reload(); } }}><X size={16} /></button></td></>}</tr>)}</tbody></table></div></div>;
}
