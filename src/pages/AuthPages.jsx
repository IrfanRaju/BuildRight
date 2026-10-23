import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Field, Notice, PageHeader, buttonClass } from '../components/ui';

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
    <AuthShell title="Sign in" text="Use the account you registered. The development admin is created by the seed script.">
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <button className={buttonClass} disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-4 flex justify-between text-sm"><button type="button" className="font-semibold text-[#FF7518]" onClick={() => setPage('forgot')}>Forgot password</button><button type="button" onClick={() => setPage('register')}>Create an account</button></div>
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
    <AuthShell title="Create an account" text="Your projects, designs, and estimates stay on your account.">
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Name"><input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <button className={buttonClass} disabled={loading} type="submit">{loading ? 'Creating…' : 'Register'}</button>
      </form>
      <button type="button" className="mt-4 text-sm font-semibold text-[#FF7518]" onClick={() => setPage('login')}>Already registered? Sign in</button>
    </AuthShell>
  );
}

export function ForgotPage() {
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
    <AuthShell title="Reset your password" text="Email delivery is not configured. In development, a reset token is returned so you can finish the flow.">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <div className="mt-4"><Notice tone="success">{message}</Notice></div>}
      {token && <p className="mt-3 break-all rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">Development reset token: {token}</p>}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Email"><input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <button className={buttonClass} type="submit">Create reset token</button>
      </form>
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
    <AuthShell title="Choose a new password" text="Paste the reset token from the previous step.">
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

function AuthShell({ title, text, children }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <PageHeader eyebrow="Account" title={title} description={text} />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">{children}</div>
    </div>
  );
}
