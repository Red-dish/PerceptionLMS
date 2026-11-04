import { X } from 'lucide-react';
export const Progress = ({ value, color = '#2563eb', h = 'h-2' }) => <div className={`w-full bg-slate-100 rounded-full ${h} overflow-hidden`}><div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} /></div>;
export const Avatar = ({ user, size = 9 }) => user?.avatar ? <img src={user.avatar} style={{width:size*4,height:size*4}} className="rounded-full object-cover" /> :
  <div style={{width:size*4,height:size*4}} className={`rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center text-xs font-semibold shrink-0`}>{user?.name?.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>;
export const Stat = ({ icon: Icon, label, value, tone = 'blue' }) => {
  const tones = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600' };
  return <div className="card p-5 flex items-center gap-4"><div className={`w-12 h-12 rounded-xl grid place-items-center ${tones[tone]}`}><Icon size={22} /></div><div><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-sm text-slate-500">{label}</div></div></div>;
};
export const Modal = ({ open, onClose, title, children }) => !open ? null :
  <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={onClose}><div className="card w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
    <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
export const PageHeader = ({ title, sub, children }) => <div className="flex flex-wrap items-end justify-between gap-3 mb-6"><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}</div><div className="flex gap-2">{children}</div></div>;
export const statusStyle = { present: 'bg-emerald-100 text-emerald-700', late: 'bg-amber-100 text-amber-700', absent: 'bg-red-100 text-red-700', excused: 'bg-slate-200 text-slate-700' };
export const gradeColor = g => g == null ? 'text-slate-400' : g >= 85 ? 'text-emerald-600' : g >= 70 ? 'text-blue-600' : g >= 50 ? 'text-amber-600' : 'text-red-600';
