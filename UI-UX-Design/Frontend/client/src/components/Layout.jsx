import { NavLink, Outlet } from 'react-router-dom'; import { useAuth } from '../auth'; import { Avatar } from './ui';
import { LayoutDashboard, BookOpen, CalendarCheck, CalendarDays, Users, LogOut, GraduationCap } from 'lucide-react';
export default function Layout() {
  const { user, logout } = useAuth();
  const items = [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }, { to: '/courses', icon: BookOpen, label: 'Courses' }, { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ...(user.role === 'student' ? [{ to: '/attendance', icon: CalendarCheck, label: 'Attendance' }] : []), ...(user.role !== 'student' ? [{ to: '/users', icon: Users, label: 'Users' }] : [])];
  return <div className="flex min-h-screen">
    <aside className="w-20 md:w-24 bg-[#1e293b] text-slate-300 flex flex-col items-center py-4 fixed inset-y-0 z-40">
      <div className="w-11 h-11 rounded-xl bg-blue-600 grid place-items-center text-white mb-6"><GraduationCap /></div>
      <div className="flex flex-col items-center mb-4" title={user.name}><Avatar user={user} size={10} /><span className="text-[10px] mt-1 uppercase tracking-wide text-slate-400">{user.role}</span></div>
      <nav className="flex-1 w-full space-y-1">{items.map(({ to, icon: I, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-1 py-3 text-[11px] border-l-4 ${isActive ? 'bg-white/10 text-white border-blue-500' : 'border-transparent hover:text-white hover:bg-white/5'}`}><I size={22} />{label}</NavLink>)}</nav>
      <button onClick={logout} className="flex flex-col items-center gap-1 py-3 text-[11px] hover:text-white"><LogOut size={20} />Logout</button>
    </aside>
    <main className="flex-1 ml-20 md:ml-24 p-6 md:p-8 max-w-[1400px]"><Outlet /></main>
  </div>;
}
