import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { FeaturedCarousel } from '../components/Carousel.jsx';
import { EventCard, Photo } from '../components/EventCard.jsx';
import { CategoryIcon, StatIcon } from '../components/Icons.jsx';
import { CATEGORIES } from '../constants.js';
import { formatWhen } from '../format.js';
import { EmptyState, ErrorBlock, PageTitle, SkeletonCards } from '../components/ui.jsx';

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlights, setHighlights] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api('/api/highlights', { signal: controller.signal }),
      api('/api/events?sort=soonest&limit=24', { signal: controller.signal }),
    ]).then(([stats, listing]) => {
      setHighlights(stats);
      setEvents(listing.events);
      setLoading(false);
    }).catch((loadError) => {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  function search(event) {
    event.preventDefault();
    const next = query.trim();
    navigate(next ? `/events?q=${encodeURIComponent(next)}` : '/events');
  }

  async function subscribe(event) {
    event.preventDefault();
    setNotice('');
    setJoining(true);
    try {
      await api('/api/subscribe', { method: 'POST', body: { email } });
      setNotice('You are on the announcement list. This demo stores the address and does not send email.');
      setEmail('');
    } catch (subscribeError) {
      setNotice(subscribeError.message);
    } finally {
      setJoining(false);
    }
  }

  const featured = events.slice(0, 8);
  const upcoming = [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 3);
  const popular = [...events].sort((a, b) => b.confirmedCount - a.confirmedCount).slice(0, 3);
  const counts = new Map();
  events.forEach((event) => counts.set(event.category, (counts.get(event.category) || 0) + 1));
  const coverFor = (category) => events.find((event) => event.category === category)?.imageUrl;

  return (
    <div className="page home-page">
      <PageTitle title="Discover" />
      <div className="wrap">
        {error ? <ErrorBlock message={error} /> : null}
        <section className="hero-stage">
          <Photo src="/photos/hero-summit.jpg" alt="A seated conference audience facing a lit stage." />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow">Connect · Learn · Create · Belong</p>
            <h1>Events That Create <span className="gradient-text">Brighter Futures</span></h1>
            <p className="lede">Discover events, gain new skills, meet inspiring people and be part of a growing community.</p>
            <form className="hero-search" onSubmit={search} role="search">
              <input aria-label="Search events, topics or locations" placeholder="Search events, topics or locations" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="btn btn-primary icon-btn" type="submit" aria-label="Search">
                <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            <div className="chips">
              {CATEGORIES.map((category) => (
                <Link key={category} className="chip" to={`/events?category=${encodeURIComponent(category)}`}>
                  <CategoryIcon name={category} />
                  {category === 'Technology' ? 'Tech' : category}
                </Link>
              ))}
            </div>
          </div>
          {featured[0] ? (
            <Link className="hero-float" to={`/events/${featured[0].slug}`}>
              <Photo src={featured[0].imageUrl} alt="" />
              <span>
                <strong>{featured[0].title}</strong>
                <p className="meta">{formatWhen(featured[0].startsAt)}</p>
                <p className="meta">{featured[0].city}</p>
              </span>
            </Link>
          ) : null}
        </section>

        <section className="stat-row" aria-label="Platform numbers from the database">
          <article className="stat">
            <span className="stat-icon"><StatIcon name="events" /></span>
            <div><span>Upcoming events</span><strong>{highlights ? highlights.upcoming : '—'}</strong></div>
          </article>
          <article className="stat">
            <span className="stat-icon"><StatIcon name="people" /></span>
            <div><span>Confirmed registrations</span><strong>{highlights ? highlights.confirmedGuests : '—'}</strong></div>
          </article>
          <article className="stat">
            <span className="stat-icon"><StatIcon name="cities" /></span>
            <div><span>Cities</span><strong>{highlights ? highlights.cities : '—'}</strong></div>
          </article>
          <article className="stat">
            <span className="stat-icon"><StatIcon name="seats" /></span>
            <div><span>Seats still open</span><strong>{highlights ? highlights.seatsRemaining : '—'}</strong></div>
          </article>
        </section>

        <div className="section-head">
          <div>
            <p className="kicker">Featured</p>
            <h2>Featured Events</h2>
          </div>
          <Link className="btn btn-ghost btn-small" to="/events">View all</Link>
        </div>
        {loading ? <SkeletonCards count={3} /> : null}
        {!loading && !error && featured.length === 0 ? (
          <EmptyState title="No events are published yet." body="When the administrator publishes an event, it appears here from the database." />
        ) : null}
        {!loading && !error && featured.length > 0 ? <FeaturedCarousel events={featured} /> : null}

        <div className="section-head">
          <div>
            <p className="kicker">Coming up</p>
            <h2>Upcoming Events</h2>
          </div>
        </div>
        {!loading && !error && upcoming.length === 0 ? (
          <p className="muted">More dates will show here as additional events are published.</p>
        ) : null}
        {!loading && !error && upcoming.length > 0 ? (
          <div className="event-grid">
            {upcoming.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : null}

        {popular.some((event) => event.confirmedCount > 0) ? (
          <>
            <div className="section-head">
              <div>
                <p className="kicker">Popular</p>
                <h2>Most registered</h2>
              </div>
            </div>
            <div className="event-grid">
              {popular.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          </>
        ) : null}

        <div className="section-head">
          <div>
            <p className="kicker">Categories</p>
            <h2>Browse by interest</h2>
          </div>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((category) => (
            <Link key={category} className="category-card visual" to={`/events?category=${encodeURIComponent(category)}`}>
              {coverFor(category) ? <Photo src={coverFor(category)} alt="" /> : <span className="stat-icon"><CategoryIcon name={category} /></span>}
              <span>
                <strong>{category}</strong>
                <span className="meta">{counts.get(category) || 0} in this list</span>
              </span>
            </Link>
          ))}
        </div>

        <section className="newsletter">
          <div>
            <p className="kicker">Announcements</p>
            <h2>Hear about newly published events</h2>
            <p className="muted">The address is saved in the database. Eventra does not send mail unless an email provider is configured later.</p>
          </div>
          <form onSubmit={subscribe}>
            <label htmlFor="announce-email">Email address</label>
            <div className="hero-search">
              <input id="announce-email" type="email" required value={email} placeholder="you@college.edu" onChange={(event) => setEmail(event.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={joining}>{joining ? 'Saving…' : 'Join'}</button>
            </div>
            {notice ? <p className="meta" role="status">{notice}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
