import { eventFormat, venueFacts } from '../format.js';

export function directionsUrl(event) {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  const query = event.address || `${event.venue || ''} ${event.city || ''}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsUrl(event) {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`;
  }
  const query = event.address || `${event.venue || ''} ${event.city || ''}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function VenueMap({ event }) {
  const online = eventFormat(event) === 'Online';
  const place = venueFacts(event);
  if (online) {
    return (
      <article className="venue-card">
        <div className="venue-mark" aria-hidden="true"><PinIcon /></div>
        <div>
          <p className="kicker">Online</p>
          <h3>{event.venue || 'Online event'}</h3>
          <p className="muted">This event is held online, so there is no street address or map pin.</p>
        </div>
      </article>
    );
  }

  const located = event.latitude != null && event.longitude != null;
  const mapSrc = located
    ? `https://maps.google.com/maps?q=${event.latitude},${event.longitude}&z=15&output=embed`
    : '';

  return (
    <div className={located ? 'venue-layout' : 'venue-layout venue-layout-solo'}>
      <article className="venue-card">
        <div className="venue-mark" aria-hidden="true"><PinIcon /></div>
        <div className="venue-copy">
          <p className="kicker">Venue</p>
          <h3>{place.venue}</h3>
          <p>{place.address}</p>
          {place.line ? <p className="meta">{place.line}</p> : null}
        </div>
        <div className="actions">
          <a className="btn btn-primary" href={directionsUrl(event)} target="_blank" rel="noreferrer">Get Directions</a>
          <a className="btn btn-ghost" href={mapsUrl(event)} target="_blank" rel="noreferrer">Open in Google Maps</a>
        </div>
      </article>
      {located ? (
        <div className="map-shell">
          <iframe
            className="map-frame"
            title={`Map of ${place.venue}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : null}
    </div>
  );
}
