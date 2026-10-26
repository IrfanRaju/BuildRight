import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Field, Notice, PageHeader, SearchableSelect, buttonClass, ghostClass } from '../components/ui';

const services = [
  { slug: 'construction-planning', title: 'Construction planning', text: 'Organize scope, floors, and room requirements before work starts.', action: 'Open design studio', page: 'designer' },
  { slug: 'cost-estimation', title: 'Building cost estimation', text: 'Calculate materials, labor, equipment, overhead, and contingency in PKR.', action: 'Start an estimate', page: 'estimator' },
  { slug: 'floor-plans', title: '2D floor-plan design', text: 'Generate a dimensioned concept plan from a written brief.', action: 'Generate a plan', page: 'designer' },
  { slug: 'visualization', title: '3D building visualization', text: 'Orbit a geometry-based model of the same specification as the plan.', action: 'Open 3D preview', page: 'designer' },
  { slug: 'quantities', title: 'Material quantity estimation', text: 'Review cement, steel, sand, crush, and brick quantities with the estimate.', action: 'View quantities', page: 'estimator' },
  { slug: 'renovation', title: 'Renovation planning', text: 'Price a finishing-only scope when the structure already exists.', action: 'Estimate a renovation', page: 'estimator' },
  { slug: 'interiors', title: 'Interior and exterior design', text: 'Switch the studio between interior and exterior views of the concept model.', action: 'Design a concept', page: 'designer' },
  { slug: 'scheduling', title: 'Project scheduling', text: 'See an indicative duration based on floors, category, and quality.', action: 'See a timeline', page: 'estimator' },
  { slug: 'prices', title: 'Material price information', text: 'Browse configured rates, sources, and the date each rate was last updated.', action: 'Open the catalog', page: 'materials' },
];

export function AboutPage({ setPage }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="About" title="Planning tools for clearer construction decisions" description="BuildRight is a university final-year project for homeowners, contractors, architects, and developers who need a concept plan, a 3D preview, and a transparent cost estimate in one place." />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Mission', 'Help people see a building idea and its likely cost before they commit to site work.'],
          ['Vision', 'A planning workspace where designs, quantities, and saved reports stay attached to the same project.'],
          ['Goals', 'Keep calculations explainable, keep private projects private, and label every sample rate honestly.'],
          ['Who it helps', 'Owners comparing options, contractors preparing a first budget, and students demonstrating a full planning workflow.'],
        ].map(([title, text]) => (
          <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft"><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>
        ))}
      </div>
      <section className="mt-8 rounded-3xl bg-[#101828] p-6 text-white">
        <h2 className="text-xl font-bold">How a project moves through BuildRight</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-200 md:grid-cols-4">
          {['Describe the building', 'Review the concept plan and model', 'Calculate a cost with visible assumptions', 'Save the project and export a report'].map((step, index) => <li key={step}><span className="text-[#FF7518]">{index + 1}.</span> {step}</li>)}
        </ol>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Values</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{['Clear assumptions', 'Private by default', 'No invented credentials'].map((value) => <div key={value} className="rounded-2xl bg-orange-50 px-4 py-5 text-sm font-semibold text-slate-800">{value}</div>)}</div>
        <p className="mt-4 text-sm leading-6 text-slate-600">Team portraits on the homepage are sample profiles for the demonstration. BuildRight does not claim registered company statistics, completed commercial projects, or verified professional licenses.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">Questions</h2>
        {[
          ['Is the estimate a contractor quotation?', 'No. It is a planning estimate from configurable rates. Land, approvals, and specialist design are excluded.'],
          ['Does the floor plan replace an architect?', 'No. The geometry engine produces a concept layout with dimensions. It is not a permit drawing.'],
          ['Are material prices live?', 'Not unless you connect a verified source. Seeded rates are marked illustrative and dated.'],
          ['Who can see my saved work?', 'Only your account, unless you mark a project public. Administrators can manage catalog data, not your private designs, except where an admin role is explicitly used.'],
        ].map(([question, answer]) => (
          <details key={question} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p></details>
        ))}
      </section>
      <button type="button" className={`${buttonClass} mt-8`} onClick={() => setPage('register')}>Create an account</button>
    </div>
  );
}

