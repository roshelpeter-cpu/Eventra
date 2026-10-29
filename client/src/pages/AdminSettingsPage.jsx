import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Field, PageTitle } from '../components/ui.jsx';
import { useToast } from '../components/useToast.js';
import { formatWhen } from '../format.js';
import { useTheme } from '../theme.jsx';

export function AdminSettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [admin, setAdmin] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api('/api/admin/me'), api('/api/admin/messages')])
      .then(([me, inbox]) => {
        setAdmin(me.admin);
        setMessages(inbox.messages);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError('');
    if (nextPassword.length < 10) {
      setPasswordError('Use at least 10 characters.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/password', {
        method: 'POST',
        body: { currentPassword, nextPassword },
      });
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      toast('Password updated.');
    } catch (updateError) {
      setPasswordError(updateError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageTitle title="Settings" />
      <div className="admin-top">
        <div>
          <p className="kicker">Settings</p>
          <h1>Settings</h1>
        </div>
        <Link className="btn btn-ghost" to="/admin/check-in">Door check-in</Link>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      <div className="split-cards">
        <article className="panel stack">
          <h2>Administrator</h2>
          {admin ? (
            <>
              <p><strong>{admin.name}</strong></p>
              <p className="muted">{admin.email}</p>
            </>
          ) : <div className="skeleton" />}
          <p className="hint">This is the only account that can publish events and read attendee records. Passwords are stored as bcrypt hashes.</p>
        </article>
        <article className="panel stack">
          <h2>Theme</h2>
          <p className="muted">The choice is saved in this browser and used on the public site and this dashboard.</p>
          <div className="theme-choice" role="group" aria-label="Theme">
            <button type="button" className="chip" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
            <button type="button" className="chip" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </article>
      </div>
      <form className="form-card stack" style={{ marginTop: 14 }} onSubmit={changePassword}>
        <h2>Change password</h2>
        <Field id="current-password" label="Current password">
          <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </Field>
        <Field id="next-password" label="New password" hint="At least 10 characters.">
          <input id="next-password" type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
        </Field>
        <Field id="confirm-password" label="Confirm new password">
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </Field>
        {passwordError ? <p className="field-error" role="alert">{passwordError}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
      <article className="table-card" style={{ marginTop: 14 }}>
        <h2>Contact messages</h2>
        {messages.length === 0 ? <p className="muted">No contact messages yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>From</th><th>Topic</th><th>Message</th><th>When</th></tr></thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td data-label="From"><strong>{message.name}</strong><br />{message.email}</td>
                    <td data-label="Topic">{message.topic}</td>
                    <td data-label="Message">{message.body}</td>
                    <td data-label="When">{formatWhen(message.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
