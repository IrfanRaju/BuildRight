export function PageHeader({ eyebrow, title, description, actions, variant = 'marketing' }) {
  if (variant === 'portal') {
    return (
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF7518]">{eyebrow}</p>}
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    );
  }

  return (
    <div data-page-header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FF7518]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#101828]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function PortalCard({ children, className = '', padding = true }) {
  return (
    <div className={`rounded-xl border border-slate-200/90 bg-white shadow-sm ${padding ? 'p-4 sm:p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <PortalCard>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </PortalCard>
  );
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'border-slate-200 bg-slate-50 text-slate-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, children, error }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const buttonClass = 'rounded-full bg-[#FF7518] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60';
export const ghostClass = 'rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200';
export const portalButtonClass = 'rounded-lg bg-[#FF7518] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60';
export const portalGhostClass = 'rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50/40';

export { default as SearchableSelect, normalizeSelectOptions } from './SearchableSelect';
