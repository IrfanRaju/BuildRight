import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, buttonClass } from '../components/ui';
import CommerceAdmin from './admin/CommerceAdmin';

export default function AdminPage({ setPage }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [article, setArticle] = useState({ title: '', category: 'Construction planning', excerpt: '', body: '' });

  const load = (next = tab) => {
    const path = next === 'overview' ? '/api/admin/overview' : `/api/admin/${next}`;
    api(path).then(setData).catch((requestError) => setError(requestError.message));
  };
  const commerceTabs = ['catalog', 'orders', 'repairs', 'providers'];
  useEffect(() => { if (user?.role === 'admin' && !commerceTabs.includes(tab)) load(tab); }, [tab, user]);

  if (!user) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title="Admin sign-in required" text="This area checks the role on the server." action={<button className={buttonClass} type="button" onClick={() => setPage('login')}>Sign in</button>} /></div>;
  if (user.role !== 'admin') return <div className="mx-auto max-w-3xl px-4 py-8"><Notice tone="error">Your account does not have administrator access.</Notice></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Admin" title="System administration" description="User, rate, content, and job controls are authorized on the server." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {['overview', 'users', 'catalog', 'orders', 'repairs', 'providers', 'messages', 'jobs', 'audit', 'settings'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${tab === item ? 'bg-[#101828] text-white' : 'bg-white'}`}>{item}</button>)}
        <button type="button" className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#FF7518]" onClick={() => setPage('materials')}>Material rates</button>
      </div>
      {commerceTabs.includes(tab) && <CommerceAdmin tab={tab} />}
      {tab === 'overview' && data?.counts && (
        <div className="grid gap-3 sm:grid-cols-3">{Object.entries(data.counts).map(([key, value]) => <div key={key} className="rounded-2xl bg-white p-4"><p className="text-xs uppercase text-slate-500">{key}</p><p className="text-2xl font-black">{value}</p></div>)}</div>
      )}
      {tab === 'users' && <div className="space-y-2">{(data?.users || []).map((person) => <div key={person._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm"><span>{person.name} · {person.email}</span><span className="flex gap-2"><select aria-label={`Role for ${person.email}`} value={person.role} onChange={(event) => api(`/api/admin/users/${person._id}`, { method: 'PATCH', body: { role: event.target.value } }).then(() => load())}>{['user', 'supplier', 'provider', 'admin'].map((role) => <option key={role}>{role}</option>)}</select><button type="button" onClick={() => api(`/api/admin/users/${person._id}`, { method: 'PATCH', body: { disabled: !person.disabled } }).then(() => load())}>{person.disabled ? 'Enable' : 'Disable'}</button></span></div>)}</div>}
      {tab === 'messages' && <div className="space-y-3">{(data?.messages || []).length === 0 && <EmptyState title="No inquiries" text="Contact form submissions will appear here." />}{(data?.messages || []).map((message) => <article key={message._id} className="rounded-2xl bg-white p-4 text-sm"><strong>{message.subject}</strong><p>{message.name} · {message.email}</p><p className="mt-2">{message.message}</p><button type="button" className="mt-2 text-[#FF7518]" onClick={() => api(`/api/admin/messages/${message._id}`, { method: 'PATCH', body: {} }).then(() => load())}>{message.status}</button></article>)}</div>}
      {tab === 'jobs' && <div className="space-y-2">{(data?.jobs || []).map((job) => <p key={job._id} className="rounded-2xl bg-white px-4 py-3 text-sm"><strong>{job.status}</strong> · {job.provider} · {job.prompt.slice(0, 120)}</p>)}{(data?.jobs || []).length === 0 && <EmptyState title="No generation jobs" text="Jobs are recorded when the design API runs." />}</div>}
      {tab === 'audit' && <div className="space-y-2">{(data?.logs || []).map((log) => <p key={log._id} className="rounded-2xl bg-white px-4 py-3 text-sm">{log.action} · {log.entity}</p>)}</div>}
      {tab === 'settings' && data?.settings && (
        <form className="grid gap-3 rounded-3xl bg-white p-5" onSubmit={(event) => { event.preventDefault(); api('/api/admin/settings', { method: 'PUT', body: { source: event.target.source.value, defaults: { ...data.settings.defaults, overheadPercent: Number(event.target.overhead.value) } } }).then(() => setError('')).catch((requestError) => setError(requestError.message)); }}>
          <Field label="Rate source label"><input name="source" className="input" defaultValue={data.settings.source || ''} /></Field>
          <Field label="Default overhead %"><input name="overhead" className="input" type="number" defaultValue={data.settings.defaults?.overheadPercent ?? 8} /></Field>
          <button className={buttonClass} type="submit">Save configuration</button>
        </form>
      )}
      <form className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-5" onSubmit={async (event) => { event.preventDefault(); try { await api('/api/articles', { method: 'POST', body: article }); setArticle({ title: '', category: 'Construction planning', excerpt: '', body: '' }); setTab('overview'); } catch (requestError) { setError(requestError.message); } }}>
        <h2 className="font-bold">Publish a guide</h2>
        <Field label="Title"><input className="input" value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value })} required /></Field>
        <Field label="Category"><input className="input" value={article.category} onChange={(event) => setArticle({ ...article, category: event.target.value })} required /></Field>
        <Field label="Excerpt"><input className="input" value={article.excerpt} onChange={(event) => setArticle({ ...article, excerpt: event.target.value })} required /></Field>
        <Field label="Body"><textarea className="input min-h-28" value={article.body} onChange={(event) => setArticle({ ...article, body: event.target.value })} required /></Field>
        <button className={buttonClass} type="submit">Publish</button>
      </form>
    </div>
  );
}
