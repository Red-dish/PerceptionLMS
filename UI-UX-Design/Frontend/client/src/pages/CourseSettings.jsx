import { useState } from 'react'; import { useOutletContext, useNavigate } from 'react-router-dom'; import { api } from '../api';
export default function CourseSettings() {
  const { course: c, reload } = useOutletContext(); const nav = useNavigate(); const [f, setF] = useState({ code: c.code, name: c.name, description: c.description, color: c.color, term: c.term }); const [ok, setOk] = useState(false);
  return <div className="card p-6 max-w-2xl"><h1 className="text-2xl font-bold mb-4">Course Settings</h1><form className="space-y-4" onSubmit={async e => { e.preventDefault(); await api.put(`/courses/${c.id}`, f); setOk(true); reload(); }}>
    {['code', 'name', 'term'].map(k => <div key={k}><label className="label capitalize">{k}</label><input className="input" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>)}
    <div><label className="label">Description</label><textarea className="input" rows={4} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
    <div><label className="label">Colour</label><input type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></div>
    <div className="flex gap-2 items-center"><button className="btn-primary">Save changes</button>{ok && <span className="text-sm text-emerald-600">Saved ✓</span>}<div className="flex-1" />
      <button type="button" className="btn bg-red-50 text-red-600 hover:bg-red-100" onClick={async () => { if (confirm('Delete this course permanently?')) { await api.del(`/courses/${c.id}`); nav('/courses'); } }}>Delete course</button></div></form></div>;
}
