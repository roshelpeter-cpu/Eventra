import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { ErrorBlock, Field, PageTitle } from '../components/ui.jsx';
import { INTERESTS } from '../constants.js';
import { eventFormat, formatRange, placeLine } from '../format.js';
import { validateRegistration } from '../validation.js';

const STEPS = ['Details', 'Personal Info', 'Confirmation'];

export function RegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ fullName: '', email: '', organization: '', interests: [], consent: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [waitlist, setWaitlist] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/events/${id}`, { signal: controller.signal })
      .then((data) => {
        setEvent(data.event);
        setWaitlist(Boolean(data.event.waitlistOpen));
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [id]);

  function toggleInterest(interest) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  function continueFromDetails() {
    setFormError('');
    setStep(1);
  }

  function continueFromPersonal(formEvent) {
    formEvent.preventDefault();
    const nextErrors = validateRegistration({ ...values, consent: true });
    const personal = { ...nextErrors };
    delete personal.consent;
    setFieldErrors(personal);
    if (Object.keys(personal).length) return;
    setStep(2);
  }

  async function submit(formEvent) {
    formEvent.preventDefault();
    const nextErrors = validateRegistration(values);
    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length || !event) {
      if (nextErrors.fullName || nextErrors.email || nextErrors.organization || nextErrors.interests) setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const data = await api(`/api/events/${event.id}/registrations`, {
        method: 'POST',
        body: {
          fullName: values.fullName,
          email: values.email,
          organization: values.organization,
          interests: values.interests,
          waitlist,
        },
      });
      navigate(`/confirmation/${data.registration.ticketCode}`, { state: { registration: data.registration } });
    } catch (submitError) {
      if (submitError.code === 'CAPACITY_REACHED') setWaitlist(true);
      setFieldErrors(submitError.fields || {});
      setFormError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <div className="page"><div className="wrap"><ErrorBlock message={error} /></div></div>;
  if (!event) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;
  const closed = event.status === 'cancelled' || event.ended;

  return (
    <div className="page">
      <PageTitle title={`Register · ${event.title}`} />
      <div className="wrap">
        <Link className="back-link" to={`/events/${event.slug}`}>← Back to {event.title}</Link>
        <div className="register-layout">
          <article className="panel side-card">
            <Photo src={event.imageUrl} alt="" />
            <p className="kicker">Event summary</p>
            <h2>{event.title}</h2>
            <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
            <p className="meta">{placeLine(event)} · {eventFormat(event)}</p>
            <p>{event.confirmedCount} confirmed · {event.seatsRemaining} seats left of {event.capacity}</p>
            {event.waitlistCount ? <p className="meta">{event.waitlistCount} waiting</p> : null}
            <p className="muted">{event.summary}</p>
          </article>
          <section className="form-card">
            <h1>{waitlist ? 'Join the waitlist' : 'Register for this Event'}</h1>
            <ol className="steps">
              {STEPS.map((label, index) => (
                <li key={label} className={index === step ? 'on' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            {closed ? <p>Registration is closed for this event.</p> : null}
            {!closed && step === 0 ? (
              <div className="stack">
                <p className="muted">Confirm the event, then add your details. You do not need an account.</p>
                <div className="review-list">
                  <div><span>Event</span><strong>{event.title}</strong></div>
                  <div><span>When</span><strong>{formatRange(event.startsAt, event.endsAt)}</strong></div>
                  <div><span>Where</span><strong>{placeLine(event)}</strong></div>
                  <div><span>Capacity</span><strong>{event.seatsRemaining} seats left</strong></div>
                  <div><span>Status</span><strong>{waitlist ? 'Waitlist' : 'Open'}</strong></div>
                </div>
                <button className="btn btn-primary" type="button" onClick={continueFromDetails}>Continue</button>
              </div>
            ) : null}
            {!closed && step === 1 ? (
              <form className="form-grid" onSubmit={continueFromPersonal} noValidate>
                <Field id="full-name" label="Full Name" error={fieldErrors.fullName} hint="The name that should appear on the ticket.">
                  <input id="full-name" value={values.fullName} autoComplete="name" placeholder="Enter your full name" onChange={(event) => setValues({ ...values, fullName: event.target.value })} aria-invalid={Boolean(fieldErrors.fullName)} />
                </Field>
                <Field id="email" label="Email Address" error={fieldErrors.email} hint="Used once per event. The same address cannot register twice.">
                  <input id="email" type="email" autoComplete="email" value={values.email} placeholder="Enter your email address" onChange={(event) => setValues({ ...values, email: event.target.value })} aria-invalid={Boolean(fieldErrors.email)} />
                </Field>
                <Field id="organization" label="College / Organization" error={fieldErrors.organization}>
                  <input id="organization" value={values.organization} placeholder="Enter your college or organization" onChange={(event) => setValues({ ...values, organization: event.target.value })} aria-invalid={Boolean(fieldErrors.organization)} />
                </Field>
                <fieldset className="field">
                  <legend>Domain Interests</legend>
                  <div className="interest-grid">
                    {INTERESTS.map((interest) => (
                      <button key={interest} type="button" className="chip" aria-pressed={values.interests.includes(interest)} onClick={() => toggleInterest(interest)}>{interest}</button>
                    ))}
                  </div>
                  {fieldErrors.interests ? <p className="field-error">{fieldErrors.interests}</p> : null}
                </fieldset>
                <div className="actions">
                  <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>Back</button>
                  <button className="btn btn-primary" type="submit">Continue</button>
                </div>
              </form>
            ) : null}
            {!closed && step === 2 ? (
              <form className="form-grid" onSubmit={submit} noValidate>
                <div className="review-list">
                  <div><span>Name</span><strong>{values.fullName}</strong></div>
                  <div><span>Email</span><strong>{values.email}</strong></div>
                  <div><span>College / organization</span><strong>{values.organization}</strong></div>
                  <div><span>Interests</span><strong>{values.interests.join(', ')}</strong></div>
                  <div><span>Registration</span><strong>{waitlist ? 'Waitlist' : 'Confirmed seat, if capacity allows'}</strong></div>
                </div>
                <label className="checkline">
                  <input type="checkbox" checked={values.consent} onChange={(event) => setValues({ ...values, consent: event.target.checked })} />
                  <span>I confirm that this information is correct.</span>
                </label>
                {fieldErrors.consent ? <p className="field-error">{fieldErrors.consent}</p> : null}
                {formError ? <p className="field-error" role="alert">{formError}</p> : null}
                <div className="actions">
                  <button className="btn btn-ghost" type="button" onClick={() => setStep(1)} disabled={submitting}>Back</button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : waitlist ? 'Join the waitlist' : 'Confirm Registration'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
