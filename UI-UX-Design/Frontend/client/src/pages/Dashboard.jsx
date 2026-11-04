import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../api'; import { useAuth } from '../auth';
import { Progress, Stat, PageHeader, gradeColor } from '../components/ui'; import { BookOpen, CalendarCheck, Award, TrendingUp, Users, ClipboardList, Megaphone, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
export default function Dashboard() {
  const { user } = useAuth(); const [d, setD] = useState(null);
  useEffect(() => { api.get('/dashboard').then(setD); }, []);
  if (!d) return <div className="text-slate-500">Loading…</div>;
  const s = d.stats, student = user.role === 'student';
  const chart = d.courses.map(c => student ? { name: c.code, Progress: c.progress.percent, Attendance: c.attendance, Grade: c.grade ?? 0 } : { name: c.code, Students: c.studentCount });
  return <div>
    <PageHeader title={`Good day, ${user.name.split(' ')[0]} 👋`} sub={student ? 'Here is how your learning is going.' : 'Overview of your teaching.'} />
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">{student ? <>
      <Stat icon={BookOpen} label="Enrolled courses" value={s.courses} /><Stat icon={TrendingUp} label="Avg. progress" value={s.avgProgress + '%'} tone="violet" />
      <Stat icon={CalendarCheck} label="Attendance" value={s.attendance + '%'} tone="green" /><Stat icon={Award} label="Avg. grade" value={s.avgGrade + '%'} tone="amber" /></> : <>
      <Stat icon={BookOpen} label="Courses" value={s.courses} /><Stat icon={Users} label="Students" value={s.students} tone="violet" />
      <Stat icon={CalendarCheck} label="Avg. attendance" value={s.attendance + '%'} tone="green" /><Stat icon={ClipboardList} label="Needs grading" value={s.ungraded} tone="amber" /></>}
    </div>
    <h2 className="text-lg font-semibold mb-3">Course Dashboard</h2>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">{d.courses.map(c => <Link to={`/courses/${c.id}`} key={c.id} className="card overflow-hidden hover:shadow-md transition group">
      <div className="h-28 p-4 relative" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}bb)` }}><div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_20%,white,transparent_40%)]" /><span className="badge bg-white/25 text-white">{c.term}</span></div>
      <div className="p-4"><div className="text-xs font-semibold" style={{ color: c.color }}>{c.code}</div><div className="font-semibold text-slate-900 group-hover:underline">{c.name}</div><div className="text-sm text-slate-500 mt-1">{c.teacher?.name} · {c.studentCount} students</div>
        {student && <div className="mt-4 space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Progress {c.progress.done}/{c.progress.total} lessons</span><span>{c.progress.percent}%</span></div><Progress value={c.progress.percent} color={c.color} />
          <div className="flex justify-between text-xs pt-1"><span className="text-slate-500">Attendance <b className="text-slate-700">{c.attendance}%</b></span><span className="text-slate-500">Grade <b className={gradeColor(c.grade)}>{c.grade ?? '—'}{c.grade != null && '%'}</b></span></div></div>}</div>
    </Link>)}</div>
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="card p-5 lg:col-span-2"><h3 className="font-semibold mb-4">{student ? 'Performance by course' : 'Enrolment by course'}</h3>
        <div className="h-72"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
          {student ? <><Bar dataKey="Progress" fill="#6366f1" radius={[4, 4, 0, 0]} /><Bar dataKey="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Grade" fill="#f59e0b" radius={[4, 4, 0, 0]} /></> : <Bar dataKey="Students" fill="#2563eb" radius={[4, 4, 0, 0]} />}</BarChart></ResponsiveContainer></div></div>
      <div className="space-y-5">
        <div className="card p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><Clock size={16} />To Do</h3>{d.upcoming.length ? d.upcoming.map(a => <div key={a.id} className="py-2 border-b last:border-0 border-slate-100"><div className="text-sm font-medium">{a.title}</div><div className="text-xs text-slate-500 flex justify-between"><span>{a.course} · due {a.dueDate}</span>{student && <span className={a.submitted ? 'text-emerald-600' : 'text-amber-600'}>{a.submitted ? 'Submitted' : 'Pending'}</span>}</div></div>) : <p className="text-sm text-slate-500">Nothing due 🎉</p>}</div>
        <div className="card p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><Megaphone size={16} />Announcements</h3>{d.announcements.map(a => <div key={a.id} className="py-2 border-b last:border-0 border-slate-100"><div className="text-sm font-medium">{a.title}</div><div className="text-xs text-slate-500">{a.course} · {a.body}</div></div>)}</div>
      </div>
    </div>
  </div>;
}
