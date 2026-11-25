import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-brand-muted sm:text-base">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const statTones = {
  blue: 'bg-brand-mint text-brand-forest',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  violet: 'bg-violet-50 text-violet-700',
};

export function Stat({ icon: Icon, label, value, tone = 'blue' }) {
  return (
    <div className="card flex min-h-36 flex-col justify-between gap-4 p-5">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${statTones[tone] || statTones.blue}`}>
        <Icon size={21} aria-hidden="true" />
      </div>
      <div>
        <div className="font-display text-3xl font-semibold leading-tight text-brand-ink">{value}</div>
        <div className="mt-1 text-sm text-brand-muted">{label}</div>
      </div>
    </div>
  );
}

export function Avatar({ name = 'User' }) {
  const initials = String(name).trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-mint text-xs font-bold text-brand-forest" aria-hidden="true">
      {initials}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div role="status" className="py-6 text-sm text-brand-muted">{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span>{error.message ?? error}</span>
      {onRetry && <button type="button" className="shrink-0 font-semibold underline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="py-3 text-sm text-brand-muted">{children}</p>;
}

export function Modal({ open, onClose, title, children }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-ink/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card w-full max-w-lg p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-brand-mint"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
