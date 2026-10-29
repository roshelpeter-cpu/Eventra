import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/useToast.js';
import { Field, PageTitle, StatusBadge } from '../components/ui.jsx';
import { formatWhen } from '../format.js';

export function AdminCheckInPage() {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);
  const [recent, setRecent] = useState([]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Enter the ticket code.');
      return;
    }
    setBusy(true);
    try {
      const data = await api('/api/admin/check-in', {
        method: 'POST',
        body: { ticketCode: code.trim() },
      });
      setCurrent(data.registration);
      setRecent((items) => [data.registration, ...items.filter((item) => item.id !== data.registration.id)].slice(0, 6));
      setCode('');
      toast(`${data.registration.fullName} is checked in.`);
    } catch (checkError) {
      setCurrent(null);
      setError(checkError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkin">
      <PageTitle title="Check-in" />
      <div>
        <p className="kicker">Door</p>
        <h1>Check-in</h1>
        <p className="lede">Enter the code printed on the ticket. Confirmed guests are marked checked in. Waitlisted and cancelled tickets are refused.</p>
      </div>
      <form className="form-grid table-card" onSubmit={submit}>
        <Field id="ticket-code" label="Ticket code" error={error}>
          <input
            id="ticket-code"
            value={code}
            autoComplete="off"
            spellCheck="false"
            aria-invalid={Boolean(error)}
            onChange={(input) => setCode(input.target.value.toUpperCase())}
            placeholder="EVXXXXXXXX"
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Check in'}</button>
      </form>
      {current ? (
        <article className="table-card">
          <StatusBadge status={current.status} />
          <h2>{current.fullName}</h2>
          <p>{current.email}</p>
          <p>{current.organization}</p>
          <p>{current.event.title}</p>
          <p className="hint">{formatWhen(current.event.startsAt)} · {current.ticketCode}</p>
        </article>
      ) : null}
      {recent.length > 0 ? (
        <article className="table-card">
          <h2>This session</h2>
          <ul className="list">
            {recent.map((registration) => (
              <li key={registration.id}>
                <span>{registration.fullName}</span>
                <span>{registration.ticketCode}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
