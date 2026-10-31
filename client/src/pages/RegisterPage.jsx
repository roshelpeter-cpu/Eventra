import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { ErrorBlock, Field, PageTitle } from '../components/ui.jsx';
import { INTERESTS } from '../constants.js';
import { eventFormat, formatMoney, formatRange, placeLine } from '../format.js';
import { readDraft, writeDraft } from '../saved.js';
import { validateRegistration } from '../validation.js';

const STEPS = ['Tickets', 'Your details', 'Review'];

function choicesFor(event) {
  if (event.ticketTypes?.length) return event.ticketTypes;
  return [{
    id: null,
    name: 'General admission',
    priceCents: event.priceCents || 0,
    feeCents: 0,
    currency: 'USD',
  }];
}

export function RegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const draft = readDraft(id);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(draft?.step || 0);
  const [ticketTypeId, setTicketTypeId] = useState(draft?.ticketTypeId ?? null);
  const [quantity, setQuantity] = useState(draft?.quantity || 1);
  const [values, setValues] = useState(draft?.values || { fullName: '', email: '', organization: '', interests: [], consent: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/events/${id}`, { signal: controller.signal })
      .then((data) => setEvent(data.event))
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [id]);

  const choices = event ? choicesFor(event) : [];
  const selected = choices.find((type) => String(type.id) === String(ticketTypeId)) || choices[0];
  const maxQuantity = Math.max(1, Math.min(10, event?.seatsRemaining || 1));
  const safeQuantity = event?.seatsRemaining === 0 ? 1 : Math.min(quantity, maxQuantity);
  const subtotal = selected ? selected.priceCents * safeQuantity : 0;
  const fees = selected ? selected.feeCents * safeQuantity : 0;
  const total = subtotal + fees;
  const currency = 'USD';
  const waitlist = Boolean(event && event.seatsRemaining === 0 && total === 0 && !event.ended && event.status !== 'cancelled');

  useEffect(() => {
    if (!event) return;
    writeDraft(event.slug, { step, ticketTypeId: selected?.id ?? null, quantity: safeQuantity, values });
    writeDraft(String(event.id), { step, ticketTypeId: selected?.id ?? null, quantity: safeQuantity, values });
  }, [event, step, selected?.id, safeQuantity, values]);

  function toggleInterest(interest) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  function continueFromTickets() {
    setFormError('');
    if (!selected) {
      setFormError('Choose a ticket.');
      return;
    }
    if (!waitlist && safeQuantity > (event?.seatsRemaining || 0)) {
      setFormError(`Only ${event.seatsRemaining} seats are available.`);
      return;
    }
    setStep(1);
  }

  function continueFromPersonal(formEvent) {
    formEvent.preventDefault();
    const nextErrors = validateRegistration({ ...values, consent: true });
    delete nextErrors.consent;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStep(2);
  }

  async function submit(formEvent) {
    formEvent.preventDefault();
    const nextErrors = validateRegistration(values);
    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length || !event || !selected) {
      if (nextErrors.fullName || nextErrors.email || nextErrors.organization || nextErrors.interests) setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const data = await api(`/api/events/${event.id}/checkout`, {
        method: 'POST',
        body: {
          fullName: values.fullName,
          email: values.email,
          organization: values.organization,
          interests: values.interests,
          quantity: waitlist ? 1 : safeQuantity,
          ticketTypeId: selected.id,
          waitlist,
        },
      });
      if (data.registration) {
        navigate(`/confirmation/${data.registration.ticketCode}`, { state: { registration: data.registration } });
        return;
      }
      navigate(`/pay/${data.payment.publicId}`);
    } catch (submitError) {
      setFieldErrors(submitError.fields || {});
      setFormError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <div className="page"><div className="wrap"><ErrorBlock message={error} /></div></div>;
  if (!event || !selected) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;
  const closed = event.status === 'cancelled' || event.ended;

  return (
    <div className="page">
      <PageTitle title={`Register · ${event.title}`} />
      <div className="wrap">
        <Link className="back-link" to={`/events/${event.slug}`}>← Back to {event.title}</Link>
        <div className="register-layout">
          <article className="panel side-card">
            <Photo src={event.imageUrl} alt="" />
            <p className="kicker">Order summary</p>
            <h2>{event.title}</h2>
            <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
            <p className="meta">{placeLine(event)} · {eventFormat(event)}</p>
            <div className="review-list">
              <div><span>{selected.name}</span><strong>{formatMoney(selected.priceCents, currency)} × {safeQuantity}</strong></div>
              <div><span>Subtotal</span><strong>{formatMoney(subtotal, currency)}</strong></div>
              <div><span>Fees</span><strong>{fees ? formatMoney(fees, currency) : 'None'}</strong></div>
              <div><span>Total</span><strong>{total ? formatMoney(total, currency) : 'Free'}</strong></div>
            </div>
            <p className="meta">{event.seatsRemaining} seats left of {event.capacity}</p>
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
            {!closed && event.seatsRemaining === 0 && total > 0 ? <p>This paid event is full. A seat is not held and payment will not be started.</p> : null}
            {!closed && !(event.seatsRemaining === 0 && total > 0) && step === 0 ? (
              <div className="stack">
                <fieldset className="field">
                  <legend>Ticket type</legend>
                  <div className="ticket-choices">
                    {choices.map((type) => (
                      <label key={type.name} className={selected.name === type.name ? 'ticket-choice on' : 'ticket-choice'}>
                        <input
                          type="radio"
                          name="ticket-type"
                          checked={selected.name === type.name}
                          onChange={() => setTicketTypeId(type.id)}
                        />
                        <span>
                          <strong>{type.name}</strong>
                          <span>{type.priceCents + type.feeCents === 0 ? 'Free' : formatMoney(type.priceCents, type.currency)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id="quantity" label="Quantity" hint={waitlist ? 'Waitlist requests are for one person.' : `Up to ${maxQuantity} seats are available for this order.`}>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max={waitlist ? 1 : maxQuantity}
                    value={safeQuantity}
                    disabled={waitlist}
                    onChange={(change) => setQuantity(Number(change.target.value) || 1)}
                  />
                </Field>
                {formError ? <p className="field-error" role="alert">{formError}</p> : null}
                <button className="btn btn-primary" type="button" onClick={continueFromTickets}>Continue</button>
              </div>
            ) : null}
            {!closed && step === 1 ? (
              <form className="form-grid" onSubmit={continueFromPersonal} noValidate>
                <Field id="full-name" label="Full Name" error={fieldErrors.fullName} hint="The name that should appear on the ticket.">
                  <input id="full-name" value={values.fullName} autoComplete="name" placeholder="Enter your full name" onChange={(change) => setValues({ ...values, fullName: change.target.value })} aria-invalid={Boolean(fieldErrors.fullName)} />
                </Field>
                <Field id="email" label="Email Address" error={fieldErrors.email} hint="Used once per event. The same address cannot register twice.">
                  <input id="email" type="email" autoComplete="email" value={values.email} placeholder="Enter your email address" onChange={(change) => setValues({ ...values, email: change.target.value })} aria-invalid={Boolean(fieldErrors.email)} />
                </Field>
                <Field id="organization" label="College / Organization" error={fieldErrors.organization}>
                  <input id="organization" value={values.organization} placeholder="Enter your college or organization" onChange={(change) => setValues({ ...values, organization: change.target.value })} aria-invalid={Boolean(fieldErrors.organization)} />
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
                  <div><span>Event</span><strong>{event.title}</strong></div>
                  <div><span>Ticket</span><strong>{selected.name} × {safeQuantity}</strong></div>
                  <div><span>Total</span><strong>{total ? formatMoney(total, currency) : 'Free'}</strong></div>
                  <div><span>Name</span><strong>{values.fullName}</strong></div>
                  <div><span>Email</span><strong>{values.email}</strong></div>
                  <div><span>College / organization</span><strong>{values.organization}</strong></div>
                  <div><span>Interests</span><strong>{values.interests.join(', ')}</strong></div>
                </div>
                <label className="checkline">
                  <input type="checkbox" checked={values.consent} onChange={(change) => setValues({ ...values, consent: change.target.checked })} />
                  <span>I confirm that this information is correct.</span>
                </label>
                {fieldErrors.consent ? <p className="field-error">{fieldErrors.consent}</p> : null}
                {formError ? <p className="field-error" role="alert">{formError}</p> : null}
                <div className="actions">
                  <button className="btn btn-ghost" type="button" onClick={() => setStep(1)} disabled={submitting}>Back</button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : waitlist ? 'Join the waitlist' : total ? 'Continue to payment' : 'Confirm registration'}
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
