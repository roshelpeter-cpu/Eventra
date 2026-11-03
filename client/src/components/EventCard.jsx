import { Link } from 'react-router-dom';
import { availability } from '../constants.js';
import { dateParts, eventFormat, formatTimeRange, placeLine, priceLabel } from '../format.js';
import { ClockIcon, PinIcon } from './Icons.jsx';
import { Meter } from './ui.jsx';

export function Photo({ src, alt, className }) {
  return (
    <img
      className={className}
      src={src || '/covers/custom.svg'}
      alt={alt}
      onError={(event) => {
        event.currentTarget.src = '/covers/custom.svg';
      }}
    />
  );
}

export function DateBadge({ iso }) {
  const { day, month } = dateParts(iso);
  return (
    <span className="date-badge">
      <strong>{day}</strong>
      <small>{month}</small>
    </span>
  );
}

export function EventCard({ event, emphasized = false }) {
  const used = event.capacity === 0 ? 0 : event.confirmedCount / event.capacity;
  return (
    <article className={emphasized ? 'event-card emphasis' : 'event-card'}>
      <div className="card-media">
        <Link to={`/events/${event.slug}`} tabIndex={-1} aria-hidden="true">
          <Photo className="cover" src={event.imageUrl} alt="" />
        </Link>
        <DateBadge iso={event.startsAt} />
      </div>
      <div className="body">
        <h3><Link to={`/events/${event.slug}`}>{event.title}</Link></h3>
        <p className="meta-line"><PinIcon /> {placeLine(event)}</p>
        <p className="meta-line"><ClockIcon /> {formatTimeRange(event.startsAt, event.endsAt)}</p>
        <div className="capacity-line">
          <span className="badge">{event.category}</span>
          <span>{eventFormat(event)}</span>
        </div>
        <Meter value={used * 100} />
        <div className="capacity-line">
          <strong>{priceLabel(event)}</strong>
          <span>{availability(event)}</span>
        </div>
        <Link className="btn btn-ghost btn-small" to={`/events/${event.slug}`}>Details</Link>
      </div>
    </article>
  );
}
