import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, SearchableSelect, buttonClass, ghostClass } from '../components/ui';
import ImageUpload from '../components/ImageUpload';
import CommerceAdmin from './admin/CommerceAdmin';

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials', label: 'Materials Management' },
  { id: 'prices', label: 'Price Management' },
  { id: 'regional', label: 'Regional Rates' },
  { id: 'labor', label: 'Labor Rates' },
  { id: 'margins', label: 'Margin Rules' },
  { id: 'quantities', label: 'Quantity Rules' },
  { id: 'estimates', label: 'Project Estimates' },
  { id: 'uploads', label: 'Image Uploads' },
  { id: 'catalog', label: 'Marketplace Catalog' },
  { id: 'orders', label: 'Orders' },
  { id: 'repairs', label: 'Repairs' },
  { id: 'providers', label: 'Providers' },
  { id: 'users', label: 'Users' },
  { id: 'messages', label: 'Messages' },
  { id: 'audit', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
];

const emptyMaterial = {
  code: '',
  name: '',
  category: 'Binders',
  brand: '',
  description: '',
  unit: 'bag',
  scope: 'grey',
  perSqFt: 0.1,
  rate: 0,
  stockQuantity: 0,
  availability: 'in_stock',
  quality: 'standard',
  location: 'Islamabad',
  supplier: '',
  source: 'Administrator entry',
  imageUrl: '',
  galleryImages: [],
  priceIncludesTransport: false,
  illustrative: true,
};

