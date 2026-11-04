import { useEffect, useState } from 'react'; import { api } from '../api'; import { useAuth } from '../auth'; import { Avatar, PageHeader } from '../components/ui';
export default function Users() {
  const { user } = useAuth(); const [u, setU] = useState([]); const [q, setQ] = useState(''); const load = () => api.get('/users').then(setU); useEffect(() => { load(); }, []);
  return <div><PageHeader title="Users" sub="Everyone on the platform"><input className="input w-64" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></PageHeader>
    <div className="card overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
      {u.filter(x => (x.name + x.email).toLowerCase().includes(q.toLowerCase())).map(x => <tr key={x.id} className="border-t border-slate-100"><td className="p-3 flex items-center gap-2"><Avatar user={x} size={8} />{x.name}</td><td>{x.email}</td>
        <td>{user.role === 'admin' ? <select className="input w-32 py-1" value={x.role} onChange={async e => { await api.put(`/users/${x.id}/role`, { role: e.target.value }); load(); }}>{['student', 'teacher', 'admin'].map(r => <option key={r}>{r}</option>)}</select> : <span className="capitalize">{x.role}</span>}</td></tr>)}</tbody></table></div></div>;
}
