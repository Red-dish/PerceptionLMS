import { useEffect, useState } from 'react'; import { useNavigate, useSearchParams } from 'react-router-dom'; import { useAuth } from '../auth'; import { api } from '../api';
import { GraduationCap, BookOpen, CalendarCheck, BarChart3 } from 'lucide-react';
const demos = [['Teacher', 'teacher@demo.edu'], ['Student', 'student@demo.edu'], ['Admin', 'admin@demo.edu']];
export default function Login() {
  const { login, user } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(sp.get('error') ? (sp.get('error') === 'google_not_configured' ? 'Google SSO is not configured on the server yet (see README).' : 'Google sign-in failed.') : ''); const [cfg, setCfg] = useState({});
  useEffect(() => { if (user) nav('/'); api.get('/auth/config').then(setCfg).catch(() => {}); }, [user]);
  const go = async (e, p) => { setErr(''); try { await login(e, p); nav('/'); } catch (x) { setErr(x.message); } };
  return <div className="min-h-screen grid lg:grid-cols-2">
    <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white">
      <div className="flex items-center gap-3 text-xl font-bold"><div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center"><GraduationCap /></div>Learnly LMS</div>
      <div><h2 className="text-4xl font-bold leading-tight mb-4">Teach, learn and track<br />progress in one place.</h2>
        <div className="space-y-3 text-blue-100">{[[BookOpen, 'Courses, modules, lessons & assignments'], [CalendarCheck, 'Attendance per session with live percentages'], [BarChart3, 'Course progression & gradebook analytics']].map(([I, t]) => <div key={t} className="flex items-center gap-3"><I size={18} />{t}</div>)}</div></div>
      <p className="text-sm text-blue-200">© 2026 Learnly</p>
    </div>
    <div className="flex items-center justify-center p-6"><div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1><p className="text-slate-500 mt-1 mb-8">Sign in to your learning portal</p>
      <a href="/api/auth/google" className="btn-ghost w-full py-2.5"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</a>
      {cfg.googleEnabled === false && <p className="text-xs text-amber-600 mt-2 text-center">Google SSO not configured — add GOOGLE_CLIENT_ID/SECRET to server/.env</p>}
      <div className="flex items-center gap-3 my-6 text-xs text-slate-400"><div className="flex-1 h-px bg-slate-200" />OR<div className="flex-1 h-px bg-slate-200" /></div>
      <form onSubmit={e => { e.preventDefault(); go(email, password); }} className="space-y-4">
        <div><label className="label">Email</label><input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.edu" /></div>
        <div><label className="label">Password</label><input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {err && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{err}</div>}
        <button className="btn-primary w-full py-2.5">Sign in</button>
      </form>
      <div className="mt-8"><p className="text-xs uppercase tracking-wide text-slate-400 mb-2">One-click demo</p>
        <div className="grid grid-cols-3 gap-2">{demos.map(([r, e]) => <button key={r} onClick={() => go(e, 'password123')} className="btn-ghost text-xs">{r}</button>)}</div></div>
    </div></div>
  </div>;
}
