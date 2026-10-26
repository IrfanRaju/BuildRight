import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, PortalCard, StatCard, portalButtonClass, portalGhostClass } from '../components/ui';

export default function AccountDashboard({ setPage }) {
  const { user, updateProfile } = useAuth();
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
        <EmptyState title="Sign in to open your dashboard" text="Saved projects, designs, estimates, and reports are available after you register." action={<button type="button" className={portalButtonClass} onClick={() => setPage('login')}>Sign in</button>} />
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
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 lg:px-6">
      <PageHeader
        variant="portal"
        eyebrow="Overview"
        title={`Hello, ${user.name}`}
        description="Summary metrics and recent activity from your saved records."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={portalButtonClass} onClick={() => setPage('estimator')}>New estimate</button>
            <button type="button" className={portalGhostClass} onClick={() => setPage('designer')}>New design</button>
          </div>
        }
      />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[
          ['Projects', data?.counts?.projects ?? '—'],
          ['Designs', data?.counts?.designs ?? '—'],
          ['Estimates', data?.counts?.estimates ?? '—'],
          ['Saved total', data ? money(data.totals?.estimated) : '—'],
          ['Orders', data?.counts?.orders ?? '—'],
          ['Repairs', data?.counts?.repairs ?? '—'],
        ].map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <PortalCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">Recent projects</h2>
            <button type="button" className="text-xs font-semibold text-[#FF7518]" onClick={() => setPage('projects')}>View all</button>
          </div>
          {data?.projects?.length ? data.projects.map((project) => (
            <button key={project._id} type="button" onClick={() => setPage('projects')} className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-left text-sm hover:border-orange-200 hover:bg-orange-50/40">
              <span className="font-medium text-slate-800">{project.title}</span>
              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500 ring-1 ring-slate-200">{project.status}</span>
            </button>
          )) : <p className="mt-3 text-sm text-slate-500">No projects yet.</p>}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={portalGhostClass} onClick={() => setPage('marketplace')}>Order materials</button>
            <button type="button" className={portalGhostClass} onClick={() => setPage('repairs')}>Plan a repair</button>
          </div>
        </PortalCard>

        <PortalCard>
          <h2 className="text-sm font-bold text-slate-900">Latest estimate mix</h2>
          {pie.length === 0 ? <p className="mt-3 text-sm text-slate-500">Save an estimate to see the breakdown.</p> : (
            <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" innerRadius={42} outerRadius={68}>{pie.map((item, index) => <Cell key={item.name} fill={['#FF7518', '#101828', '#fdba74', '#94a3b8'][index]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div>
          )}
        </PortalCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PortalCard>
          <h2 className="text-sm font-bold text-slate-900">Designs, reports & commerce</h2>
          <div className="mt-3 space-y-2">
            {(data?.designs || []).map((design) => <p key={design._id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{design.title}</p>)}
            {(data?.estimates || []).map((estimate) => (
              <div key={estimate._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{estimate.title}</span>
                <button type="button" className="font-semibold text-[#FF7518]" onClick={() => downloadReport(estimate._id, setError)}>PDF</button>
              </div>
            ))}
            {(data?.orders || []).map((order) => (
              <button key={order._id} type="button" className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-[#FF7518]" onClick={() => setPage('order', order._id)}>
                {order.orderNumber} · {order.status}
              </button>
            ))}
            {(data?.repairs || []).map((project) => (
              <button key={project._id} type="button" className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-700" onClick={() => setPage('repair-project', project._id)}>
                {project.title} · {project.progress}
              </button>
            ))}
            {!data?.designs?.length && !data?.estimates?.length && !data?.orders?.length && !data?.repairs?.length && <p className="text-sm text-slate-500">Nothing saved yet.</p>}
          </div>
        </PortalCard>

        <PortalCard>
          <h2 className="text-sm font-bold text-slate-900">Account settings</h2>
          <div className="mt-2 max-h-36 space-y-1.5 overflow-auto">
            {data?.activity?.length ? data.activity.map((item) => <p key={item._id} className="text-sm text-slate-600">{item.action}</p>) : <p className="text-sm text-slate-500">Activity appears after you save or export.</p>}
          </div>
          <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4" onSubmit={async (event) => { event.preventDefault(); try { await updateProfile(name); setNotice('Name updated.'); } catch (requestError) { setError(requestError.message); } }}>
            <Field label="Display name"><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <button className={portalButtonClass} type="submit">Save settings</button>
          </form>
          <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4" onSubmit={async (event) => { event.preventDefault(); try { await api('/api/auth/password', { method: 'PUT', body: passwords }); setNotice('Password updated.'); setPasswords({ currentPassword: '', nextPassword: '' }); } catch (requestError) { setError(requestError.message); } }}>
            <Field label="Current password"><input className="input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></Field>
            <Field label="New password"><input className="input" type="password" value={passwords.nextPassword} onChange={(event) => setPasswords({ ...passwords, nextPassword: event.target.value })} /></Field>
            <button className={portalButtonClass} type="submit">Change password</button>
          </form>
        </PortalCard>
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