export function ServicesPage({ setPage, slug }) {
  const selected = services.find((service) => service.slug === slug);
  const items = selected ? [selected] : services;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Services" title={selected ? selected.title : 'What you can do in BuildRight'} description="Each service opens a working part of the application." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((service) => (
          <article key={service.slug} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-bold">{service.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{service.text}</p>
            <div className="mt-4 flex gap-3">
              <button type="button" className={buttonClass} onClick={() => setPage(service.page)}>{service.action}</button>
              {!selected && <button type="button" className={ghostClass} onClick={() => setPage('service', service.slug)}>Details</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ProjectsPage({ setPage }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', projectType: 'House', category: 'residential', location: 'Islamabad', area: 2000, areaUnit: 'sq ft', floors: 2, description: '', visibility: 'private' });

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '24' });
    if (mine) params.set('scope', 'mine');
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    api(`/api/projects?${params}`)
      .then((result) => { setProjects(result.projects || []); setError(''); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [mine, category]);

  const create = async (event) => {
    event.preventDefault();
    try {
      await api('/api/projects', { method: 'POST', body: form });
      setMine(true);
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const act = async (id, action) => {
    try {
      if (action === 'delete') await api(`/api/projects/${id}`, { method: 'DELETE' });
      else await api(`/api/projects/${id}/${action}`, { method: 'POST', body: {} });
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Projects" title="Project gallery" description="Public sample concepts are labeled as samples. Your own projects stay private unless you share them." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={mine ? ghostClass : buttonClass} onClick={() => setMine(false)}>Public gallery</button>
        <button type="button" className={mine ? buttonClass : ghostClass} onClick={() => user ? setMine(true) : setPage('login')}>My projects</button>
        <input className="input max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} placeholder="Search titles" aria-label="Search projects" />
        <SearchableSelect
          className="w-48"
          value={category}
          onChange={setCategory}
          options={['residential', 'commercial', 'corporate', 'institutional', 'infrastructure']}
          clearable
          emptyLabel="All categories"
          aria-label="Filter by category"
        />
      </div>
      {loading && <p className="text-sm text-slate-500">Loading projects…</p>}
      {!loading && projects.length === 0 && <EmptyState title="No projects in this view" text="Create one below, or seed the sample gallery with npm run seed." />}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {projects.map((project) => (
          <article key={project._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
            {project.imageUrl && <img src={project.imageUrl} alt="" className="h-44 w-full object-cover" />}
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#FF7518]">{project.category}{project.isSample ? ' · sample' : ''}</p>
              <h2 className="mt-1 font-bold">{project.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{project.location} · {project.area} {project.areaUnit} · {project.floors} floors</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
              {project.estimatedBudget ? <p className="mt-2 text-sm font-semibold">Illustrative budget {money(project.estimatedBudget)}</p> : null}
              {user && (mine || user.role === 'admin') && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <button type="button" onClick={() => act(project._id, 'duplicate')}>Duplicate</button>
                  <button type="button" onClick={() => act(project._id, 'archive')}>Archive</button>
                  <button type="button" onClick={() => act(project._id, 'delete')}>Delete</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={create} className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-bold">{user ? 'Create a project' : 'Sign in to create a project'}</h2>
        <Field label="Title"><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
        <Field label="Type"><input className="input" value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })} /></Field>
        <Field label="Category"><SearchableSelect value={form.category} onChange={(next) => setForm({ ...form, category: next })} options={['residential', 'commercial', 'corporate', 'institutional', 'infrastructure']} /></Field>
        <Field label="Location"><input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
        <Field label="Description"><textarea className="input min-h-24 md:col-span-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <button className={buttonClass} type="submit" disabled={!user}>Save project</button>
      </form>
    </div>
  );
}

export function ContractorsPage({ setPage }) {
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const load = () => api(`/api/contractors?q=${encodeURIComponent(query)}`).then((result) => setPeople(result.contractors || [])).catch((requestError) => setError(requestError.message));
  useEffect(() => { load(); }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Directory" title="Contractors and professionals" description="Verification badges appear only when an administrator has set a profile to verified. Sample listings are not verified." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4 flex gap-2"><input className="input max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search professionals" placeholder="Search by name" /><button type="button" className={buttonClass} onClick={load}>Search</button></div>
      {people.length === 0 && !error && <EmptyState title="Directory is empty" text="Run npm run seed to load sample professional profiles." />}
      <div className="grid gap-4 md:grid-cols-2">
        {people.map((person) => (
          <article key={person._id} className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{person.name}</h2>{person.verificationStatus === 'verified' ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Verified</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Not verified</span>}</div>
            <p className="mt-1 text-sm font-semibold text-[#FF7518]">{person.role}{person.sample ? ' · sample listing' : ''}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{person.summary}</p>
            <p className="mt-2 text-xs text-slate-500">{person.specialties?.join(', ')} · {person.locations?.join(', ')}</p>
            <button type="button" className={`${ghostClass} mt-4`} onClick={() => setPage('contact')}>Contact via form</button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function BlogPage({ setPage }) {
  const [articles, setArticles] = useState([]);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const categories = ['All', 'Construction planning', 'Material selection', 'Budgeting', 'Architectural design', 'Sustainable buildings', 'Renovation', 'Construction technology'];
  const load = () => {
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (query) params.set('q', query);
    api(`/api/articles?${params}`).then((result) => setArticles(result.articles || [])).catch((requestError) => setError(requestError.message));
  };
  useEffect(() => { load(); }, [category]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Guides" title="Construction guides" description="Articles are stored in the database and can be managed from the admin dashboard." />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="mt-4 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === item ? 'bg-[#FF7518] text-white' : 'bg-white text-slate-600'}`}>{item}</button>)}</div>
      <div className="mt-4 flex gap-2"><input className="input max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search articles" /><button type="button" className={buttonClass} onClick={load}>Search</button></div>
      {articles.length === 0 && <div className="mt-6"><EmptyState title="No articles" text="Seed the database or publish one from the admin area." /></div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {articles.map((article) => (
          <button key={article._id} type="button" onClick={() => setPage('article', article.slug)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#FF7518]">{article.category}</p>
            <h2 className="mt-2 text-lg font-bold">{article.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{article.excerpt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArticlePage({ slug, setPage }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/articles/${slug}`).then(setData).catch((requestError) => setError(requestError.message));
  }, [slug]);
  if (error) return <div className="mx-auto max-w-3xl px-4 py-8"><Notice tone="error">{error}</Notice></div>;
  if (!data) return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500">Loading article…</div>;
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <button type="button" className="text-sm font-semibold text-[#FF7518]" onClick={() => setPage('blog')}>All guides</button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#FF7518]">{data.article.category}</p>
      <h1 className="mt-2 text-4xl font-black text-[#101828]">{data.article.title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">{data.article.body.split('\n\n').map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}</div>
      {data.related?.length > 0 && <div className="mt-8"><h2 className="font-bold">Related</h2><div className="mt-3 grid gap-2">{data.related.map((article) => <button key={article._id} type="button" className="text-left text-sm font-semibold text-[#FF7518]" onClick={() => setPage('article', article.slug)}>{article.title}</button>)}</div></div>}
    </article>
  );
}

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await api('/api/contact', { method: 'POST', body: form });
      setSuccess(result.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (requestError) {
      setError(requestError.details?.join(' ') || requestError.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader eyebrow="Contact" title="Send a message" description="Messages are validated and stored for an administrator to review. This form does not send email by itself." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {success && <div className="mb-4"><Notice tone="success">{success}</Notice></div>}
      <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
        <Field label="Name"><input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Subject"><input className="input" required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></Field>
        <Field label="Message"><textarea className="input min-h-32" required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></Field>
        <button className={buttonClass} disabled={loading} type="submit">{loading ? 'Sending…' : 'Send message'}</button>
      </form>
    </div>
  );
}
