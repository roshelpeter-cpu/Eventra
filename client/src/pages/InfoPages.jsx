import { Link } from 'react-router-dom';
import { PageTitle } from '../components/ui.jsx';

export function AboutPage() {
  return (
    <div className="page">
      <PageTitle title="About" />
      <div className="wrap narrow stack">
        <div>
          <p className="kicker">About Eventra</p>
          <h1>One place to find an event and keep the seat.</h1>
          <p className="lede">Eventra is a public discovery and registration platform. Visitors browse published events and register without creating an account. One administrator publishes the program, watches capacity, and manages the attendee list.</p>
        </div>
        <div className="category-grid">
          <article className="info-card">
            <h2>Discover</h2>
            <p className="muted">Search by title, topic, or location, then filter by category, date, and city. Every card reads from the database.</p>
          </article>
          <article className="info-card">
            <h2>Register</h2>
            <p className="muted">Share your name, email, college or organization, and domain interests. The same email cannot take two seats for one event.</p>
          </article>
          <article className="info-card">
            <h2>Manage</h2>
            <p className="muted">The administrator sees the same registrations, with status badges, search, and a ticket that can be checked in.</p>
          </article>
        </div>
        <Link className="btn btn-primary" to="/events">Browse events</Link>
      </div>
    </div>
  );
}
