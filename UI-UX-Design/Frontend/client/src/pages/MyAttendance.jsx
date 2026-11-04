import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../api'; import { PageHeader } from '../components/ui';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
const COLORS = { present: '#10b981', late: '#f59e0b', absent: '#ef4444', excused: '#94a3b8' };
export default function MyAttendance() {
  const [d, setD] = useState([]); useEffect(() => { api.get('/me/attendance').then(setD); }, []);
  return <div><PageHeader title="Attendance" sub="Your attendance across all courses. 75% minimum required." />
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{d.map(r => { const data = ['present', 'late', 'absent', 'excused'].map(k => ({ name: k, value: r[k] })).filter(x => x.value); return <Link to={`/courses/${r.course.id}/attendance`} key={r.course.id} className="card p-5 hover:shadow-md">
      <div className="text-xs font-semibold" style={{ color: r.course.color }}>{r.course.code}</div><div className="font-semibold">{r.course.name}</div>
      <div className="h-44 relative"><ResponsiveContainer><PieChart><Pie data={data} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2}>{data.map(x => <Cell key={x.name} fill={COLORS[x.name]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className={`text-2xl font-bold ${r.percent < 75 ? 'text-red-600' : 'text-slate-900'}`}>{r.percent}%</div></div></div>
      <div className="flex justify-between text-xs">{Object.keys(COLORS).map(k => <span key={k} className="flex items-center gap-1 capitalize"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[k] }} />{k} {r[k]}</span>)}</div></Link>; })}</div></div>;
}
