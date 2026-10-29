import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { BrandMark } from '../components/Icons.jsx';
import { ThemeToggle } from '../components/Layout.jsx';
import { Photo } from '../components/EventCard.jsx';
import { Field, PageTitle } from '../components/ui.jsx';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState('checking');

  useEffect(() => {
    api('/api/admin/me')
      .then(() => setExisting('yes'))
      .catch(() => setExisting('no'));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter the administrator email and password.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/login', { method: 'POST', body: { email, password } });
      navigate('/admin');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  if (existing === 'yes') return <Navigate to="/admin" replace />;

  return (
    <div className="login-split">
      <PageTitle title="Administrator sign in" />
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="actions">
            <Link to="/" className="wordmark"><BrandMark /> Eventra</Link>
            <ThemeToggle />
          </div>
          <div>
            <h1>Welcome Back</h1>
            <p className="muted">Sign in to the administrator dashboard. Visitors can browse and register without an account.</p>
          </div>
          <Field id="admin-email" label="Email" error={!email && error ? 'Enter an email.' : ''}>
            <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <div className="password-row">
              <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy || existing === 'checking'}>{busy ? 'Signing in…' : 'Log in'}</button>
          <Link to="/events">Back to event discovery</Link>
        </form>
      </section>
      <section className="login-visual" aria-hidden="true">
        <Photo src="/photos/login.jpg" alt="" />
        <div className="login-caption">
          <p className="kicker" style={{ color: 'white' }}>Eventra</p>
          <h2>Be part of something bigger.</h2>
          <p>Attend events, build skills, and meet people who are creating what comes next.</p>
        </div>
      </section>
    </div>
  );
}
