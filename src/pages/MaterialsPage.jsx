import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, MapPin, Pencil, Trash2 } from 'lucide-react';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, SearchableSelect, portalButtonClass, portalGhostClass } from '../components/ui';

const categories = ['All', 'Binders', 'Structural', 'Masonry', 'Aggregates', 'Finishing', 'Plumbing', 'Electrical'];

export default function MaterialsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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

  const remove = async (material) => {
    if (!window.confirm(`Delete rate for “${material.name}”?`)) return;
    try {
      await api(`/api/materials/${material._id}`, { method: 'DELETE' });
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 lg:px-6">
      <PageHeader
        variant={user ? 'portal' : 'marketing'}
        eyebrow="Materials"
        title="Construction rate catalog"
        description="Rates are stored in MongoDB with a source and an effective date. Seeded values are illustrative sample rates, not live market prices."
        actions={isAdmin ? (
          <button
            type="button"
            className={portalButtonClass}
            onClick={() => setDraft({
              code: '', name: '', category: 'Binders', unit: 'bag', scope: 'grey', perSqFt: 0.1, rate: 0,
              quality: 'standard', location: 'Islamabad', supplier: '', source: 'Administrator entry', illustrative: true,
            })}
          >
            Add rate
          </button>
        ) : null}
      />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            className="input lg:max-w-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') load(); }}
            placeholder="Search materials"
            aria-label="Search materials"
          />
          <button type="button" className={portalButtonClass} onClick={load}>Search</button>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500 lg:ml-auto">
            Sort by
            <SearchableSelect
              className="w-44"
              triggerClassName="!py-2 !text-sm !text-slate-800"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'name', label: 'Name' },
                { value: 'price-asc', label: 'Price: low to high' },
                { value: 'price-desc', label: 'Price: high to low' },
              ]}
              aria-label="Sort materials"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                category === item
                  ? 'bg-[#FF7518] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading rates…</p>}
        {!loading && materials.length === 0 && (
          <div className="mt-6"><EmptyState title="No rates found" text="Start MongoDB and run npm run seed, or change the filters." /></div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => {
            const previous = material.previousPrice;
            const delta = previous != null && Number.isFinite(Number(previous)) ? material.rate - Number(previous) : null;
            const updated = new Date(material.lastPriceUpdate || material.updatedAt || material.effectiveFrom).toLocaleDateString();

            return (
              <article
                key={material._id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                {material.imageUrl ? (
                  <div className="h-36 overflow-hidden bg-slate-100">
                    <img src={material.imageUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  </div>
                ) : (
                  <div className="flex h-16 items-center border-b border-slate-100 bg-slate-50 px-4">
                    <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">
                      {material.category}
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold tracking-tight text-slate-900">{material.name}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        <span>{material.category}</span>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-0.5 normal-case tracking-normal text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {material.location}
                        </span>
                        {material.brand ? (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>{material.brand}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {material.illustrative && (
                      <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                        Illustrative
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{money(material.rate)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          per {material.unit}
                          <span className="mx-1 text-slate-300">·</span>
                          {material.quality}
                          <span className="mx-1 text-slate-300">·</span>
                          {material.scope}
                        </p>
                      </div>
                      {delta != null && delta !== 0 && (
                        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] font-semibold ${
                          delta > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {money(Math.abs(delta))}
                        </span>
                      )}
                    </div>
                    {previous != null && (
                      <p className="mt-2 text-[11px] text-slate-400">Previous {money(previous)}</p>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{material.source}</p>
                  <p className="mt-auto pt-3 text-[11px] text-slate-400">
                    Updated {updated}
                    {material.supplier ? ` · ${material.supplier}` : ''}
                  </p>

                  {isAdmin && (
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-[#FF7518]"
                        onClick={() => setDraft(material)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit rate
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                        onClick={() => remove(material)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {draft && (
        <form onSubmit={save} className="mt-5 grid gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <h3 className="text-sm font-bold text-slate-900">{draft._id ? 'Edit rate' : 'Add rate'}</h3>
            <p className="mt-1 text-xs text-slate-500">Changes save to the catalog and are used by the cost estimator.</p>
          </div>
          {['code', 'name', 'category', 'unit', 'location', 'supplier', 'source'].map((field) => (
            <Field key={field} label={field}>
              <input
                className="input"
                value={draft[field] || ''}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                required={field !== 'supplier'}
              />
            </Field>
          ))}
          <Field label="Rate PKR">
            <input className="input" type="number" min="0" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: Number(event.target.value) })} />
          </Field>
          <Field label="Quantity per sq ft">
            <input className="input" type="number" min="0" step="0.001" value={draft.perSqFt} onChange={(event) => setDraft({ ...draft, perSqFt: Number(event.target.value) })} />
          </Field>
          <Field label="Scope">
            <SearchableSelect
              value={draft.scope}
              onChange={(next) => setDraft({ ...draft, scope: next })}
              options={[
                { value: 'grey', label: 'grey' },
                { value: 'finishing', label: 'finishing' },
              ]}
            />
          </Field>
          <div className="flex items-end gap-3 md:col-span-2">
            <button className={portalButtonClass} type="submit">Save rate</button>
            <button type="button" className={portalGhostClass} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
