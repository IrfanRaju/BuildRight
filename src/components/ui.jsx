export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FF7518]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#101828]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'border-slate-200 bg-slate-50 text-slate-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
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
