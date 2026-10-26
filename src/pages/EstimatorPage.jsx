import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, SearchableSelect, buttonClass, ghostClass } from '../components/ui';

const cities = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Faisalabad', 'Gilgit', 'Skardu', 'Hunza', 'Gilgit-Baltistan'];
const qualities = [
  { id: 'economy', label: 'Economy' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
  { id: 'luxury', label: 'Luxury' },
];
const categories = [
  { id: 'grey', label: 'Grey structure' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'turnkey', label: 'Turnkey' },
];

const initialForm = {
  projectName: 'North Ridge Residence',
  location: 'Islamabad',
  projectType: 'House',
  category: 'turnkey',
  plotArea: 10,
  plotUnit: 'marla',
  coveredArea: 1800,
  coveredUnit: 'sq ft',
  floors: 2,
  quality: 'standard',
  structureType: 'Framed RCC',
  preferences: 'Standard block masonry with ceramic tile floors',
  additional: '',
  overheadPercent: 8,
  contingencyPercent: 5,
  marginPercent: 0,
  autoMargin: true,
  taxPercent: 0,
  inflationPercent: 0,
  laborOverride: '',
  startDate: '',
};

export default function EstimatorPage({ setPage }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    const raw = sessionStorage.getItem('buildright-from-design');
    if (!raw) return undefined;
    sessionStorage.removeItem('buildright-from-design');
    try {
      const incoming = JSON.parse(raw);
      setForm((current) => ({
        ...current,
        projectName: incoming.projectName || current.projectName,
        location: incoming.location || current.location,
        projectType: incoming.projectType || current.projectType,
        plotArea: incoming.plotArea || current.plotArea,
        plotUnit: incoming.plotUnit || current.plotUnit,
        coveredArea: incoming.coveredArea || current.coveredArea,
        coveredUnit: incoming.coveredUnit || current.coveredUnit,
        floors: incoming.floors || current.floors,
        additional: incoming.note || current.additional,
      }));
      setStatus('Areas were copied from the design model. Beam, column, and foundation sizes are not in that model, so they are excluded.');
    } catch {
      setError('The design quantities could not be read.');
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api('/api/estimates').then((result) => { if (!cancelled) setSaved(result.estimates || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const pieData = useMemo(() => (estimate ? [
    { name: 'Materials', value: estimate.materialCost },
    { name: 'Labor', value: estimate.laborCost },
    { name: 'Equipment', value: estimate.equipmentCost },
    { name: 'Overhead', value: estimate.overhead },
    { name: 'Contingency', value: estimate.contingency },
  ].filter((item) => item.value > 0) : []), [estimate]);

  const calculate = async () => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const payload = {
        ...form,
        laborOverride: form.laborOverride === '' ? undefined : Number(form.laborOverride),
        marginPercent: form.autoMargin ? undefined : form.marginPercent,
        autoMargin: form.autoMargin,
        startDate: form.startDate || undefined,
      };
      const result = await api('/api/estimates/calculate', { method: 'POST', body: payload });
      setEstimate(result.estimate);
      setStep(5);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!user) {
      setPage('login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        laborOverride: form.laborOverride === '' ? undefined : Number(form.laborOverride),
        marginPercent: form.autoMargin ? undefined : form.marginPercent,
        autoMargin: form.autoMargin,
        startDate: form.startDate || undefined,
      };
      const result = await api('/api/estimates', { method: 'POST', body: payload });
      setEstimate(result.estimate.result);
      setSaved((current) => [result.estimate, ...current]);
      setStatus('Estimate saved with the rate snapshot used for this calculation.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const download = async (id) => {
    setError('');
    try {
      const blob = await api(`/api/estimates/${id}/report`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `buildright-estimate-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const compare = async () => {
    setError('');
    try {
      const result = await api('/api/estimates/compare', { method: 'POST', body: { ids: selected } });
      setComparison(result.comparison);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Estimator" title="Construction cost estimator" description="Quantities and costs are calculated on the server from database rates. Sample rates stay labeled as illustrative until you replace them." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {status && <div className="mb-4"><Notice tone="success">{status}</Notice></div>}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-6 flex flex-wrap gap-2">
          {['Project', 'Area', 'Quality', 'Adjustments', 'Results'].map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index + 1)} className={`rounded-full px-3 py-2 text-xs font-semibold ${step === index + 1 ? 'bg-[#FF7518] text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}. {label}</button>
          ))}
        </div>

        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Project name"><input className="input" value={form.projectName} onChange={(event) => setField('projectName', event.target.value)} /></Field>
            <Field label="City"><SearchableSelect value={form.location} onChange={(next) => setField('location', next)} options={cities} /></Field>
            <Field label="Project type"><SearchableSelect value={form.projectType} onChange={(next) => setField('projectType', next)} options={['House', 'Villa', 'Apartment', 'Plaza', 'Shop', 'Office', 'School', 'Hospital', 'Renovation']} /></Field>
            <Field label="Construction category"><SearchableSelect value={form.category} onChange={(next) => setField('category', next)} options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Plot area"><div className="flex gap-2"><input className="input" type="number" min="1" value={form.plotArea} onChange={(event) => setField('plotArea', Number(event.target.value))} /><SearchableSelect className="w-32" value={form.plotUnit} onChange={(next) => setField('plotUnit', next)} options={['marla', 'kanal', 'sq ft', 'sq m']} /></div></Field>
            <Field label="Covered area per floor"><div className="flex gap-2"><input className="input" type="number" min="1" value={form.coveredArea} onChange={(event) => setField('coveredArea', Number(event.target.value))} /><SearchableSelect className="w-32" value={form.coveredUnit} onChange={(next) => setField('coveredUnit', next)} options={['sq ft', 'sq m', 'marla']} /></div></Field>
            <Field label="Floors"><input className="input" type="number" min="1" max="40" value={form.floors} onChange={(event) => setField('floors', Number(event.target.value))} /></Field>
            <Field label="Structure"><input className="input" value={form.structureType} onChange={(event) => setField('structureType', event.target.value)} /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">{qualities.map((item) => <button key={item.id} type="button" onClick={() => setField('quality', item.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${form.quality === item.id ? 'border-[#FF7518] bg-orange-50 text-[#FF7518]' : 'border-slate-200'}`}>{item.label}</button>)}</div>
            <Field label="Structural and finishing preferences"><textarea className="input min-h-24" value={form.preferences} onChange={(event) => setField('preferences', event.target.value)} /></Field>
            <Field label="Optional requirements"><textarea className="input min-h-24" value={form.additional} onChange={(event) => setField('additional', event.target.value)} /></Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Overhead %"><input className="input" type="number" min="0" max="40" value={form.overheadPercent} onChange={(event) => setField('overheadPercent', Number(event.target.value))} /></Field>
            <Field label="Contingency %"><input className="input" type="number" min="0" max="40" value={form.contingencyPercent} onChange={(event) => setField('contingencyPercent', Number(event.target.value))} /></Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={form.autoMargin} onChange={(event) => setField('autoMargin', event.target.checked)} />
              Apply automatic contractor margin from admin Margin Rules (priority-based)
            </label>
            {!form.autoMargin && (
              <Field label="Contractor margin %"><input className="input" type="number" min="0" max="40" value={form.marginPercent} onChange={(event) => setField('marginPercent', Number(event.target.value))} /></Field>
            )}
            <Field label="Tax %"><input className="input" type="number" min="0" max="40" value={form.taxPercent} onChange={(event) => setField('taxPercent', Number(event.target.value))} /></Field>
            <Field label="Material inflation %"><input className="input" type="number" min="0" max="40" value={form.inflationPercent} onChange={(event) => setField('inflationPercent', Number(event.target.value))} /></Field>
            <Field label="Planned start date (for timeline)"><input className="input" type="date" value={form.startDate} onChange={(event) => setField('startDate', event.target.value)} /></Field>
            <Field label="Manual labor override (PKR, optional)"><input className="input" type="number" min="0" value={form.laborOverride} onChange={(event) => setField('laborOverride', event.target.value)} placeholder="Leave empty to calculate labor" /></Field>
          </div>
        )}

        {step === 5 && !estimate && <EmptyState title="No result yet" text="Go back and calculate. The server will apply the current rate book and return the breakdown." />}

        {step === 5 && estimate && (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl bg-[#101828] p-6 text-white">
                <div className="text-xs uppercase tracking-[0.16em] text-orange-200">{estimate.illustrative ? 'Illustrative total' : 'Configured total'}</div>
                <div className="mt-3 text-4xl font-black">{money(estimate.total)}</div>
                <p className="mt-2 text-sm text-slate-300">{money(estimate.costPerSqFt)} per sq ft · {estimate.timelineLabel}</p>
                {estimate.marginResolution && (
                  <p className="mt-2 text-xs text-orange-200">Margin {estimate.marginResolution.percent}% · {estimate.marginResolution.source}</p>
                )}
                {estimate.regionalAdjustment && (
                  <p className="mt-1 text-xs text-slate-400">Regional ×{estimate.regionalAdjustment.multiplier} ({estimate.regionalAdjustment.city})</p>
                )}
                <p className="mt-4 text-xs leading-5 text-slate-400">{estimate.limitations}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-6 text-sm">
                {[['Materials', estimate.materialCost], ['Labor', estimate.laborCost], ['Equipment', estimate.equipmentCost], ['Overhead', estimate.overhead], ['Margin', estimate.contractorMargin], ['Contingency', estimate.contingency], ['Tax', estimate.tax]].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-slate-100 py-2"><span>{label}</span><strong>{money(value)}</strong></div>
                ))}
              </div>
            </div>
            {estimate.timeline?.phases?.length > 0 && (
              <div className="rounded-3xl border border-slate-200 p-5">
                <h2 className="font-bold">Indicative construction schedule</h2>
                <p className="mt-1 text-xs text-slate-500">{estimate.timeline.estimateLabel}. {estimate.timeline.completionDate ? `Completion ${estimate.timeline.completionDate}` : 'Add a start date to see calendar dates.'}</p>
                <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {estimate.timeline.phases.map((phase) => (
                    <div key={phase.key} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                      <strong>{phase.label}</strong>
                      <p className="text-xs text-slate-500">{phase.durationDays} days{phase.overlapsPrevious ? ' · overlaps previous' : ''}</p>
                      {phase.startDate && <p className="text-xs text-slate-500">{phase.startDate} → {phase.endDate}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-5 lg:grid-cols-2">
              {estimate.grey && <ScopeCard title="Grey structure" scope={estimate.grey} />}
              {estimate.finishing && <ScopeCard title="Finishing" scope={estimate.finishing} />}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-x-auto rounded-3xl border border-slate-200 p-4">
                <h2 className="mb-3 font-bold">Material quantities</h2>
                <table className="min-w-full text-left text-sm">
                  <thead><tr className="text-slate-500"><th className="pb-2">Material</th><th>Qty</th><th>Unit</th><th>Cost</th></tr></thead>
                  <tbody>
                    {estimate.lines.map((line) => <tr key={line.code} className="border-t border-slate-100"><td className="py-2">{line.name}</td><td>{line.quantity}</td><td>{line.unit}</td><td>{money(line.cost)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="h-72 rounded-3xl border border-slate-200 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80}>
                      {pieData.map((entry, index) => <Cell key={entry.name} fill={['#FF7518', '#101828', '#fdba74', '#94a3b8', '#64748b'][index % 5]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoList title="Assumptions" items={estimate.assumptions} />
              <InfoList title="Exclusions" items={estimate.exclusions} />
            </div>
            <p className="text-xs leading-5 text-slate-500">Rate source: {estimate.source}. Last updated: {estimate.rateUpdatedAt ? new Date(estimate.rateUpdatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'unknown'}.</p>
            {estimate.warnings?.length > 0 && <Notice>{estimate.warnings.join(' ')}</Notice>}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <button type="button" className={ghostClass} onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>Back</button>
          <div className="flex flex-wrap gap-2">
            {step === 5 && <button type="button" className={ghostClass} onClick={save} disabled={loading}>{user ? 'Save estimate' : 'Sign in to save'}</button>}
            {step < 5 && <button type="button" className={buttonClass} onClick={() => setStep((value) => value + 1)}>Next</button>}
            {step >= 4 && <button type="button" className={buttonClass} onClick={calculate} disabled={loading}>{loading ? 'Calculating…' : 'Calculate'}</button>}
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold">Saved scenarios</h2>
        {!user && <p className="mt-2 text-sm text-slate-600">Sign in to save, compare, and export PDF reports.</p>}
        {user && saved.length === 0 && <p className="mt-2 text-sm text-slate-600">No saved estimates yet.</p>}
        <div className="mt-4 space-y-3">
          {saved.map((item) => (
            <label key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <span className="flex items-center gap-3"><input type="checkbox" checked={selected.includes(item._id)} onChange={() => setSelected((current) => current.includes(item._id) ? current.filter((id) => id !== item._id) : [...current, item._id].slice(-3))} /> <span><strong>{item.title}</strong><span className="block text-xs text-slate-500">{item.result?.input?.category} · {item.result?.input?.quality}</span></span></span>
              <span className="flex items-center gap-3"><strong>{money(item.result?.total)}</strong><button type="button" className="text-[#FF7518]" onClick={() => download(item._id)}>PDF</button></span>
            </label>
          ))}
        </div>
        {selected.length >= 2 && <button type="button" className={`${buttonClass} mt-4`} onClick={compare}>Compare selected</button>}
        {comparison && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="text-slate-500"><th className="py-2">Scenario</th><th>Total</th><th>Per sq ft</th><th>Area</th></tr></thead>
              <tbody>{comparison.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="py-2">{item.title}</td><td>{money(item.total)}</td><td>{money(item.costPerSqFt)}</td><td>{item.builtUpSqFt} sq ft</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ScopeCard({ title, scope }) {
  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-2xl font-black text-[#101828]">{money(scope.total)}</p>
      <p className="mt-2 text-sm text-slate-600">Materials {money(scope.materialCost)} · Labor {money(scope.laborCost)} · Equipment {money(scope.equipmentCost)}</p>
    </div>
  );
}

function InfoList({ title, items }) {
  return (
    <div>
      <h2 className="font-bold">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}