export default function AdminPage({ setPage }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [materials, setMaterials] = useState([]);
  const [regional, setRegional] = useState([]);
  const [labor, setLabor] = useState([]);
  const [margins, setMargins] = useState([]);
  const [quantities, setQuantities] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [draft, setDraft] = useState(null);
  const [materialQuery, setMaterialQuery] = useState('');

  const commerceTabs = ['catalog', 'orders', 'repairs', 'providers'];

  const loadOverview = () => api('/api/admin/overview').then(setData).catch((err) => setError(err.message));
  const loadUsers = () => api('/api/admin/users').then(setData).catch((err) => setError(err.message));
  const loadMessages = () => api('/api/admin/messages').then(setData).catch((err) => setError(err.message));
  const loadAudit = () => api('/api/admin/audit').then(setData).catch((err) => setError(err.message));
  const loadSettings = () => api('/api/admin/settings').then(setData).catch((err) => setError(err.message));

  const loadMaterials = () => api('/api/materials?limit=48').then((result) => setMaterials(result.materials || [])).catch((err) => setError(err.message));
  const loadRegional = () => api('/api/regional-rates').then((result) => setRegional(result.rates || [])).catch((err) => setError(err.message));
  const loadLabor = () => api('/api/labor-rates').then((result) => setLabor(result.rates || [])).catch((err) => setError(err.message));
  const loadMargins = () => api('/api/margin-rules').then((result) => setMargins(result.rules || [])).catch((err) => setError(err.message));
  const loadQuantities = () => api('/api/quantity-rules').then((result) => setQuantities(result.rules || [])).catch((err) => setError(err.message));
  const loadEstimates = () => api('/api/admin/estimates?limit=48').then((result) => setEstimates(result.estimates || [])).catch((err) => setError(err.message));
  const loadUploads = () => api('/api/uploads').then((result) => setUploads(result.images || [])).catch((err) => setError(err.message));
  const loadPrices = () => Promise.all([
    api('/api/materials?limit=48&sort=price-desc'),
    api('/api/price-history?limit=30'),
  ]).then(([mats, history]) => {
    setMaterials(mats.materials || []);
    setPriceHistory(history.entries || []);
  }).catch((err) => setError(err.message));

  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    setError('');
    setStatus('');
    setDraft(null);
    if (commerceTabs.includes(tab)) return undefined;
    if (tab === 'overview') loadOverview();
    if (tab === 'users') loadUsers();
    if (tab === 'messages') loadMessages();
    if (tab === 'audit') loadAudit();
    if (tab === 'settings') loadSettings();
    if (tab === 'materials') loadMaterials();
    if (tab === 'prices') loadPrices();
    if (tab === 'regional') loadRegional();
    if (tab === 'labor') loadLabor();
    if (tab === 'margins') loadMargins();
    if (tab === 'quantities') loadQuantities();
    if (tab === 'estimates') loadEstimates();
    if (tab === 'uploads') loadUploads();
    return undefined;
  }, [tab, user]);

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((item) => `${item.name} ${item.code} ${item.category} ${item.location}`.toLowerCase().includes(q));
  }, [materials, materialQuery]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title="Admin sign-in required" text="This area checks the role on the server." action={<button className={buttonClass} type="button" onClick={() => setPage('login')}>Sign in</button>} />
      </div>
    );
  }
  if (user.role !== 'admin') {
    return <div className="mx-auto max-w-3xl px-4 py-8"><Notice tone="error">Your account does not have administrator access.</Notice></div>;
  }

  const saveMaterial = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (draft._id) await api(`/api/materials/${draft._id}`, { method: 'PUT', body: draft });
      else await api('/api/materials', { method: 'POST', body: draft });
      setDraft(null);
      setStatus('Material saved. Future estimates will use the updated database values.');
      loadMaterials();
      if (tab === 'prices') loadPrices();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('Delete this material rate?')) return;
    try {
      await api(`/api/materials/${id}`, { method: 'DELETE' });
      setStatus('Material deleted.');
      loadMaterials();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 lg:px-6">
      <PageHeader variant="portal" eyebrow="Admin" title="Control center" description="Manage materials, regional multipliers, labor, margins, uploads, and estimates. Mutations require an admin JWT." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {status && <div className="mb-4"><Notice tone="success">{status}</Notice></div>}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-[4.5rem]">
          <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === item.id ? 'bg-[#0B1220] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {commerceTabs.includes(tab) && <CommerceAdmin tab={tab} />}

          {tab === 'overview' && data?.counts && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Materials', data.counts.materials],
                  ['Active services', data.counts.activeServices],
                  ['Estimates', data.counts.estimates],
                  ['Prices updated (7d)', data.counts.recentPriceUpdates],
                  ['Regional coverage', data.counts.regionalCoverage],
                  ['Labor rates', data.counts.laborRates],
                  ['Marketplace SKUs', data.counts.products],
                  ['Open repair requests', data.counts.openRequests],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black">{value ?? 0}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h2 className="mb-3 font-bold">Price-change activity (30 days)</h2>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.priceChart || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide />
                        <YAxis allowDecimals={false} width={28} />
                        <Tooltip />
                        <Area type="monotone" dataKey="changes" stroke="#FF7518" fill="#ffedd5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h2 className="mb-3 font-bold">Recent admin activity</h2>
                  <div className="max-h-56 space-y-2 overflow-auto text-sm">
                    {(data.recentActivity || []).map((log) => (
                      <p key={log._id} className="rounded-xl bg-slate-50 px-3 py-2">{log.action} · {log.entity} <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span></p>
                    ))}
                    {(data.recentActivity || []).length === 0 && <EmptyState title="No activity yet" text="Price edits and uploads will appear here." />}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-bold">Recent price history</h2>
                <div className="space-y-2 text-sm">
                  {(data.priceHistory || []).slice(0, 10).map((entry) => (
                    <p key={entry._id} className="rounded-xl bg-slate-50 px-3 py-2">
                      {entry.entityType} · {entry.field}: {entry.previousValue ?? '—'} → {entry.newValue}
                      <span className="text-xs text-slate-400"> · {entry.changedByEmail || 'admin'} · {new Date(entry.createdAt).toLocaleString()}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'materials' && (
            <ConfigPanel
              title="Materials management"
              actionLabel="Add material"
              onAdd={() => setDraft({ ...emptyMaterial })}
              search={materialQuery}
              onSearch={setMaterialQuery}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredMaterials.map((item) => (
                  <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    {item.imageUrl && <img src={item.imageUrl} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" />}
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="text-xs uppercase text-slate-500">{item.category} · {item.location}</p>
                    <p className="mt-2 text-xl font-black">{money(item.rate)}</p>
                    <p className="text-xs text-slate-500">prev {item.previousPrice != null ? money(item.previousPrice) : '—'} · stock {item.stockQuantity ?? 0}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="text-sm font-semibold text-[#FF7518]" onClick={() => setDraft(item)}>Edit</button>
                      <button type="button" className="text-sm font-semibold text-red-600" onClick={() => deleteMaterial(item._id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </ConfigPanel>
          )}

          {tab === 'prices' && (
            <div className="space-y-4">
              <ConfigPanel title="Price management" actionLabel="Edit from materials" onAdd={() => setTab('materials')}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead><tr className="text-slate-500"><th className="py-2">Material</th><th>City</th><th>Current</th><th>Previous</th><th>Updated</th><th /></tr></thead>
                    <tbody>
                      {materials.map((item) => (
                        <tr key={item._id} className="border-t border-slate-100">
                          <td className="py-2">{item.name}</td>
                          <td>{item.location}</td>
                          <td>{money(item.rate)}</td>
                          <td>{item.previousPrice != null ? money(item.previousPrice) : '—'}</td>
                          <td>{new Date(item.lastPriceUpdate || item.updatedAt).toLocaleDateString()}</td>
                          <td><button type="button" className="text-[#FF7518]" onClick={() => setDraft(item)}>Update</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ConfigPanel>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-bold">Price history audit</h2>
                {(priceHistory || []).map((entry) => (
                  <p key={entry._id} className="border-b border-slate-100 py-2 text-sm">
                    {entry.changedByEmail || 'admin'} changed {entry.entityType} {entry.field} from {entry.previousValue ?? '—'} to {entry.newValue} on {new Date(entry.createdAt).toLocaleString()}
                    {entry.note ? ` (${entry.note})` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          {tab === 'regional' && (
            <CrudTable
              title="Regional rates"
              rows={regional}
              columns={[
                ['city', 'City'],
                ['region', 'Region'],
                ['multiplier', 'Multiplier'],
                ['transportAdjustment', 'Transport'],
                ['active', 'Active'],
              ]}
              onAdd={() => setDraft({ city: '', region: '', multiplier: 1, transportAdjustment: 0, notes: '', active: true, _kind: 'regional' })}
              onEdit={(row) => setDraft({ ...row, _kind: 'regional' })}
              onDelete={async (row) => {
                if (!window.confirm(`Delete ${row.city}?`)) return;
                await api(`/api/regional-rates/${row._id}`, { method: 'DELETE' });
                loadRegional();
              }}
            />
          )}

          {tab === 'labor' && (
            <CrudTable
              title="Labor rates"
              rows={labor}
              columns={[
                ['location', 'City'],
                ['skill', 'Skill'],
                ['unit', 'Unit'],
                ['ratePerSqFt', 'Rate'],
                ['scope', 'Scope'],
                ['kind', 'Kind'],
              ]}
              onAdd={() => setDraft({ location: 'Islamabad', skill: 'mason', unit: 'daily', ratePerSqFt: 0, rate: 0, scope: 'any', kind: 'labor', quality: 'standard', source: 'Administrator entry', _kind: 'labor' })}
              onEdit={(row) => setDraft({ ...row, _kind: 'labor' })}
              onDelete={async (row) => {
                if (!window.confirm('Delete this labor rate?')) return;
                await api(`/api/labor-rates/${row._id}`, { method: 'DELETE' });
                loadLabor();
              }}
            />
          )}

          {tab === 'margins' && (
            <CrudTable
              title="Margin rules"
              rows={margins}
              columns={[
                ['name', 'Name'],
                ['projectType', 'Type'],
                ['quality', 'Quality'],
                ['projectSize', 'Size'],
                ['marginPercent', 'Margin %'],
                ['priority', 'Priority'],
              ]}
              onAdd={() => setDraft({ name: '', projectType: '*', quality: '*', projectSize: 'any', marginPercent: 10, priority: 100, minCoveredArea: 0, active: true, _kind: 'margin' })}
              onEdit={(row) => setDraft({ ...row, _kind: 'margin' })}
              onDelete={async (row) => {
                if (!window.confirm('Delete this margin rule?')) return;
                await api(`/api/margin-rules/${row._id}`, { method: 'DELETE' });
                loadMargins();
              }}
            />
          )}

          {tab === 'quantities' && (
            <CrudTable
              title="Quantity rules"
              rows={quantities}
              columns={[
                ['code', 'Code'],
                ['name', 'Name'],
                ['buildingType', 'Building'],
                ['perSqFt', 'Per sq ft'],
                ['scope', 'Scope'],
                ['quality', 'Quality'],
              ]}
              onAdd={() => setDraft({ code: '', name: '', category: 'Binders', unit: 'bag', scope: 'grey', buildingType: '*', quality: '*', perSqFt: 0.1, floorFactor: 0, active: true, _kind: 'quantity' })}
              onEdit={(row) => setDraft({ ...row, _kind: 'quantity' })}
              onDelete={async (row) => {
                if (!window.confirm('Delete this quantity rule?')) return;
                await api(`/api/quantity-rules/${row._id}`, { method: 'DELETE' });
                loadQuantities();
              }}
            />
          )}

          {tab === 'estimates' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-bold">Recent project estimates</h2>
              {(estimates || []).length === 0 && <EmptyState title="No estimates yet" text="Saved estimates will list here after users calculate and save." />}
              <div className="space-y-2">
                {(estimates || []).map((item) => (
                  <div key={item._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <span><strong>{item.title}</strong> · {item.input?.location || '—'} · {new Date(item.createdAt).toLocaleString()}</span>
                    <strong>{money(item.result?.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'uploads' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-bold">Upload material or service image</h2>
                <ImageUpload
                  label="Image file"
                  entityType="Material"
                  onUploaded={(image) => {
                    setStatus(`Uploaded ${image.url}`);
                    loadUploads();
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {uploads.map((image) => (
                  <article key={image._id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <img src={image.url} alt="" className="h-36 w-full rounded-xl object-cover" />
                    <p className="mt-2 truncate text-xs text-slate-500">{image.originalName || image.url}</p>
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-red-600"
                      onClick={async () => {
                        if (!window.confirm('Delete this image?')) return;
                        await api(`/api/uploads/${image._id}`, { method: 'DELETE' });
                        loadUploads();
                      }}
                    >
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-2">
              {(data?.users || []).map((person) => (
                <div key={person._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">
                  <span>{person.name} · {person.email} · {person.accountStatus || 'active'}</span>
                  <span className="flex gap-2">
                    <SearchableSelect
                      className="w-40"
                      aria-label={`Role for ${person.email}`}
                      value={person.role}
                      onChange={(next) => api(`/api/admin/users/${person._id}`, { method: 'PATCH', body: { role: next } }).then(() => loadUsers())}
                      options={['user', 'supplier', 'provider', 'admin']}
                    />
                    <button type="button" onClick={() => api(`/api/admin/users/${person._id}`, { method: 'PATCH', body: { disabled: !person.disabled } }).then(() => loadUsers())}>{person.disabled ? 'Enable' : 'Disable'}</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-3">
              {(data?.messages || []).length === 0 && <EmptyState title="No inquiries" text="Contact form submissions will appear here." />}
              {(data?.messages || []).map((message) => (
                <article key={message._id} className="rounded-2xl bg-white p-4 text-sm shadow-soft">
                  <strong>{message.subject}</strong>
                  <p>{message.name} · {message.email}</p>
                  <p className="mt-2">{message.message}</p>
                  <button type="button" className="mt-2 text-[#FF7518]" onClick={() => api(`/api/admin/messages/${message._id}`, { method: 'PATCH', body: {} }).then(() => loadMessages())}>{message.status}</button>
                </article>
              ))}
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-2">
              {(data?.logs || []).map((log) => (
                <p key={log._id} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">{log.action} · {log.entity} · {new Date(log.createdAt).toLocaleString()}</p>
              ))}
            </div>
          )}

          {tab === 'settings' && data?.settings && (
            <form
              className="grid gap-3 rounded-3xl bg-white p-5 shadow-soft"
              onSubmit={(event) => {
                event.preventDefault();
                api('/api/admin/settings', {
                  method: 'PUT',
                  body: {
                    source: event.target.source.value,
                    defaults: {
                      ...data.settings.defaults,
                      overheadPercent: Number(event.target.overhead.value),
                      contingencyPercent: Number(event.target.contingency.value),
                      marginPercent: Number(event.target.margin.value),
                    },
                  },
                }).then(() => setStatus('Settings saved.')).catch((err) => setError(err.message));
              }}
            >
              <Field label="Rate source label"><input name="source" className="input" defaultValue={data.settings.source || ''} /></Field>
              <Field label="Default overhead %"><input name="overhead" className="input" type="number" defaultValue={data.settings.defaults?.overheadPercent ?? 8} /></Field>
              <Field label="Default contingency %"><input name="contingency" className="input" type="number" defaultValue={data.settings.defaults?.contingencyPercent ?? 5} /></Field>
              <Field label="Default margin % (fallback)"><input name="margin" className="input" type="number" defaultValue={data.settings.defaults?.marginPercent ?? 0} /></Field>
              <button className={buttonClass} type="submit">Save configuration</button>
            </form>
          )}
        </main>
      </div>

      {draft && !draft._kind && (
        <Modal title={draft._id ? 'Edit material' : 'Add material'} onClose={() => setDraft(null)}>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveMaterial}>
            {['code', 'name', 'category', 'brand', 'unit', 'location', 'supplier', 'source'].map((field) => (
              <Field key={field} label={field}><input className="input" value={draft[field] || ''} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} required={['code', 'name', 'category', 'unit'].includes(field)} /></Field>
            ))}
            <Field label="Scope"><SearchableSelect value={draft.scope} onChange={(next) => setDraft({ ...draft, scope: next })} options={[{ value: 'grey', label: 'grey' }, { value: 'finishing', label: 'finishing' }]} /></Field>
            <Field label="Availability"><SearchableSelect value={draft.availability || 'in_stock'} onChange={(next) => setDraft({ ...draft, availability: next })} options={[{ value: 'in_stock', label: 'in_stock' }, { value: 'limited', label: 'limited' }, { value: 'out_of_stock', label: 'out_of_stock' }, { value: 'made_to_order', label: 'made_to_order' }]} /></Field>
            <Field label="Rate (PKR)"><input className="input" type="number" min="0" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: Number(event.target.value) })} required /></Field>
            <Field label="Per sq ft"><input className="input" type="number" min="0" step="0.001" value={draft.perSqFt} onChange={(event) => setDraft({ ...draft, perSqFt: Number(event.target.value) })} required /></Field>
            <Field label="Stock"><input className="input" type="number" min="0" value={draft.stockQuantity || 0} onChange={(event) => setDraft({ ...draft, stockQuantity: Number(event.target.value) })} /></Field>
            <Field label="Description"><textarea className="input min-h-20" value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={Boolean(draft.priceIncludesTransport)} onChange={(event) => setDraft({ ...draft, priceIncludesTransport: event.target.checked })} /> Price already includes regional/transport (skip multiplier)</label>
            <div className="md:col-span-2">
              <ImageUpload
                currentUrl={draft.imageUrl}
                entityType="Material"
                entityId={draft._id || ''}
                onUploaded={(image) => setDraft((current) => ({ ...current, imageUrl: image.url, galleryImages: [...new Set([...(current.galleryImages || []), image.url])] }))}
                onCleared={() => setDraft((current) => ({ ...current, imageUrl: '' }))}
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button className={buttonClass} type="submit">Save</button>
              <button className={ghostClass} type="button" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {draft?._kind === 'regional' && (
        <Modal title="Regional rate" onClose={() => setDraft(null)}>
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const body = { ...draft };
                delete body._kind;
                if (draft._id) await api(`/api/regional-rates/${draft._id}`, { method: 'PUT', body });
                else await api('/api/regional-rates', { method: 'POST', body });
                setDraft(null);
                setStatus('Regional rate saved.');
                loadRegional();
              } catch (err) { setError(err.message); }
            }}
          >
            <Field label="City"><input className="input" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required /></Field>
            <Field label="Region"><input className="input" value={draft.region || ''} onChange={(event) => setDraft({ ...draft, region: event.target.value })} /></Field>
            <Field label="Multiplier"><input className="input" type="number" step="0.01" min="0.5" max="3" value={draft.multiplier} onChange={(event) => setDraft({ ...draft, multiplier: Number(event.target.value) })} required /></Field>
            <Field label="Transport adjustment (0–1)"><input className="input" type="number" step="0.01" min="0" max="1" value={draft.transportAdjustment || 0} onChange={(event) => setDraft({ ...draft, transportAdjustment: Number(event.target.value) })} /></Field>
            <Field label="Notes"><textarea className="input" value={draft.notes || ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            <button className={buttonClass} type="submit">Save</button>
          </form>
        </Modal>
      )}

      {draft?._kind === 'labor' && (
        <Modal title="Labor rate" onClose={() => setDraft(null)}>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const body = { ...draft, rate: Number(draft.rate || draft.ratePerSqFt) };
                delete body._kind;
                if (draft._id) await api(`/api/labor-rates/${draft._id}`, { method: 'PUT', body });
                else await api('/api/labor-rates', { method: 'POST', body });
                setDraft(null);
                setStatus('Labor rate saved.');
                loadLabor();
              } catch (err) { setError(err.message); }
            }}
          >
            <Field label="City"><input className="input" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} required /></Field>
            <Field label="Skill">
              <SearchableSelect
                value={draft.skill || 'general'}
                onChange={(next) => setDraft({ ...draft, skill: next })}
                options={['mason', 'laborer', 'steel_fixer', 'carpenter', 'electrician', 'plumber', 'painter', 'tile_worker', 'general', 'equipment']}
              />
            </Field>
            <Field label="Unit"><SearchableSelect value={draft.unit || 'per_sq_ft'} onChange={(next) => setDraft({ ...draft, unit: next })} options={[{ value: 'daily', label: 'daily' }, { value: 'hourly', label: 'hourly' }, { value: 'per_sq_ft', label: 'per_sq_ft' }]} /></Field>
            <Field label="Scope"><SearchableSelect value={draft.scope || 'any'} onChange={(next) => setDraft({ ...draft, scope: next })} options={['any', 'grey', 'finishing']} /></Field>
            <Field label="Kind"><SearchableSelect value={draft.kind || 'labor'} onChange={(next) => setDraft({ ...draft, kind: next })} options={['labor', 'equipment']} /></Field>
            <Field label="Rate / ratePerSqFt"><input className="input" type="number" min="0" value={draft.ratePerSqFt} onChange={(event) => setDraft({ ...draft, ratePerSqFt: Number(event.target.value), rate: Number(event.target.value) })} required /></Field>
            <button className={`${buttonClass} md:col-span-2`} type="submit">Save</button>
          </form>
        </Modal>
      )}

      {draft?._kind === 'margin' && (
        <Modal title="Margin rule" onClose={() => setDraft(null)}>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const body = { ...draft };
                delete body._kind;
                if (draft._id) await api(`/api/margin-rules/${draft._id}`, { method: 'PUT', body });
                else await api('/api/margin-rules', { method: 'POST', body });
                setDraft(null);
                setStatus('Margin rule saved.');
                loadMargins();
              } catch (err) { setError(err.message); }
            }}
          >
            <Field label="Name"><input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
            <Field label="Project type (* = any)"><input className="input" value={draft.projectType} onChange={(event) => setDraft({ ...draft, projectType: event.target.value })} /></Field>
            <Field label="Quality"><input className="input" value={draft.quality} onChange={(event) => setDraft({ ...draft, quality: event.target.value })} /></Field>
            <Field label="Project size"><SearchableSelect value={draft.projectSize} onChange={(next) => setDraft({ ...draft, projectSize: next })} options={['any', 'small', 'medium', 'large']} /></Field>
            <Field label="Margin %"><input className="input" type="number" min="0" max="40" value={draft.marginPercent} onChange={(event) => setDraft({ ...draft, marginPercent: Number(event.target.value) })} required /></Field>
            <Field label="Priority (lower wins)"><input className="input" type="number" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></Field>
            <Field label="Min covered area"><input className="input" type="number" value={draft.minCoveredArea || 0} onChange={(event) => setDraft({ ...draft, minCoveredArea: Number(event.target.value) })} /></Field>
            <Field label="Max covered area"><input className="input" type="number" value={draft.maxCoveredArea ?? ''} onChange={(event) => setDraft({ ...draft, maxCoveredArea: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
            <button className={`${buttonClass} md:col-span-2`} type="submit">Save</button>
          </form>
        </Modal>
      )}

      {draft?._kind === 'quantity' && (
        <Modal title="Quantity rule" onClose={() => setDraft(null)}>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const body = { ...draft };
                delete body._kind;
                if (draft._id) await api(`/api/quantity-rules/${draft._id}`, { method: 'PUT', body });
                else await api('/api/quantity-rules', { method: 'POST', body });
                setDraft(null);
                setStatus('Quantity rule saved.');
                loadQuantities();
              } catch (err) { setError(err.message); }
            }}
          >
            {['code', 'name', 'category', 'unit', 'buildingType', 'quality'].map((field) => (
              <Field key={field} label={field}><input className="input" value={draft[field] || ''} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} required={['code', 'name', 'category', 'unit'].includes(field)} /></Field>
            ))}
            <Field label="Scope"><SearchableSelect value={draft.scope} onChange={(next) => setDraft({ ...draft, scope: next })} options={['grey', 'finishing']} /></Field>
            <Field label="Per sq ft"><input className="input" type="number" step="0.001" min="0" value={draft.perSqFt} onChange={(event) => setDraft({ ...draft, perSqFt: Number(event.target.value) })} required /></Field>
            <Field label="Floor factor"><input className="input" type="number" step="0.001" value={draft.floorFactor || 0} onChange={(event) => setDraft({ ...draft, floorFactor: Number(event.target.value) })} /></Field>
            <button className={`${buttonClass} md:col-span-2`} type="submit">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ConfigPanel({ title, actionLabel, onAdd, children, search, onSearch }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {onSearch && <input className="input max-w-xs" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search" aria-label="Search" />}
        {onAdd && <button type="button" className={`${buttonClass} ml-auto`} onClick={onAdd}>{actionLabel || 'Add'}</button>}
      </div>
      {children}
    </div>
  );
}

function CrudTable({ title, rows, columns, onAdd, onEdit, onDelete }) {
  return (
    <ConfigPanel title={title} actionLabel="Add" onAdd={onAdd}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              {columns.map(([, label]) => <th key={label} className="py-2 pr-3">{label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                {columns.map(([key]) => <td key={key} className="py-2 pr-3">{String(row[key] ?? '')}</td>)}
                <td className="space-x-2 whitespace-nowrap">
                  <button type="button" className="text-[#FF7518]" onClick={() => onEdit(row)}>Edit</button>
                  <button type="button" className="text-red-600" onClick={() => onDelete(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows || []).length === 0 && <div className="py-6"><EmptyState title="No rows" text="Add the first entry or run npm run seed." /></div>}
      </div>
    </ConfigPanel>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="mt-10 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
