import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/useToast.js';
import { ConfirmDialog, Dialog, ErrorBlock, PageTitle, StatusBadge } from '../components/ui.jsx';
import { statusLabel } from '../constants.js';
import { formatWhen } from '../format.js';

export function AdminAttendeesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null);
  const [selected, setSelected] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const search = params.toString();
  const status = params.get('status') || 'all';
  const eventId = params.get('eventId') || '';
  const loadKey = `${search}|${attempt}`;
  const [seenKey, setSeenKey] = useState(loadKey);
  if (seenKey !== loadKey) {
    setSeenKey(loadKey);
    setLoading(true);
    setError('');
  }

  useEffect(() => {
    api('/api/admin/events?status=all&sort=title').then((data) => setEvents(data.events)).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    const current = params.get('q') || '';
    if (current === query) return undefined;
    const handle = window.setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query) next.set('q', query);
        else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, params, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    const request = new URLSearchParams(search);
    request.set('pageSize', '8');
    api(`/api/admin/registrations?${request.toString()}`, { signal: controller.signal })
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [search, attempt]);

  function updateFilter(patch, { resetPage = true } = {}) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
      });
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  }

  async function changeStatus(registration, nextStatus) {
    setBusyId(registration.id);
    try {
      await api(`/api/admin/registrations/${registration.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      toast(`${registration.fullName} is now ${statusLabel(nextStatus).toLowerCase()}.`);
      setPending(null);
      setAttempt((value) => value + 1);
    } catch (updateError) {
      toast(updateError.message, 'warn');
    } finally {
      setBusyId(null);
    }
  }

  const exportQuery = new URLSearchParams(search);
  exportQuery.delete('page');
  exportQuery.delete('pageSize');

  return (
    <section>
      <PageTitle title="Attendees" />
      <div className="admin-top">
        <div>
          <p className="kicker">Attendees</p>
          <h1>Registered participants</h1>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to="/admin/check-in">Door check-in</Link>
          <a className="btn btn-primary" href={`/api/admin/registrations.csv?${exportQuery.toString()}`}>Export CSV</a>
        </div>
      </div>
      <div className="toolbar">
        <div className="field">
          <label htmlFor="attendee-search">Search</label>
          <input id="attendee-search" value={query} placeholder="Name, email, ticket, event" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="attendee-event">Event</label>
          <select id="attendee-event" value={eventId} onChange={(event) => updateFilter({ eventId: event.target.value })}>
            <option value="">All events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="attendee-status">Status</label>
          <select id="attendee-status" value={status} onChange={(event) => updateFilter({ status: event.target.value })}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlisted">Waitlist</option>
            <option value="checked_in">Checked in</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      {error ? <ErrorBlock message={error} onRetry={() => setAttempt((value) => value + 1)} /> : null}
      {loading && !error ? <div className="skeleton skeleton-card" /> : null}
      {!loading && result && result.registrations.length === 0 ? (
        <div className="empty"><h2>No attendees match.</h2><p>Registrations appear here as soon as a guest claims a seat or joins a waitlist.</p></div>
      ) : null}
      {!loading && result && result.registrations.length > 0 ? (
        <div className="table-card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>College / organization</th>
                <th>Domain interests</th>
                <th>Event</th>
                <th>Registered</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.registrations.map((registration) => (
                <tr key={registration.id}>
                  <td data-label="Name"><strong>{registration.fullName}</strong></td>
                  <td data-label="Email">{registration.email}</td>
                  <td data-label="College / organization">{registration.organization}</td>
                  <td data-label="Domain interests">{registration.interests.join(', ')}</td>
                  <td data-label="Event">{registration.event.title}</td>
                  <td data-label="Registered">{formatWhen(registration.createdAt)}</td>
                  <td data-label="Status"><StatusBadge status={registration.status} /></td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected(registration)}>View</button>
                      {registration.status === 'confirmed' ? (
                        <button type="button" className="btn btn-small btn-primary" disabled={busyId === registration.id} onClick={() => changeStatus(registration, 'checked_in')}>Check in</button>
                      ) : null}
                      {registration.status === 'waitlisted' || registration.status === 'cancelled' ? (
                        <button type="button" className="btn btn-small btn-dark" disabled={busyId === registration.id} onClick={() => changeStatus(registration, 'confirmed')}>Confirm seat</button>
                      ) : null}
                      {registration.status === 'checked_in' ? (
                        <button type="button" className="btn btn-small btn-ghost" disabled={busyId === registration.id} onClick={() => changeStatus(registration, 'confirmed')}>Undo check-in</button>
                      ) : null}
                      {registration.status !== 'cancelled' ? (
                        <button type="button" className="btn btn-small btn-danger" disabled={busyId === registration.id} onClick={() => setPending(registration)}>Cancel</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pager">
            <button type="button" className="btn btn-ghost btn-small" disabled={result.page <= 1} onClick={() => updateFilter({ page: String(result.page - 1) }, { resetPage: false })}>Previous</button>
            <p>Page {result.page} of {result.pages} · {result.total} guests</p>
            <button type="button" className="btn btn-ghost btn-small" disabled={result.page >= result.pages} onClick={() => updateFilter({ page: String(result.page + 1) }, { resetPage: false })}>Next</button>
          </div>
        </div>
      ) : null}
      <Dialog open={Boolean(selected)} title={selected ? selected.fullName : 'Registration'} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="review-list">
            <div><span>Email</span><strong>{selected.email}</strong></div>
            <div><span>College / organization</span><strong>{selected.organization}</strong></div>
            <div><span>Domain interests</span><strong>{selected.interests.join(', ')}</strong></div>
            <div><span>Event</span><strong>{selected.event.title}</strong></div>
            <div><span>Registered</span><strong>{formatWhen(selected.createdAt)}</strong></div>
            <div><span>Status</span><strong>{statusLabel(selected.status)}</strong></div>
            <div><span>Ticket</span><strong>{selected.ticketCode}</strong></div>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `Cancel ${pending.fullName}?` : 'Cancel registration'}
        description="A cancelled confirmed seat can promote the earliest waitlisted guest for a published event."
        confirmLabel="Cancel registration"
        danger
        busy={busyId === pending?.id}
        onConfirm={() => changeStatus(pending, 'cancelled')}
        onClose={() => { if (!busyId) setPending(null); }}
      />
    </section>
  );
}
