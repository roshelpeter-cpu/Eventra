import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Donut, HorizontalBars, LineChart } from '../components/Charts.jsx';
import { StatIcon } from '../components/Icons.jsx';
import { ErrorBlock, PageTitle, StatusBadge } from '../components/ui.jsx';
import { formatDay, formatWhen } from '../format.js';

export function AdminOverviewPage() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/admin/metrics', { signal: controller.signal })
      .then((data) => setMetrics(data))
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) return <ErrorBlock message={error} onRetry={() => { setError(''); setAttempt((value) => value + 1); }} />;
  if (!metrics) return <div className="skeleton" />;

  const remaining = Math.max(0, metrics.publishedCapacity - metrics.publishedOccupied);
  const popular = [...metrics.capacityByEvent]
    .sort((a, b) => b.confirmedCount - a.confirmedCount)
    .slice(0, 5)
    .map((event) => ({ label: event.title, value: event.confirmedCount }));

  return (
    <section>
      <PageTitle title="Overview" />
      <div className="admin-top">
        <div>
          <p className="kicker">Overview</p>
          <h1>Dashboard</h1>
          <p className="muted">Live counts from the Eventra database.</p>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to="/admin/attendees">View Attendees</Link>
          <Link className="btn btn-primary" to="/admin/events/new">Create Event</Link>
        </div>
      </div>
      <div className="metric-grid">
        <article className="metric">
          <span className="metric-icon"><StatIcon name="events" /></span>
          <div><span>Total events</span><strong>{metrics.totals.events}</strong></div>
        </article>
        <article className="metric">
          <span className="metric-icon"><StatIcon name="people" /></span>
          <div><span>Total registrations</span><strong>{metrics.registrations.all}</strong></div>
        </article>
        <article className="metric">
          <span className="metric-icon"><StatIcon name="cities" /></span>
          <div><span>Upcoming events</span><strong>{metrics.totals.active}</strong></div>
        </article>
        <article className="metric">
          <span className="metric-icon"><StatIcon name="seats" /></span>
          <div><span>Seats remaining</span><strong>{remaining}</strong></div>
        </article>
      </div>
      <p className="meta">Published capacity is {Math.round(metrics.fillRate * 100)}% filled. Confirmed and checked-in guests occupy a seat. Waitlisted guests do not.</p>
      <div className="chart-grid">
        <article className="chart-card">
          <h2>Registration trends</h2>
          <p className="hint">New registrations over the last 14 days.</p>
          {metrics.registrationsByDay.every((point) => point.count === 0) ? <p>No registrations in this window yet.</p> : <LineChart points={metrics.registrationsByDay} />}
        </article>
        <article className="chart-card">
          <h2>Most popular categories</h2>
          {metrics.byCategory.every((row) => row.registrations === 0) ? <p>No confirmed registrations yet.</p> : (
            <Donut rows={metrics.byCategory.filter((row) => row.registrations > 0).map((row) => ({ label: row.category, value: row.registrations }))} />
          )}
        </article>
      </div>
      <div className="split-cards">
        <article className="chart-card">
          <h2>Most popular events</h2>
          {popular.every((row) => row.value === 0) ? <p className="muted">Confirmed registrations will rank events here.</p> : <HorizontalBars rows={popular} />}
        </article>
        <article className="chart-card">
          <h2>Upcoming</h2>
          {metrics.capacityByEvent.length === 0 ? <p className="muted">No upcoming published events.</p> : (
            <ul className="perk-list">
              {metrics.capacityByEvent.slice(0, 4).map((event) => (
                <li key={event.id}>
                  <strong>{event.title}</strong>
                  <p className="meta">{formatDay(event.startsAt)} · {event.confirmedCount}/{event.capacity} seats</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      <article className="table-card" style={{ marginTop: 14 }}>
        <div className="admin-top">
          <h2>Recent registrations</h2>
          <Link to="/admin/attendees">View all</Link>
        </div>
        {metrics.recentRegistrations.length === 0 ? <p>No registrations yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Organization</th><th>Event</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {metrics.recentRegistrations.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Name">{row.fullName}</td>
                    <td data-label="Email">{row.email}</td>
                    <td data-label="Organization">{row.organization}</td>
                    <td data-label="Event">{row.event.title}</td>
                    <td data-label="Status"><StatusBadge status={row.status} /></td>
                    <td data-label="Date">{formatWhen(row.createdAt)}</td>
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
