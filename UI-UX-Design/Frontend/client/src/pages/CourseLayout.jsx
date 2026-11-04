import { useEffect, useState, useCallback } from 'react'; import { NavLink, Outlet, useParams, Link } from 'react-router-dom'; import { api } from '../api'; import { useAuth } from '../auth'; import { ChevronRight } from 'lucide-react';
export default function CourseLayout() {
  const { id } = useParams(); const { user } = useAuth(); const [c, setC] = useState(null);
  const reload = useCallback(() => api.get(`/courses/${id}`).then(setC), [id]); useEffect(() => { reload(); }, [reload]);
  if (!c) return <div className="text-slate-500">Loading…</div>;
  const nav = [['', 'Home'], ['modules', 'Modules'], ['assignments', 'Assignments'], ['grades', 'Grades'], ['attendance', 'Attendance'], ['people', 'People'], ...(c.canEdit ? [['settings', 'Settings']] : [])];
  return <div>
    <div className="flex items-center gap-2 text-sm mb-5"><Link to="/courses" className="text-blue-700 hover:underline">Courses</Link><ChevronRight size={14} className="text-slate-400" /><span className="font-medium" style={{ color: c.color }}>{c.code}</span><span className="text-slate-500">{c.name}</span></div>
    <div className="flex gap-8"><nav className="w-44 shrink-0 hidden md:block"><div className="space-y-0.5 sticky top-6">{nav.map(([p, l]) => <NavLink key={l} to={`/courses/${id}${p ? '/' + p : ''}`} end={!p} className={({ isActive }) => `block px-3 py-2 text-sm rounded-md border-l-2 ${isActive ? 'border-slate-900 font-semibold text-slate-900' : 'border-transparent text-blue-700 hover:bg-slate-100'}`}>{l}</NavLink>)}</div></nav>
      <div className="flex-1 min-w-0"><div className="md:hidden flex gap-2 overflow-x-auto mb-4">{nav.map(([p, l]) => <NavLink key={l} end={!p} to={`/courses/${id}${p ? '/' + p : ''}`} className={({ isActive }) => `badge py-1 px-3 ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-200'}`}>{l}</NavLink>)}</div>
        <Outlet context={{ course: c, reload, user }} /></div></div>
  </div>;
}
