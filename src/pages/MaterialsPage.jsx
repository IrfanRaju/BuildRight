import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, buttonClass } from '../components/ui';

const categories = ['All', 'Binders', 'Structural', 'Masonry', 'Aggregates', 'Finishing', 'Plumbing', 'Electrical'];

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('name');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '48', sort });
    if (query) params.set('q', query);
    if (category !== 'All') params.set('category', category);
    api(`/api/materials?${params}`)
      .then((result) => { setMaterials(result.materials || []); setError(''); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [category, sort]);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (draft._id) await api(`/api/materials/${draft._id}`, { method: 'PUT', body: draft });
      else await api('/api/materials', { method: 'POST', body: draft });
      setDraft(null);
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Materials" title="Construction rate catalog" description="Rates are stored in MongoDB with a source and an effective date. Seeded values are illustrative sample rates, not live market prices." actions={user?.role === 'admin' ? <button type="button" className={buttonClass} onClick={() => setDraft({ code: '', name: '', category: 'Binders', unit: 'bag', scope: 'grey', perSqFt: 0.1, rate: 0, quality: 'standard', location: 'Islamabad', supplier: '', source: 'Administrator entry', illustrative: true })}>Add rate</button> : null} />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input className="input lg:max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} placeholder="Search materials" aria-label="Search materials" />
          <button type="button" className={buttonClass} onClick={load}>Search</button>
          <select className="input lg:ml-auto lg:w-48" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort materials">
            <option value="name">Name</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === item ? 'bg-[#FF7518] text-white' : 'bg-slate-100 text-slate-600'}`}>{item}</button>)}</div>
        {loading && <p className="mt-6 text-sm text-slate-500">Loading rates…</p>}
        {!loading && materials.length === 0 && <div className="mt-6"><EmptyState title="No rates found" text="Start MongoDB and run npm run seed, or change the filters." /></div>}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => (
            <article key={material._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              {material.imageUrl && <img src={material.imageUrl} alt="" className="h-36 w-full object-cover" />}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{material.name}</h2>
                    <p className="text-xs uppercase tracking-wider text-slate-500">{material.category} · {material.location}{material.brand ? ` · ${material.brand}` : ''}</p>
                  </div>
                  {material.illustrative && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Illustrative</span>}
                </div>
                <p className="mt-4 text-2xl font-black">{money(material.rate)}</p>
                <p className="text-xs text-slate-500">per {material.unit} · {material.quality} · {material.scope}</p>
                {material.previousPrice != null && <p className="text-xs text-slate-400">Previous {money(material.previousPrice)}</p>}
                <p className="mt-3 text-xs leading-5 text-slate-500">{material.source}</p>
                <p className="mt-1 text-xs text-slate-400">Updated {new Date(material.lastPriceUpdate || material.updatedAt || material.effectiveFrom).toLocaleDateString()}{material.supplier ? ` · ${material.supplier}` : ''}</p>
                {user?.role === 'admin' && (
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="text-sm font-semibold text-[#FF7518]" onClick={() => setDraft(material)}>Edit rate</button>
                    <button type="button" className="text-sm font-semibold text-red-600" onClick={async () => { if (!window.confirm('Delete this rate?')) return; try { await api(`/api/materials/${material._id}`, { method: 'DELETE' }); load(); } catch (requestError) { setError(requestError.message); } }}>Delete</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      {draft && (
        <form onSubmit={save} className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          {['code', 'name', 'category', 'unit', 'location', 'supplier', 'source'].map((field) => (
            <Field key={field} label={field}><input className="input" value={draft[field] || ''} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} required={field !== 'supplier'} /></Field>
          ))}
          <Field label="Rate PKR"><input className="input" type="number" min="0" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: Number(event.target.value) })} /></Field>
          <Field label="Quantity per sq ft"><input className="input" type="number" min="0" step="0.001" value={draft.perSqFt} onChange={(event) => setDraft({ ...draft, perSqFt: Number(event.target.value) })} /></Field>
          <Field label="Scope"><select className="input" value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })}><option value="grey">grey</option><option value="finishing">finishing</option></select></Field>
          <div className="flex items-end gap-3"><button className={buttonClass} type="submit">Save rate</button><button type="button" className="text-sm text-slate-500" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
