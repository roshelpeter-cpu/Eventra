import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { EmptyState, Field, PageTitle } from '../components/ui.jsx';
import { formatTimeRange } from '../format.js';

function clock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatEventDate(iso) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function statusLabel(status) {
  if (status === 'checked_in') return 'Checked in';
  if (status === 'waitlisted') return 'Waitlisted';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'confirmed') return 'Confirmed';
  return 'Registered';
}

export function TicketsHome() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verification, setVerification] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const immediate = window.setTimeout(tick, 0);
    if (step !== 'code') return () => window.clearTimeout(immediate);
    const timer = window.setInterval(tick, 500);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [step]);

  const resendWait = now ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;
  const expireWait = now && verification?.expiresAt
    ? Math.max(0, Math.ceil((new Date(verification.expiresAt).getTime() - now) / 1000))
    : null;
  const codeExpired = expireWait === 0;

  function reset() {
    setStep('email');
    setOtp('');
    setVerification(null);
    setTickets([]);
    setError('');
    setErrors({});
  }

  async function requestCode(formEvent) {
    formEvent?.preventDefault();
    setError('');
    setErrors({});
    setBusy(true);
    try {
      const data = await api('/api/tickets/otp', { method: 'POST', body: { email } });
      if (!data?.verification?.sent) {
        setError('We could not send a verification code. Please try again.');
        return;
      }
      setVerification(data.verification);
      setResendAt(new Date(data.verification.resendAvailableAt).getTime());
      setNow(Date.now());
      setOtp('');
      setStep('code');
    } catch (requestError) {
      setErrors(requestError.fields || {});
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(formEvent) {
    formEvent.preventDefault();
    setError('');
    setBusy(true);
    try {
      const verified = await api('/api/tickets/otp/verify', {
        method: 'POST',
        body: { email, code: otp },
      });
      const listed = await api('/api/tickets/list', {
        method: 'POST',
        body: { accessToken: verified.accessToken },
      });
      setTickets(listed.tickets || []);
      setStep('list');
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageTitle title="My Tickets" />
      <div className="wrap narrow">
        <p className="kicker">Tickets</p>
        <h1>My Tickets</h1>
        <p className="lede">Enter the email address you used when registering.</p>

        {step === 'email' ? (
          <form className="form-card stack" onSubmit={requestCode}>
            <Field id="ticket-email" label="Email address" error={errors.email}>
              <input id="ticket-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Find My Tickets'}</button>
          </form>
        ) : null}

        {step === 'code' ? (
          <form className="form-card stack" onSubmit={verifyCode}>
            <h2>Verify your email</h2>
            <p>We've sent a verification code to your email address.</p>
            <p className="meta">{verification?.maskedEmail}</p>
            <p className="meta" role="status">{expireWait == null ? '' : codeExpired ? 'This code has expired.' : `Code expires in ${clock(expireWait)}`}</p>
            <Field id="ticket-otp" label="Verification code" error={error}>
              <input
                id="ticket-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-invalid={Boolean(error)}
              />
            </Field>
            <div className="actions">
              <button className="btn btn-ghost" type="button" onClick={reset}>Use a different email</button>
              <button className="btn btn-ghost" type="button" onClick={() => requestCode()} disabled={resendWait > 0 || busy}>
                {busy ? 'Sending…' : resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy || codeExpired || otp.length !== 6}>Verify</button>
            </div>
          </form>
        ) : null}

        {step === 'list' ? (
          <div className="stack">
            <div className="actions">
              <button className="btn btn-ghost" type="button" onClick={reset}>Use a different email</button>
            </div>
            {tickets.length === 0 ? (
              <EmptyState
                title="No tickets found for this email address."
                body="Tickets appear here after you register for an event."
                action={<Link className="btn btn-primary" to="/events">Explore upcoming events</Link>}
              />
            ) : (
              <div className="ticket-list">
                {tickets.map((ticket) => (
                  <article className="panel ticket-card" key={ticket.ticketCode}>
                    <Photo className="ticket-photo" src={ticket.event?.imageUrl} alt="" />
                    <div className="ticket-body">
                      <h2>{ticket.event?.title}</h2>
                      <p className="badge">{ticket.ticketCode}</p>
                      <p className="meta">{formatEventDate(ticket.event?.startsAt)}</p>
                      <p className="meta">{formatTimeRange(ticket.event?.startsAt, ticket.event?.endsAt || ticket.event?.startsAt)}</p>
                      <p className="meta">{ticket.event?.venue}, {ticket.event?.city}</p>
                      <p className="meta">{ticket.ticketLabel} · {ticket.quantity} {ticket.quantity === 1 ? 'ticket' : 'tickets'}</p>
                      <p className={`badge badge-${ticket.status}`}>{statusLabel(ticket.status)}</p>
                      {ticket.qrDataUrl ? <img className="qr" src={ticket.qrDataUrl} alt={`QR code for ticket ${ticket.ticketCode}`} /> : null}
                      <div className="actions">
                        <Link className="btn btn-primary" to={`/tickets/${ticket.ticketCode}`}>View ticket</Link>
                        <a className="btn btn-ghost" href={`/api/tickets/${ticket.ticketCode}/download`}>Download ticket</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
