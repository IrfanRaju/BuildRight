import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, buttonClass } from '../components/ui';

export default function AccountDashboard({ setPage }) {
  const { user, updateProfile, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({ currentPassword: '', nextPassword: '' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    api('/api/dashboard').then(setData).catch((requestError) => setError(requestError.message));
    return undefined;
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title="Sign in to open your dashboard" text="Saved projects, designs, estimates, and reports are available after you register." action={<button type="button" className={buttonClass} onClick={() => setPage('login')}>Sign in</button>} />
      </div>
    );
  }

  const latest = data?.estimates?.[0]?.result;
  const pie = latest ? [
    { name: 'Materials', value: latest.materialCost },
    { name: 'Labor', value: latest.laborCost },
    { name: 'Equipment', value: latest.equipmentCost },
    { name: 'Other', value: (latest.overhead || 0) + (latest.contingency || 0) },
  ].filter((item) => item.value > 0) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Dashboard" title={`Hello, ${user.name}`} description="These figures come from your saved records." actions={<button type="button" className={buttonClass} onClick={() => { logout(); setPage('home'); }}>Log out</button>} />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Projects', data?.counts?.projects ?? '—'],
          ['Designs', data?.counts?.designs ?? '—'],
          ['Estimates', data?.counts?.estimates ?? '—'],
          ['Saved total', data ? money(data.totals?.estimated) : '—'],
          ['Orders', data?.counts?.orders ?? '—'],
          ['Repairs', data?.counts?.repairs ?? '—'],
        ].map(([label, value]) => <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Recent projects</h2>
          {data?.projects?.length ? data.projects.map((project) => (
            <button key={project._id} type="button" onClick={() => setPage('projects')} className="mt-3 flex w-full justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm"><span>{project.title}</span><span>{project.status}</span></button>
          )) : <p className="mt-3 text-sm text-slate-500">No projects yet.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => setPage('estimator')}>New estimate</button>
            <button type="button" className={buttonClass} onClick={() => setPage('designer')}>New design</button>
            <button type="button" className={buttonClass} onClick={() => setPage('marketplace')}>Order materials</button>
            <button type="button" className={buttonClass} onClick={() => setPage('repairs')}>Plan a repair</button>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Latest estimate mix</h2>
          {pie.length === 0 ? <p className="mt-3 text-sm text-slate-500">Save an estimate to see the breakdown.</p> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" innerRadius={40} outerRadius={70}>{pie.map((item, index) => <Cell key={item.name} fill={['#FF7518', '#101828', '#fdba74', '#94a3b8'][index]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div>
          )}
        </section>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Designs and reports</h2>
          {(data?.designs || []).map((design) => <p key={design._id} className="mt-2 text-sm">{design.title}</p>)}
          {(data?.estimates || []).map((estimate) => (
            <div key={estimate._id} className="mt-2 flex justify-between text-sm"><span>{estimate.title}</span><button type="button" className="font-semibold text-[#FF7518]" onClick={() => downloadReport(estimate._id, setError)}>PDF</button></div>
          ))}
          {(data?.orders || []).map((order) => <button key={order._id} type="button" className="mt-2 block text-sm font-semibold text-[#FF7518]" onClick={() => setPage('order', order._id)}>{order.orderNumber} · {order.status}</button>)}
          {(data?.repairs || []).map((project) => <button key={project._id} type="button" className="mt-2 block text-sm" onClick={() => setPage('repair-project', project._id)}>{project.title} · {project.progress}</button>)}
          {!data?.designs?.length && !data?.estimates?.length && !data?.orders?.length && !data?.repairs?.length && <p className="mt-2 text-sm text-slate-500">Nothing saved yet.</p>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Recent activity</h2>
          {data?.activity?.length ? data.activity.map((item) => <p key={item._id} className="mt-2 text-sm text-slate-600">{item.action}</p>) : <p className="mt-2 text-sm text-slate-500">Activity appears after you save or export.</p>}
          <form className="mt-4 grid gap-3" onSubmit={async (event) => { event.preventDefault(); try { await updateProfile(name); setNotice('Name updated.'); } catch (requestError) { setError(requestError.message); } }}>
            <Field label="Display name"><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <button className={buttonClass} type="submit">Save settings</button>
          </form>
          <form className="mt-4 grid gap-3" onSubmit={async (event) => { event.preventDefault(); try { await api('/api/auth/password', { method: 'PUT', body: passwords }); setNotice('Password updated.'); setPasswords({ currentPassword: '', nextPassword: '' }); } catch (requestError) { setError(requestError.message); } }}>
            <Field label="Current password"><input className="input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></Field>
            <Field label="New password"><input className="input" type="password" value={passwords.nextPassword} onChange={(event) => setPasswords({ ...passwords, nextPassword: event.target.value })} /></Field>
            <button className={buttonClass} type="submit">Change password</button>
          </form>
        </section>
      </div>
    </div>
  );
}

async function downloadReport(id, setError) {
  try {
    const blob = await api(`/api/estimates/${id}/report`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buildright-estimate-${id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    setError(error.message);
  }
}
