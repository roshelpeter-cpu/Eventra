import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { Field, PageTitle } from '../components/ui.jsx';
import { formatRange } from '../format.js';

export function TicketsHome() {
  const [email, setEmail] = useState('');
  const [ticketCode, setTicketCode] = useState('');
  const [ticket, setTicket] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(formEvent) {
    formEvent.preventDefault();
    setError('');
    setErrors({});
    setBusy(true);
    try {
      const data = await api('/api/tickets/lookup', { method: 'POST', body: { email, ticketCode } });
      setTicket(data.ticket);
    } catch (lookupError) {
      setTicket(null);
      setErrors(lookupError.fields || {});
      setError(lookupError.message);
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
        <p className="lede">Enter the email and ticket reference from your registration.</p>
        <form className="form-card stack" onSubmit={lookup}>
          <Field id="ticket-email" label="Email address" error={errors.email}>
            <input id="ticket-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field id="ticket-reference" label="Ticket reference" error={errors.ticketCode}>
            <input id="ticket-reference" autoComplete="off" value={ticketCode} onChange={(event) => setTicketCode(event.target.value)} required />
          </Field>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Find ticket'}</button>
        </form>
        {ticket ? (
          <article className="ticket panel ticket-result">
            <Photo className="ticket-photo" src={ticket.event?.imageUrl} alt="" />
            <h2>{ticket.event?.title}</h2>
            <p className="meta">{formatRange(ticket.event?.startsAt, ticket.event?.endsAt)}</p>
            <p className="meta">{ticket.event?.venue}, {ticket.event?.city}</p>
            <p className="meta">{ticket.ticketLabel}</p>
            <p className="badge">{ticket.ticketCode}</p>
            {ticket.qrDataUrl ? <img className="qr" src={ticket.qrDataUrl} alt={`QR code for ticket ${ticket.ticketCode}`} /> : null}
            <div className="actions">
              <a className="btn btn-primary" href={`/api/tickets/${ticket.ticketCode}/download`}>Download ticket</a>
              <Link className="btn btn-ghost" to={`/tickets/${ticket.ticketCode}`}>Open ticket</Link>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
