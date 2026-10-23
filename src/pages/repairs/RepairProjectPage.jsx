import { useEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, money } from '../../lib/api';
import { compressImage, drawColorConcept } from '../../lib/images';
import { Notice, PageHeader, buttonClass, ghostClass } from '../../components/ui';

export default function RepairProjectPage({ projectId, setPage }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#F4E4C8');
  const [style, setStyle] = useState('Modern');
  const [finish, setFinish] = useState('Matte');
  const [previewNote, setPreviewNote] = useState('The color overlay is a visual concept, not an exact picture of the finished work and not proof that hidden damage has been repaired.');
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const imageRef = useRef(null);

  const load = () => api(`/api/repairs/projects/${projectId}`).then((result) => {
    setData(result);
    setNotes(result.project.notes || '');
    setColor(result.project.visual?.color || '#F4E4C8');
    setStyle(result.project.visual?.style || 'Modern');
    setFinish(result.project.visual?.finish || 'Matte');
  }).catch((requestError) => setError(requestError.message));

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    const photo = data?.project?.photos?.find((item) => item.kind === 'existing');
    const image = new Image();
    image.onload = () => { imageRef.current = image; paint(image); };
    if (photo?.dataUrl) image.src = photo.dataUrl;
    else paint(null);
  }, [data, color]);

  const paint = (image) => {
    if (beforeRef.current && image) beforeRef.current.getContext('2d').drawImage(image, 0, 0, 360, 220);
    if (afterRef.current) drawColorConcept(afterRef.current, image, color);
  };

  const saveNotes = async (patch) => {
    await api(`/api/repairs/projects/${projectId}`, { method: 'PUT', body: patch });
    load();
  };

  const download = async () => {
    const blob = await api(`/api/repairs/projects/${projectId}/report`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buildright-repair-${projectId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addCompletion = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !data) return;
    const dataUrl = await compressImage(file);
    const photos = [...(data.project.photos || []), { dataUrl, caption: 'Completion', kind: 'completion' }];
    await saveNotes({ photos, notes });
  };

  if (!data?.project) return <div className="mx-auto max-w-3xl px-4 py-8">{error ? <Notice tone="error">{error}</Notice> : <p className="text-sm text-slate-500">Loading repair project…</p>}</div>;
  const project = data.project;
  const estimate = project.estimate || {};
  const pie = [
    { name: 'Materials', value: estimate.materialCost || 0 },
    { name: 'Labor', value: estimate.laborCost || 0 },
    { name: 'Equipment', value: estimate.equipmentCost || 0 },
    { name: 'Other', value: (estimate.delivery || 0) + (estimate.tax || 0) + (estimate.contingency || 0) },
  ].filter((item) => item.value > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Repair project" title={project.title} description={`${project.buildingType} · ${project.location} · ${project.progress}`} actions={<button type="button" className={buttonClass} onClick={() => download().catch((requestError) => setError(requestError.message))}>Download PDF</button>} />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4"><Notice>{estimate.disclaimer || data.notice}</Notice></div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Cost breakdown</h2>
          <p className="mt-2 text-3xl font-black">{money(estimate.total)}</p>
          <p className="text-sm text-slate-500">Budget {money(project.budget)} · Labor {money(estimate.laborCost)} is separate from materials {money(estimate.materialCost)}</p>
          {pie.length > 0 && <div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" innerRadius={40} outerRadius={70}>{pie.map((item, index) => <Cell key={item.name} fill={['#FF7518', '#101828', '#fdba74', '#94a3b8'][index]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div>}
          <div className="mt-3 flex flex-wrap gap-2">{['Planning', 'Materials ordered', 'In progress', 'Completed'].map((progress) => <button key={progress} type="button" className={`rounded-full px-3 py-1 text-xs font-semibold ${project.progress === progress ? 'bg-[#101828] text-white' : 'bg-slate-100'}`} onClick={() => saveNotes({ progress, notes }).catch((requestError) => setError(requestError.message))}>{progress}</button>)}</div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Tasks and orders</h2>
          {(project.tasks || []).map((task) => <p key={task.serviceSlug} className="mt-2 text-sm">{task.title || task.serviceSlug} · {task.condition} · {task.quality}</p>)}
          <button type="button" className={`${ghostClass} mt-4`} onClick={() => setPage('orders')}>View material orders</button>
          <h3 className="mt-5 font-bold">Service requests</h3>
          <p className="mt-1 text-xs text-slate-500">{data.notice}</p>
          {(data.requests || []).map((request) => (
            <div key={request._id} className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold">{request.trade} · {request.status}</p>
              <p>{request.booked ? 'This request is confirmed.' : 'A worker has not been booked.'}</p>
              {request.status === 'accepted' && <button type="button" className="mt-2 text-[#FF7518]" onClick={() => api(`/api/repairs/requests/${request._id}/confirm`, { method: 'POST', body: {} }).then(load)}>Confirm booking</button>}
            </div>
          ))}
          {(data.requests || []).length === 0 && <p className="mt-2 text-sm text-slate-500">No service request has been sent.</p>}
        </section>
      </div>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Before and proposed concept</h2>
        <p className="mt-1 text-sm text-slate-600">{previewNote}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold">Color <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <select className="input w-40" value={style} onChange={(event) => setStyle(event.target.value)}>{['Modern', 'Traditional', 'Minimal', 'Warm', 'Cool'].map((item) => <option key={item}>{item}</option>)}</select>
          <select className="input w-40" value={finish} onChange={(event) => setFinish(event.target.value)}>{['Matte', 'Satin', 'Gloss', 'Textured', 'Stone'].map((item) => <option key={item}>{item}</option>)}</select>
          <button type="button" className={ghostClass} onClick={() => api(`/api/repairs/projects/${projectId}/preview`, { method: 'POST', body: { color, style, finish, surface: 'room' } }).then((result) => setPreviewNote(result.preview.message)).catch((requestError) => setError(requestError.message))}>Request AI concept</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{data.preview?.configured ? 'An image service is configured. It receives the color and style, not your photograph.' : 'Image generation is not configured, so only the local color concept is available.'}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <figure><figcaption className="mb-2 text-xs font-semibold uppercase text-slate-500">Existing</figcaption><canvas ref={beforeRef} width="360" height="220" className="w-full rounded-2xl bg-slate-100" /></figure>
          <figure><figcaption className="mb-2 text-xs font-semibold uppercase text-slate-500">Color concept</figcaption><canvas ref={afterRef} width="360" height="220" className="w-full rounded-2xl bg-slate-100" /></figure>
        </div>
      </section>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Photographs and notes</h2>
        <div className="mt-3 flex flex-wrap gap-3">{(project.photos || []).map((photo, index) => <figure key={`${photo.kind}-${index}`}><img src={photo.dataUrl} alt={photo.caption || ''} className="h-28 w-28 rounded-xl object-cover" /><figcaption className="text-[11px] text-slate-500">{photo.kind}</figcaption></figure>)}</div>
        <label className="mt-4 block text-sm font-semibold">Completion photograph<input className="input mt-1" type="file" accept="image/*" onChange={(event) => addCompletion(event).catch((requestError) => setError(requestError.message))} /></label>
        <textarea className="input mt-3 min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <button type="button" className={`${buttonClass} mt-3`} onClick={() => saveNotes({ notes }).catch((requestError) => setError(requestError.message))}>Save notes</button>
      </section>
    </div>
  );
}
