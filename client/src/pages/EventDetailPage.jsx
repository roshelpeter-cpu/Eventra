import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { DateBadge, EventCard, Photo, SaveButton } from '../components/EventCard.jsx';
import { ShareBar } from '../components/ShareBar.jsx';
import { VenueMap } from '../components/VenueMap.jsx';
import { ErrorBlock, Meter, PageTitle } from '../components/ui.jsx';
import { eventFormat, formatMoney, formatRange, formatTimeRange, paragraphs, placeLine, priceLabel } from '../format.js';

const TABS = ['Overview', 'Schedule', 'Speakers', 'Venue', 'FAQs'];

export function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('Overview');
  const loadKey = `${id}|${attempt}`;
  const [seenKey, setSeenKey] = useState(loadKey);
  if (seenKey !== loadKey) {
    setSeenKey(loadKey);
    setLoading(true);
    setError('');
    setTab('Overview');
  }

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/events/${id}`, { signal: controller.signal })
      .then((data) => {
        setEvent(data.event);
        setLoading(false);
        api(`/api/events?category=${encodeURIComponent(data.event.category)}`, { signal: controller.signal })
          .then((listing) => {
            setRelated(listing.events.filter((item) => item.slug !== data.event.slug).slice(0, 3));
          })
          .catch(() => {});
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  if (loading) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;
  if (error || !event) {
    return <div className="page"><div className="wrap"><ErrorBlock message={error || 'That event does not exist.'} onRetry={() => setAttempt((value) => value + 1)} /></div></div>;
  }

  const details = event.details || { schedule: [], speakers: [], faqs: [], perks: [], audience: '' };
  const closed = event.status === 'cancelled' || event.ended;
  const action = closed ? null : event.waitlistOpen ? 'Join the waitlist' : 'Register Now';
  const kind = eventFormat(event);

  return (
    <div className="page">
      <PageTitle title={event.title} />
      <div className="wrap">
        <Link className="back-link" to="/events">← Back to Events</Link>
        <div className="detail">
          <div>
            <div className="detail-hero">
              <Photo src={event.imageUrl} alt="" />
              <DateBadge iso={event.startsAt} />
            </div>
            <div className="detail-copy">
              <div className="detail-tools">
                <div className="chips">
                  <span className="badge">{event.category}</span>
                  <span className="badge">{kind}</span>
                  <span className="badge">{priceLabel(event)}</span>
                  <span className="badge">{event.confirmedCount} / {event.capacity} seats</span>
                </div>
                <SaveButton slug={event.slug} title={event.title} />
              </div>
              <h1>{event.title}</h1>
              <div className="fact-row">
                <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
                <p className="meta">{placeLine(event)}</p>
                <p className="meta">{formatTimeRange(event.startsAt, event.endsAt)}</p>
              </div>
              <div className="tabs" role="tablist" aria-label="Event information">
                {TABS.map((item) => (
                  <button key={item} type="button" className="tab" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>
                ))}
              </div>
              {tab === 'Overview' ? (
                <div className="stack">
                  <h2>About this event</h2>
                  {paragraphs(event.description).map((paragraph) => <p key={paragraph} className="lede">{paragraph}</p>)}
                  {details.audience ? <p className="meta">Who it is for: {details.audience}</p> : null}
                  {details.perks?.length ? (
                    <ul className="perk-list">
                      {details.perks.map((perk) => <li key={perk}>{perk}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {tab === 'Schedule' ? (
                <div className="schedule">
                  {details.schedule?.length ? details.schedule.map((item) => (
                    <article key={`${item.time}-${item.title}`}><strong>{item.time} · {item.title}</strong><p className="muted">{item.detail}</p></article>
                  )) : <p>No schedule has been published for this event.</p>}
                </div>
              ) : null}
              {tab === 'Speakers' ? (
                <div className="speaker-grid">
                  {details.speakers?.length ? details.speakers.map((person) => (
                    <article className="speaker" key={person.name}><strong>{person.name}</strong><p className="muted">{person.role}</p></article>
                  )) : <p>Speakers have not been listed for this event.</p>}
                </div>
              ) : null}
              {tab === 'Venue' ? (
                <VenueMap event={event} />
              ) : null}
              {tab === 'FAQs' ? (
                <div className="faq">
                  {details.faqs?.length ? details.faqs.map((item) => (
                    <details key={item.q}><summary>{item.q}</summary><p className="muted">{item.a}</p></details>
                  )) : <p>No questions have been published for this event.</p>}
                </div>
              ) : null}
            </div>
          </div>
          <aside className="panel side-card">
            <p className="kicker">Register</p>
            <h2>{event.startingPriceCents > 0 ? priceLabel(event) : 'Free entry'}</h2>
            <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
            <p className="meta">{placeLine(event)} · {kind}</p>
            {event.ticketTypes?.length ? (
              <ul className="perk-list">
                {event.ticketTypes.map((type) => (
                  <li key={type.id}>
                    <strong>{type.name}</strong>
                    <span>{type.priceCents + type.feeCents === 0 ? 'Free' : formatMoney(type.priceCents + type.feeCents, type.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Meter value={event.capacity ? (event.confirmedCount / event.capacity) * 100 : 0} />
            <p>{event.seatsRemaining} of {event.capacity} seats remaining.</p>
            {event.waitlistCount ? <p className="meta">{event.waitlistCount} on the waitlist. Waitlisted guests are not confirmed attendees.</p> : null}
            <p className="price-note">{event.startingPriceCents > 0 ? 'A paid seat is confirmed only after the server verifies payment.' : 'No payment is collected. A confirmed registration is stored only after the server accepts it.'}</p>
            <p className="meta">Published by the Eventra administrator.</p>
            {closed ? <p>Registration is closed for this event.</p> : (
              <Link className="btn btn-primary" to={`/events/${event.slug}/register`}>{action}</Link>
            )}
            <ShareBar
              url={window.location.href}
              title={event.title}
              note="This shares the public event page."
            />
          </aside>
        </div>
        {related.length ? (
          <>
            <div className="section-head">
              <h2>Related events</h2>
            </div>
            <div className="event-grid">
              {related.map((item) => <EventCard key={item.id} event={item} />)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
