import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { ErrorBlock, PageTitle } from '../components/ui.jsx';
import { formatRange } from '../format.js';
import { useToast } from '../components/useToast.js';

function messageFor(status) {
  if (status === 'waitlisted') return 'You are on the waitlist. If a confirmed guest cancels, the earliest waitlisted guest is moved into the seat.';
  if (status === 'cancelled') return 'This registration has been cancelled.';
  if (status === 'checked_in') return 'This ticket has been checked in.';
  return 'You are registered. A confirmation is saved with your ticket.';
}

function calendarStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function downloadIcs(ticket) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventra//EN',
    'BEGIN:VEVENT',
    `UID:${ticket.ticketCode}@eventra`,
    `DTSTAMP:${calendarStamp(new Date().toISOString())}`,
    `DTSTART:${calendarStamp(ticket.event.startsAt)}`,
    `DTEND:${calendarStamp(ticket.event.endsAt)}`,
    `SUMMARY:${ticket.event.title}`,
    `LOCATION:${ticket.event.venue}, ${ticket.event.city}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eventra-${ticket.ticketCode}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ConfirmationPage() {
  const { code } = useParams();
  const location = useLocation();
  const cached = location.state?.registration;
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/tickets/${code}`, { signal: controller.signal })
      .then((data) => setTicket(data.ticket))
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [code, attempt]);

  const email = cached?.ticketCode === code ? cached.email : ticket?.email;
  if (!ticket && !error) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;

  return (
    <div className="page">
      <PageTitle title="Registration successful" />
      <div className="wrap success">
        {error ? <ErrorBlock message={error} onRetry={() => setAttempt((value) => value + 1)} /> : null}
        {ticket ? (
          <section className="success-card">
            <div className="check check-draw" aria-hidden="true">✓</div>
            <h1>Registration Successful!</h1>
            <p className="muted">{messageFor(ticket.status)}</p>
            <p><strong>{ticket.fullName}</strong></p>
            <p className="meta">Reference {ticket.ticketCode}</p>
            <article className="mini-event panel">
              <Photo src={ticket.event.imageUrl} alt="" />
              <div>
                <strong>{ticket.event.title}</strong>
                <p className="meta">{formatRange(ticket.event.startsAt, ticket.event.endsAt)}</p>
                <p className="meta">{ticket.event.venue}, {ticket.event.city}</p>
                <p className="meta">{email}</p>
              </div>
            </article>
            <div className="actions">
              <Link className="btn btn-primary" to={`/tickets/${ticket.ticketCode}`}>View Ticket</Link>
              <a className="btn btn-ghost" href={`/api/tickets/${ticket.ticketCode}/download`}>Download Ticket</a>
              <button type="button" className="btn btn-ghost" onClick={() => downloadIcs(ticket)}>Add to Calendar</button>
              <Link className="btn btn-ghost" to="/events">Explore More Events</Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function TicketPage() {
  const { code } = useParams();
  const toast = useToast();
  const location = useLocation();
  const cached = location.state?.registration;
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/tickets/${code}`, { signal: controller.signal })
      .then((data) => setTicket(data.ticket))
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [code, attempt]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: ticket?.event.title || 'Eventra ticket', url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Ticket link copied.');
      }
    } catch {
      toast('Copy the address from the browser bar.', 'warn');
    }
  }

  const email = cached?.ticketCode === code ? cached.email : ticket?.email;
  if (!ticket && !error) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;

  return (
    <div className="page">
      <PageTitle title="Ticket" />
      <div className="wrap">
        {error ? <ErrorBlock message={error} onRetry={() => setAttempt((value) => value + 1)} /> : null}
        {ticket ? (
          <div className="ticket-layout">
            <article className="ticket">
              <Photo className="ticket-photo" src={ticket.event.imageUrl} alt="" />
              <h1>Your Event Ticket</h1>
              <h2>{ticket.event.title}</h2>
              <p className="meta">{formatRange(ticket.event.startsAt, ticket.event.endsAt)}</p>
              <p className="meta">{ticket.event.venue}, {ticket.event.city}</p>
              {ticket.qrDataUrl ? <img className="qr" src={ticket.qrDataUrl} alt={`QR code for ticket ${ticket.ticketCode}`} /> : null}
            </article>
            <article className="panel">
              <p className="kicker">Important information</p>
              <h2>{ticket.fullName}</h2>
              <p className="muted">{email}</p>
              <p>{ticket.organization}</p>
              <p className="badge">{ticket.ticketCode}</p>
              <p className="muted">{messageFor(ticket.status)}</p>
              <ul className="perk-list">
                <li>Bring a valid ID for entry.</li>
                <li>This ticket is not transferable.</li>
                <li>Check in opens at the door.</li>
              </ul>
              <div className="actions">
                <a className="btn btn-primary" href={`/api/tickets/${ticket.ticketCode}/download`}>Download Ticket</a>
                <button type="button" className="btn btn-ghost" onClick={share}>Share</button>
                <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>Print</button>
              </div>
            </article>
          </div>
        ) : null}
      </div>
    </div>
  );
}
