import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EventCard } from '../components/EventCard.jsx';
import { EmptyState, ErrorBlock, Field, PageTitle } from '../components/ui.jsx';
import { readSaved } from '../saved.js';

export function SavedPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const sync = () => setVersion((value) => value + 1);
    window.addEventListener('eventra-saved', sync);
    return () => window.removeEventListener('eventra-saved', sync);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const saved = readSaved();
    if (!saved.length) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }
    api('/api/events?limit=48', { signal: controller.signal })
      .then((data) => {
        const wanted = new Set(saved);
        setEvents(data.events.filter((event) => wanted.has(event.slug)));
        setLoading(false);
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [version]);

  return (
    <div className="page">
      <PageTitle title="Saved events" />
      <div className="wrap">
        <p className="kicker">On this device</p>
        <h1>Saved events</h1>
        <p className="lede">Favourites stay in this browser. They are not an account.</p>
        {error ? <ErrorBlock message={error} /> : null}
        {loading ? <div className="skeleton" /> : null}
        {!loading && !error && events.length === 0 ? (
          <EmptyState title="No saved events yet." body="Use the heart on an event card to keep it here." action={<Link className="btn btn-primary" to="/events">Browse events</Link>} />
        ) : null}
        {!loading && events.length > 0 ? (
          <div className="event-grid">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TicketsHome() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [issued, setIssued] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(formEvent) {
    formEvent.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/tickets/access', { method: 'POST', body: { email } });
      setIssued(data);
      setTickets(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(formEvent) {
    formEvent.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/tickets/access/verify', { method: 'POST', body: { email, code } });
      setTickets(data.tickets || []);
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageTitle title="Tickets" />
      <div className="wrap narrow">
        <p className="kicker">Lookup</p>
        <h1>Find your tickets</h1>
        <p className="lede">Enter the email used at registration. In this demo the code is shown here and is not emailed.</p>
        <form className="form-card stack" onSubmit={issued ? verify : requestCode}>
          <Field id="ticket-email" label="Email address">
            <input id="ticket-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          {issued ? (
            <>
              <p className="demo-code">
                <span>Development only</span>
                <strong>{issued.code}</strong>
                <span>{issued.message}</span>
              </p>
              <Field id="ticket-code" label="Code">
                <input id="ticket-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
              </Field>
            </>
          ) : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : issued ? 'Show tickets' : 'Send code'}</button>
        </form>
        {tickets ? (
          <div className="stack ticket-results">
            {tickets.length === 0 ? <p className="muted">No tickets are saved for that email.</p> : null}
            {tickets.map((ticket) => (
              <Link key={ticket.ticketCode} className="panel ticket-result" to={`/tickets/${ticket.ticketCode}`}>
                <strong>{ticket.event?.title || 'Event'}</strong>
                <span className="meta">{ticket.ticketLabel} · {ticket.ticketCode}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
