import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { DateBadge, EventCard, Photo, SaveButton } from '../components/EventCard.jsx';
import { ShareBar } from '../components/ShareBar.jsx';
import { VenueMap } from '../components/VenueMap.jsx';
import { ErrorBlock, Meter, PageTitle } from '../components/ui.jsx';
import { eventFormat, formatMoney, formatRange, formatTimeRange, paragraphs, placeLine, priceLabel } from '../format.js';

export function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${id}|${attempt}`;
  const [seenKey, setSeenKey] = useState(loadKey);
  if (seenKey !== loadKey) {
    setSeenKey(loadKey);
    setLoading(true);
    setError('');
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
  const price = event.startingPriceCents > 0 ? priceLabel(event) : 'Free entry';

  return (
    <div className="page event-detail">
      <PageTitle title={event.title} />
      <div className="wrap">
        <Link className="back-link" to="/events">← Back to Events</Link>
        <div className="detail">
          <div className="detail-hero">
            <Photo src={event.imageUrl} alt="" />
            <DateBadge iso={event.startsAt} />
          </div>
          <aside className="panel side-card ticket-panel">
            <p className="kicker">Tickets</p>
            <h2>{price}</h2>
            <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
            <p className="meta">{placeLine(event)} · {kind}</p>
            {event.ticketTypes?.length ? (
              <ul className="perk-list ticket-types">
                {event.ticketTypes.map((type) => (
                  <li key={type.id}>
                    <strong>{type.name}</strong>
                    <span>{type.priceCents + type.feeCents === 0 ? 'Free' : formatMoney(type.priceCents + type.feeCents)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Meter value={event.capacity ? (event.confirmedCount / event.capacity) * 100 : 0} />
            <p className="capacity-line"><strong>{event.seatsRemaining} seats left</strong><span>of {event.capacity}</span></p>
            {event.waitlistCount ? <p className="meta">{event.waitlistCount} people are on the waitlist.</p> : null}
            <p className="price-note">{event.startingPriceCents > 0 ? 'A paid seat is confirmed only after this demo checkout is verified.' : 'No payment is collected for this event.'}</p>
            {closed ? <p>Registration is closed for this event.</p> : (
              <Link className="btn btn-primary" to={`/events/${event.slug}/register`}>{action}</Link>
            )}
            <ShareBar
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={event.title}
              note="Share this event page."
            />
          </aside>
          <div className="detail-body">
            <div className="detail-copy">
              <div className="detail-tools">
                <div className="chips">
                  <span className="badge">{event.category}</span>
                  <span className="badge">{kind}</span>
                  <span className="badge">{price}</span>
                </div>
                <SaveButton slug={event.slug} title={event.title} />
              </div>
              <h1>{event.title}</h1>
              <div className="fact-row">
                <p className="meta">{formatRange(event.startsAt, event.endsAt)}</p>
                <p className="meta">{formatTimeRange(event.startsAt, event.endsAt)}</p>
                <p className="meta">{placeLine(event)}</p>
              </div>
            </div>

            <section className="detail-section" id="overview">
              <h2>Overview</h2>
              {paragraphs(event.description).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {details.audience ? <p className="meta">Who it is for: {details.audience}</p> : null}
              {details.perks?.length ? (
                <ul className="perk-list">
                  {details.perks.map((perk) => <li key={perk}>{perk}</li>)}
                </ul>
              ) : null}
            </section>

            <section className="detail-section" id="schedule">
              <h2>Schedule</h2>
              <div className="schedule">
                {details.schedule?.length ? details.schedule.map((item) => (
                  <article key={`${item.time}-${item.title}`}>
                    <strong>{item.time}</strong>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="muted">{item.detail}</p>
                    </div>
                  </article>
                )) : <p className="muted">No schedule has been published for this event.</p>}
              </div>
            </section>

            <section className="detail-section" id="speakers">
              <h2>Speakers</h2>
              {details.speakers?.length ? (
                <div className="speaker-grid">
                  {details.speakers.map((person) => (
                    <article className="speaker" key={person.name}>
                      <span className="speaker-mark" aria-hidden="true">{person.name.slice(0, 1)}</span>
                      <div>
                        <strong>{person.name}</strong>
                        <p className="muted">{person.role}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className="muted">Speakers have not been listed for this event.</p>}
            </section>

            <section className="detail-section" id="venue">
              <h2>Venue</h2>
              <VenueMap event={event} />
            </section>

            <section className="detail-section" id="faqs">
              <h2>FAQs</h2>
              <div className="faq">
                {details.faqs?.length ? details.faqs.map((item) => (
                  <details key={item.q}>
                    <summary>{item.q}</summary>
                    <p className="muted">{item.a}</p>
                  </details>
                )) : <p className="muted">No questions have been published for this event.</p>}
              </div>
            </section>
          </div>
        </div>

        {related.length ? (
          <section className="related-block">
            <div className="section-head">
              <div>
                <p className="kicker">More to explore</p>
                <h2>Related events</h2>
              </div>
            </div>
            <div className="event-grid">
              {related.map((item) => <EventCard key={item.id} event={item} />)}
            </div>
          </section>
        ) : null}
      </div>
      {action ? (
        <div className="mobile-cta">
          <div>
            <strong>{price}</strong>
            <span>{event.seatsRemaining} seats left</span>
          </div>
          <Link className="btn btn-primary" to={`/events/${event.slug}/register`}>{action}</Link>
        </div>
      ) : null}
    </div>
  );
}
