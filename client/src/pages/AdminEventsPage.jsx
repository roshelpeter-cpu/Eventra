import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { useToast } from '../components/useToast.js';
import { ConfirmDialog, ErrorBlock, PageTitle, StatusBadge } from '../components/ui.jsx';
import { formatDay } from '../format.js';

const FILTERS = [
  ['all', 'All'],
  ['published', 'Published'],
  ['draft', 'Drafts'],
  ['cancelled', 'Called off'],
  ['archived', 'Archived'],
];

export function AdminEventsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/events?status=${status}&sort=soonest${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      setEvents(data.events);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    const handle = window.setTimeout(() => { load(); }, 200);
    return () => window.clearTimeout(handle);
  }, [load, attempt]);

  async function applyStatus(event, nextStatus) {
    setBusy(true);
    try {
      await api(`/api/admin/events/${event.id}`, { method: 'PATCH', body: { status: nextStatus } });
      toast(`${event.title} is now ${nextStatus}.`);
      setPending(null);
      await load();
    } catch (updateError) {
      toast(updateError.message, 'warn');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageTitle title="Events" />
      <div className="admin-top">
        <div>
          <p className="kicker">Events</p>
          <h1>Manage Events</h1>
        </div>
        <Link className="btn btn-primary" to="/admin/events/new">Create Event</Link>
      </div>
      <div className="toolbar">
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="event-admin-search">Search</label>
          <input id="event-admin-search" value={query} placeholder="Title, city, venue" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="chip-row">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className="chip" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
      </div>
      {error ? <ErrorBlock message={error} onRetry={() => setAttempt((value) => value + 1)} /> : null}
      {loading && !error ? <div className="skeleton skeleton-card" /> : null}
      {!loading && !error && events.length === 0 ? <div className="empty"><h2>No events in this view.</h2><p>Create one, or choose another status.</p></div> : null}
      {!loading && !error && events.length > 0 ? (
        <div className="table-card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td data-label="Event">
                    <div className="event-cell">
                      <Photo src={event.imageUrl} alt="" />
                      <span><strong>{event.title}</strong><br />{event.category} · {event.city}</span>
                    </div>
                  </td>
                  <td data-label="When">{formatDay(event.startsAt)}</td>
                  <td data-label="Seats">{event.confirmedCount}/{event.capacity}{event.waitlistCount ? ` · ${event.waitlistCount} waiting` : ''}</td>
                  <td data-label="Status"><StatusBadge status={event.status} /></td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <Link className="btn btn-ghost btn-small" to={`/admin/events/${event.id}/edit`}>Edit</Link>
                      {event.status !== 'published' && event.status !== 'archived' ? (
                        <button type="button" className="btn btn-small btn-primary" onClick={() => applyStatus(event, 'published')}>Publish</button>
                      ) : null}
                      {event.status === 'published' ? (
                        <>
                          <button type="button" className="btn btn-small btn-ghost" onClick={() => applyStatus(event, 'draft')}>Unpublish</button>
                          <button type="button" className="btn btn-small btn-danger" onClick={() => setPending({ event, status: 'cancelled' })}>Cancel</button>
                        </>
                      ) : null}
                      {event.status !== 'archived' ? (
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => setPending({ event, status: 'archived' })}>Archive</button>
                      ) : (
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => applyStatus(event, 'draft')}>Restore to draft</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.status === 'archived' ? `Archive ${pending?.event.title}?` : `Cancel ${pending?.event.title}?`}
        description={pending?.status === 'archived'
          ? 'Archived events leave the public calendar. Registrations stay in the database.'
          : 'Cancelled events stay visible as called off. New registration closes. Existing guests remain on the list.'}
        confirmLabel={pending?.status === 'archived' ? 'Archive event' : 'Cancel event'}
        danger
        busy={busy}
        onConfirm={() => applyStatus(pending.event, pending.status)}
        onClose={() => { if (!busy) setPending(null); }}
      />
    </section>
  );
}
