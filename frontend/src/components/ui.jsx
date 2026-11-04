import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const statTones = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
};

export function Stat({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${statTones[tone]}`}>
        <Icon size={22} aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function Avatar({ name }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center text-xs font-semibold shrink-0"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div role="status" className="text-slate-500 text-sm py-6">{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 flex items-center justify-between gap-3">
      <span>{error.message ?? error}</span>
      {onRetry && <button type="button" className="font-medium underline shrink-0" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-slate-500 py-3">{children}</p>;
}

export function Modal({ open, onClose, title, children }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card w-full max-w-lg p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
