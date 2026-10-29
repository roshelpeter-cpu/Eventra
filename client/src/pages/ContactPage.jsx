import { useState } from 'react';
import { api } from '../api.js';
import { Field, PageTitle } from '../components/ui.jsx';

const TOPICS = ['General', 'Registration', 'Administrator access', 'Press'];

export function ContactPage() {
  const [values, setValues] = useState({ name: '', email: '', topic: 'General', message: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setDone(false);
    setFormError('');
    setBusy(true);
    try {
      await api('/api/contact', { method: 'POST', body: values });
      setDone(true);
      setValues({ name: '', email: '', topic: 'General', message: '' });
      setErrors({});
    } catch (error) {
      setErrors(error.fields || {});
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageTitle title="Contact" />
      <div className="wrap narrow form-card">
        <p className="kicker">Contact</p>
        <h1>Contact Eventra</h1>
        <p className="muted">Messages are saved in the local database. The administrator can read them in Settings.</p>
        <form className="form-grid" onSubmit={submit}>
          <Field id="contact-name" label="Name" error={errors.name}>
            <input id="contact-name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          </Field>
          <Field id="contact-email" label="Email" error={errors.email}>
            <input id="contact-email" type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
          </Field>
          <Field id="contact-topic" label="Topic" error={errors.topic}>
            <select id="contact-topic" value={values.topic} onChange={(event) => setValues({ ...values, topic: event.target.value })}>
              {TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
            </select>
          </Field>
          <Field id="contact-message" label="Message" error={errors.message}>
            <textarea id="contact-message" rows="5" value={values.message} onChange={(event) => setValues({ ...values, message: event.target.value })} />
          </Field>
          {formError ? <p className="field-error" role="alert">{formError}</p> : null}
          {done ? <p role="status">Message saved. Thank you.</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      </div>
    </div>
  );
}
