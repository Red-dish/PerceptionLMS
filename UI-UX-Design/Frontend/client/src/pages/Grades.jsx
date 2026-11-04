import { useEffect, useState } from 'react'; import { useOutletContext } from 'react-router-dom'; import { api } from '../api'; import { Avatar, gradeColor, Progress } from '../components/ui';
export default function Grades() {
  const { course: c } = useOutletContext(); const [g, setG] = useState(null); const load = () => api.get(`/courses/${c.id}/gradebook`).then(setG); useEffect(() => { load(); }, []);
  if (!g) return null;
  const save = async (assignmentId, userId, grade) => { await api.put('/grades', { assignmentId, userId, grade }); load(); };
  return <div><h1 className="text-2xl font-bold mb-4">{c.canEdit ? 'Gradebook' : 'My Grades'}</h1>
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-left">Student</th>{g.assignments.map(a => <th key={a.id} className="p-3 text-center whitespace-nowrap">{a.title}<div className="text-[10px] font-normal">out of {a.points}</div></th>)}<th className="p-3">Progress</th><th className="p-3">Total</th></tr></thead>
      <tbody>{g.rows.map(r => <tr key={r.student.id} className="border-t border-slate-100"><td className="p-3"><div className="flex items-center gap-2"><Avatar user={r.student} size={7} />{r.student.name}</div></td>
        {g.assignments.map(a => { const v = r.grades[a.id]; return <td key={a.id} className="p-2 text-center">{c.canEdit ? <input defaultValue={v?.grade ?? ''} placeholder={v?.submitted ? 'needs grade' : '—'} onBlur={e => e.target.value !== String(v?.grade ?? '') && save(a.id, r.student.id, e.target.value)} className={`w-20 text-center rounded border px-1 py-1 ${v?.submitted && v.grade == null ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`} /> : <span>{v?.grade ?? (v?.submitted ? 'Submitted' : '—')}</span>}</td>; })}
        <td className="p-3 w-36"><div className="flex items-center gap-2"><Progress value={r.progress} color={c.color} /><span className="text-xs">{r.progress}%</span></div></td>
        <td className={`p-3 text-center font-semibold ${gradeColor(r.total)}`}>{r.total ?? '—'}{r.total != null && '%'}</td></tr>)}</tbody></table></div>
    {c.canEdit && <p className="text-xs text-slate-500 mt-2">Click a cell, type a score and tab away to save. Amber = submitted, awaiting grade.</p>}</div>;
}
