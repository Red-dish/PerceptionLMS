import { NavLink, Outlet } from 'react-router-dom';
import { Award, BookOpen, GraduationCap, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleLabels } from '../lib/format';
import { Avatar } from './ui';

function navItems(role) {
  return [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/courses', icon: BookOpen, label: 'Courses' },
    ...(role === 'student' ? [{ to: '/grades', icon: Award, label: 'Grades' }] : []),
    ...(role === 'admin' ? [{ to: '/users', icon: Users, label: 'Users' }] : []),
  ];
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const items = navItems(user.role);

  return (
    <div className="min-h-screen">
      {/* Side navigation from tablet width up */}
      <aside className="hidden md:flex w-24 bg-slate-800 text-slate-300 flex-col items-center py-4 fixed inset-y-0 z-40">
        <div className="w-11 h-11 rounded-xl bg-blue-600 grid place-items-center text-white mb-6" title="Perception LMS">
          <GraduationCap aria-hidden="true" />
        </div>
        <div className="flex flex-col items-center mb-4 px-1 text-center" title={user.name}>
          <Avatar name={user.name} />
          <span className="text-[10px] mt-1 uppercase tracking-wide text-slate-400">{roleLabels[user.role]}</span>
        </div>
        <nav aria-label="Main" className="flex-1 w-full space-y-1">
          {items.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-[11px] border-l-4 ${
                  isActive ? 'bg-white/10 text-white border-blue-500' : 'border-transparent hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={signOut} className="flex flex-col items-center gap-1 py-3 text-[11px] hover:text-white">
          <LogOut size={20} aria-hidden="true" />
          Sign out
        </button>
      </aside>

      {/* Top bar on phones */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-800 text-white flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold">
          <GraduationCap size={20} aria-hidden="true" />
          Perception LMS
        </span>
        <button type="button" onClick={signOut} className="flex items-center gap-1 text-sm text-slate-300">
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </header>

      <main className="md:ml-24 p-4 pb-24 md:p-8 max-w-[1400px]">
        <Outlet />
      </main>

      {/* Bottom navigation on phones */}
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? 'text-blue-700 font-medium' : 'text-slate-500'}`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
