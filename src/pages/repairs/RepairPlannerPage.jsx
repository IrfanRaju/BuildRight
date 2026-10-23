import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { compressImage } from '../../lib/images';
import { Field, Notice, PageHeader, buttonClass, ghostClass } from '../../components/ui';

const BUILDINGS = ['House', 'Apartment', 'Shop', 'Office', 'Plaza', 'Other'];
const CITIES = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Faisalabad', 'Gilgit-Baltistan'];

export default function RepairPlannerPage({ setPage }) {
  const { user } = useAuth();
  const { add } = useCart();
  const [services, setServices] = useState([]);
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceTotal, setServiceTotal] = useState(0);
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: 'Home repair', buildingType: 'House', location: 'Islamabad', budget: 150000, startDate: '', condition: 'moderate', quality: 'standard' });
  const [tasks, setTasks] = useState({});
  const [photos, setPhotos] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: '24' });
      if (serviceQuery.trim()) params.set('q', serviceQuery.trim());
      api(`/api/repairs/services?${params}`)
        .then((result) => { setServices(result.services || []); setServiceTotal(result.total || 0); setError(''); })
        .catch((requestError) => setError(requestError.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [serviceQuery]);

  const toggle = (slug) => setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);

  const taskPayload = () => selected.map((slug) => ({
    serviceSlug: slug,
    ...tasks[slug],
    condition: form.condition,
    quality: form.quality,
  }));

  const runEstimate = async () => {
    setError('');
    try {
      const result = await api('/api/repairs/estimate', { method: 'POST', body: { tasks: taskPayload(), location: form.location, materials: materialAdjustments() } });
      setEstimate(result.estimate);
      setStep(3);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const materialAdjustments = () => (estimate?.materials || []).map((line) => ({
    key: `${line.role}|${line.name}|${line.unit}`,
    role: line.role,
    quantity: line.quantity,
    productId: line.productId,
  }));

  const editMaterial = (index, patch) => {
    const materials = estimate.materials.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, ...patch };
      next.lineTotal = Math.round((Number(next.quantity) || 0) * (Number(next.unitPrice) || 0));
      return next;
    });
    setEstimate({ ...estimate, materials });
  };

  const refreshTotals = async () => {
    const result = await api('/api/repairs/estimate', { method: 'POST', body: { tasks: taskPayload(), location: form.location, materials: materialAdjustments() } });
    setEstimate(result.estimate);
  };

  const addMaterials = async () => {
    setError('');
    for (const line of estimate.materials.filter((item) => item.productId && item.quantity > 0)) {
      await add({ _id: line.productId, pricePkr: line.unitPrice, name: line.productName || line.name, unit: line.unit, brand: line.brand, priceUpdatedAt: line.priceUpdatedAt }, Math.max(1, Math.ceil(line.quantity)));
    }
    setPage('cart');
  };

  const save = async (requestTrade) => {
    if (!user) { setPage('login'); return; }
    setSaving(true);
    setError('');
    try {
      const project = await api('/api/repairs/projects', {
        method: 'POST',
        body: { ...form, tasks: taskPayload(), materials: materialAdjustments(), photos },
      });
      if (requestTrade) {
        await api('/api/repairs/requests', { method: 'POST', body: { projectId: project.project._id, trade: requestTrade, location: form.location, preferredDate: form.startDate, description: form.title } });
      }
      setPage('repair-project', project.project._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const onPhotos = async (event) => {
    const files = [...event.target.files].slice(0, 4 - photos.length);
    try {
      const next = [];
      for (const file of files) next.push({ dataUrl: await compressImage(file), caption: file.name, kind: 'existing' });
      setPhotos([...photos, ...next]);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Repair planner" title="Paint, repair, and renovate" description="Choose the work, estimate materials and labor, then order materials from the marketplace. A contractor is not booked unless you send a service request and it is accepted and confirmed." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4 flex gap-2 text-xs font-semibold">{['Services', 'Project', 'Estimate'].map((label, index) => <span key={label} className={`rounded-full px-3 py-1 ${step === index + 1 ? 'bg-[#FF7518] text-white' : 'bg-white text-slate-500'}`}>{index + 1}. {label}</span>)}</div>

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <input className="input" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search repair services, such as painting, wall cracks, or roof leakage" aria-label="Search repair services" />
            <p className="mt-2 text-xs text-slate-500">{serviceTotal} matching service{serviceTotal === 1 ? '' : 's'} from the database</p>
          </div>
          {services.map((service) => (
            <motion.button key={service.slug} type="button" whileHover={{ y: -3 }} onClick={() => toggle(service.slug)} className={`rounded-3xl border p-5 text-left ${selected.includes(service.slug) ? 'border-[#FF7518] bg-orange-50' : 'border-slate-200 bg-white'}`}>
              <h2 className="font-bold">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.summary}</p>
              <p className="mt-3 text-xs text-slate-500">{(service.tasks || []).join(' · ')}</p>
            </motion.button>
          ))}
          <div className="sm:col-span-2 lg:col-span-3"><button type="button" className={buttonClass} disabled={!selected.length} onClick={() => setStep(2)}>Continue</button></div>
        </div>
      )}

      {step === 2 && (
        <form className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); runEstimate(); }}>
          <Field label="Project name"><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
          <Field label="Building type"><select className="input" value={form.buildingType} onChange={(event) => setForm({ ...form, buildingType: event.target.value })}>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Location"><select className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}>{CITIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Budget (PKR)"><input className="input" type="number" min="0" value={form.budget} onChange={(event) => setForm({ ...form, budget: Number(event.target.value) })} /></Field>
          <Field label="Desired start"><input className="input" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="Current condition"><select className="input" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}><option value="minor">Minor damage</option><option value="moderate">Moderate damage</option><option value="major">Major damage</option></select></Field>
          <Field label="Material quality"><select className="input" value={form.quality} onChange={(event) => setForm({ ...form, quality: event.target.value })}><option value="economy">Economy</option><option value="standard">Standard</option><option value="premium">Premium</option><option value="luxury">Luxury</option></select></Field>
          <Field label="Photographs of the problem"><input className="input" type="file" accept="image/*" multiple onChange={onPhotos} /></Field>
          {photos.length > 0 && <div className="flex gap-2 md:col-span-2">{photos.map((photo) => <img key={photo.caption} src={photo.dataUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />)}</div>}
          {selected.map((slug) => {
            const service = services.find((item) => item.slug === slug);
            return (
              <fieldset key={slug} className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <legend className="px-1 font-bold">{service?.title}</legend>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {(service?.fields || []).map((field) => (
                    <label key={field.key} className="text-sm font-semibold">{field.label}{field.unit ? ` (${field.unit})` : ''}
                      <input className="input mt-1" type="number" min="0" value={tasks[slug]?.[field.key] ?? field.defaultValue ?? ''} onChange={(event) => setTasks({ ...tasks, [slug]: { ...tasks[slug], [field.key]: Number(event.target.value) } })} />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <div className="flex gap-3 md:col-span-2"><button type="button" className={ghostClass} onClick={() => setStep(1)}>Back</button><button className={buttonClass} type="submit">Estimate cost</button></div>
        </form>
      )}

      {step === 3 && estimate && (
        <section className="space-y-4">
          <Notice>{estimate.disclaimer}</Notice>
          <div className="grid gap-3 md:grid-cols-3">
            {[['Materials to purchase', estimate.materialCost], ['Labor, estimated separately', estimate.laborCost], ['Equipment', estimate.equipmentCost], ['Delivery', estimate.delivery], [estimate.taxLabel || 'Tax', estimate.tax], ['Contingency', estimate.contingency]].map(([label, value]) => (
              <div key={label} className="rounded-3xl bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{money(value)}</p></div>
            ))}
          </div>
          <div className="rounded-3xl bg-[#101828] p-5 text-white"><p className="text-sm text-slate-300">Total estimated budget</p><p className="text-3xl font-black">{money(estimate.total)}</p><p className="mt-2 text-sm text-slate-300">Material purchase, including delivery and tax on goods: {money(estimate.purchaseTotal)}. Labor is not included in that purchase.</p>{form.budget > 0 && <p className="mt-1 text-sm">Your budget is {money(form.budget)}.</p>}</div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="text-slate-500"><th className="pb-2">Material</th><th>Quantity</th><th>Brand</th><th>Unit price</th><th>Total</th></tr></thead>
              <tbody>
                {estimate.materials.map((line, index) => (
                  <tr key={`${line.role}-${line.name}`} className="border-t border-slate-100">
                    <td className="py-2">{line.name}{line.unmatched ? ' · no catalog price' : ''}</td>
                    <td><input className="input w-24" type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => editMaterial(index, { quantity: Number(event.target.value) })} /></td>
                    <td>{line.options?.length ? <select className="input" value={line.productId} onChange={(event) => { const option = line.options.find((item) => item._id === event.target.value); editMaterial(index, { productId: option._id, brand: option.brand, unitPrice: option.pricePkr, productName: option.name }); }}>{line.options.map((option) => <option key={option._id} value={option._id}>{option.brand}</option>)}</select> : '—'}</td>
                    <td>{line.unmatched ? '—' : money(line.unitPrice)}<div className="text-[11px] text-slate-400">{line.priceUpdatedAt ? new Date(line.priceUpdatedAt).toLocaleDateString() : ''}</div></td>
                    <td>{money(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="mt-3 text-sm font-semibold text-[#FF7518]" onClick={() => refreshTotals().catch((requestError) => setError(requestError.message))}>Recalculate totals</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={ghostClass} onClick={() => setStep(2)}>Back</button>
            <button type="button" className={buttonClass} onClick={() => addMaterials().catch((requestError) => setError(requestError.message))}>Add materials to cart</button>
            <button type="button" className={buttonClass} disabled={saving} onClick={() => save()}>Save project</button>
            <button type="button" className={ghostClass} disabled={saving} onClick={() => save('Painter')}>Request a painter</button>
            <button type="button" className={ghostClass} disabled={saving} onClick={() => save('Plumber')}>Request a plumber</button>
            <button type="button" className={ghostClass} disabled={saving} onClick={() => save('Electrician')}>Request an electrician</button>
          </div>
          <p className="text-xs leading-5 text-slate-500">Sending a request does not book a worker. The request stays open until a provider accepts it and you confirm.</p>
        </section>
      )}
    </div>
  );
}
