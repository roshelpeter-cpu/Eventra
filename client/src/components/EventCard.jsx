import { Link } from 'react-router-dom';
import { availability } from '../constants.js';
import { dateParts, eventFormat, formatTimeRange, placeLine } from '../format.js';
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

export function EventCard({ event }) {
  const used = event.capacity === 0 ? 0 : event.confirmedCount / event.capacity;
  return (
    <Link className="event-card" to={`/events/${event.slug}`}>
      <div className="card-media">
        <Photo className="cover" src={event.imageUrl} alt="" />
        <DateBadge iso={event.startsAt} />
      </div>
      <div className="body">
        <h3>{event.title}</h3>
        <p className="meta-line"><PinIcon /> {placeLine(event)}</p>
        <p className="meta-line"><ClockIcon /> {formatTimeRange(event.startsAt, event.endsAt)}</p>
        <div className="capacity-line">
          <span className="badge">{event.category}</span>
          <span>{eventFormat(event)}</span>
        </div>
        <Meter value={used * 100} />
        <div className="capacity-line">
          <span>{event.confirmedCount} / {event.capacity} spots</span>
          <span>{availability(event)}</span>
        </div>
        <span className="btn btn-ghost btn-small">Details</span>
      </div>
    </Link>
  );
}
