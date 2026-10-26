import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Field, Notice, buttonClass } from '../components/ui';

export function LoginPage({ setPage }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form);
      setPage('dashboard');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell
      setPage={setPage}
      title="Sign in to your portal"
      text="Access your dashboard, estimates, designs, orders, and repair projects."
    >
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Email"><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <button className={buttonClass} disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" className="font-semibold text-[#FF7518]" onClick={() => setPage('forgot')}>Forgot password</button>
        <button type="button" className="font-medium text-slate-600 hover:text-slate-900" onClick={() => setPage('register')}>Create an account</button>
      </div>
    </AuthShell>
  );
}

export function RegisterPage({ setPage }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form);
      setPage('dashboard');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell
      setPage={setPage}
      title="Create your portal account"
      text="Save projects, designs, estimates, and material orders to your BuildRight account."
    >
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Name"><input className="input" required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <button className={buttonClass} disabled={loading} type="submit">{loading ? 'Creating…' : 'Register'}</button>
      </form>
      <button type="button" className="mt-4 text-sm font-semibold text-[#FF7518]" onClick={() => setPage('login')}>Already registered? Sign in</button>
    </AuthShell>
  );
}

export function ForgotPage({ setPage }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setMessage(result.message);
      setToken(result.developmentResetToken || '');
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <AuthShell
      setPage={setPage}
      title="Reset your password"
      text="Email delivery is not configured. In development, a reset token is returned so you can finish the flow."
    >
      {error && <Notice tone="error">{error}</Notice>}
      {message && <div className="mt-4"><Notice tone="success">{message}</Notice></div>}
      {token && <p className="mt-3 break-all rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Development reset token: {token}</p>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Email"><input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <button className={buttonClass} type="submit">Create reset token</button>
      </form>
      <button type="button" className="mt-4 text-sm font-semibold text-[#FF7518]" onClick={() => setPage('login')}>Back to sign in</button>
    </AuthShell>
  );
}

export function ResetPage({ setPage }) {
  const [form, setForm] = useState({ email: '', token: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/auth/reset-password', { method: 'POST', body: form });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <AuthShell
      setPage={setPage}
      title="Choose a new password"
      text="Paste the reset token from the previous step."
    >
      {error && <Notice tone="error">{error}</Notice>}
      {message && <div className="mt-4"><Notice tone="success">{message}</Notice></div>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Reset token"><input className="input" required value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} /></Field>
        <Field label="New password"><input className="input" type="password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <button className={buttonClass} type="submit">Update password</button>
      </form>
      <button type="button" className="mt-4 text-sm font-semibold text-[#FF7518]" onClick={() => setPage('login')}>Back to sign in</button>
    </AuthShell>
  );
}

function AuthShell({ title, text, children, setPage }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F1F5F9] lg:flex-row">
      <aside className="flex flex-col justify-between bg-[#0B1220] px-6 py-8 text-white lg:w-[42%] lg:px-10 lg:py-12">
        <div>
          <button
            type="button"
            onClick={() => setPage?.('home')}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </button>
          <div className="flex items-center gap-3">
            <img src="/logoB.png" alt="" className="h-11 w-11 rounded-lg object-cover object-top" />
            <div>
              <p className="text-lg font-bold tracking-tight">BuildRight</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Client & admin portal</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-sm text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
            Construction planning tools in one workspace
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Sign in to manage estimates, designs, material orders, and repair projects from a dedicated business portal.
          </p>
        </div>
        <ul className="mt-10 hidden space-y-3 text-sm text-slate-300 lg:block">
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7518]" />Cost estimation & quantity tools</li>
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7518]" />Design studio and saved projects</li>
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7518]" />Marketplace orders & repair planning</li>
        </ul>
      </aside>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF7518]">Account</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
