import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Award, BookOpen, CalendarDays, GraduationCap, LayoutDashboard, LogOut, Menu, X, ClipboardList, Megaphone, ClipboardCheck } from 'lucide-react';
import { Users } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleLabels } from '../lib/format';
import { Avatar } from './ui';

function navItems(role) {
  return [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/courses', icon: BookOpen, label: 'Courses' },
    ...(role === 'lecturer' || role === 'admin' ? [{ to: '/grading', icon: ClipboardCheck, label: 'Grading' }] : []),
    { to: '/announcements', icon: Megaphone, label: 'Announcements' },
    { to: '/assignments', icon: ClipboardList, label: 'Assignments' },
    { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ...(role === 'student' ? [{ to: '/grades', icon: Award, label: 'Grades' }] : []),
    ...(role === 'admin' ? [{ to: '/users', icon: Users, label: 'Users' }] : []),
  ];
}

function Navigation({ items, onNavigate }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-1">
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isActive ? 'bg-white text-brand-forest shadow-sm' : 'text-brand-mint hover:bg-white/10 hover:text-white'}`}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const items = navItems(user.role);
  const pageTitle = location.pathname === '/' ? 'Dashboard' :
    location.pathname.startsWith('/courses') ? 'Courses' :
    location.pathname.startsWith('/assignments') ? 'Assignments' :
    location.pathname.startsWith('/announcements') ? 'Announcements' :
    location.pathname.startsWith('/grading') ? 'Grading' :
    location.pathname.startsWith('/calendar') ? 'Calendar' :
    location.pathname.startsWith('/grades') ? 'Grades' :
    location.pathname.startsWith('/users') ? 'Users' : 'Workspace';

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink lg:pl-64">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {menuOpen && <button type="button" className="fixed inset-0 z-40 bg-brand-ink/60 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="workspace-navigation" className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-forest p-5 shadow-xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Workspace sidebar">
        <div className="mb-9 flex items-center justify-between gap-2">
          <NavLink to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-white font-bold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><GraduationCap size={22} aria-hidden="true" /></span>
            <span>PERCEPTION LMS</span>
          </NavLink>
          <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/15 lg:hidden" aria-label="Close menu"><X size={20} /></button>
        </div>
        <p className="mb-3 px-4 text-xs font-bold uppercase tracking-[.16em] text-brand-mint/80">Workspace</p>
        <Navigation items={items} onNavigate={() => setMenuOpen(false)} />
        <div className="mt-7 border-t border-white/20 pt-5">
          <div className="mb-4 flex items-center gap-3 px-2">
            <Avatar name={user.name || 'User'} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-brand-mint">{roleLabels[user.role] || user.role}</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-brand-mint hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-brand-line bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="rounded-lg p-2 text-brand-forest hover:bg-brand-mint lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen} aria-controls="workspace-navigation"><Menu size={22} /></button>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Your workspace</p><p className="truncate font-display text-xl font-semibold text-brand-ink">{pageTitle}</p></div>
          </div>
          <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-semibold text-brand-ink">{user.name}</span><span className="block text-xs text-brand-muted">{roleLabels[user.role] || user.role}</span></span><Avatar name={user.name || 'User'} /></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 sm:py-9"><Outlet /></main>
      </div>
    </div>
  );
}
