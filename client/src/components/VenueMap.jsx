import { eventFormat, placeLine } from '../format.js';

export function directionsUrl(event) {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  const query = event.address || placeLine(event);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function VenueMap({ event }) {
  const online = eventFormat(event) === 'Online';
  const address = event.address || placeLine(event);
  if (online) {
    return (
      <div className="map-fallback">
        <h2>Joining information</h2>
        <p>{event.venue}</p>
        <p className="muted">This event is online, so there is no venue pin.</p>
      </div>
    );
  }

  const located = event.latitude != null && event.longitude != null;
  const pad = 0.012;
  const src = located
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${event.longitude - pad},${event.latitude - pad},${event.longitude + pad},${event.latitude + pad}`)}&layer=mapnik&marker=${encodeURIComponent(`${event.latitude},${event.longitude}`)}`
    : '';

  return (
    <div className="venue-map">
      <div className="map-copy">
        <h2>{event.venue}</h2>
        <p>{address}</p>
        <p className="meta">{located ? 'Pin saved for this venue.' : 'A map pin appears after coordinates are saved for this venue.'}</p>
        <div className="actions">
          <a className="btn btn-primary btn-small" href={directionsUrl(event)} target="_blank" rel="noreferrer">Get directions</a>
          {located ? (
            <a className="btn btn-ghost btn-small" href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`} target="_blank" rel="noreferrer">Open map</a>
          ) : null}
        </div>
      </div>
      {located ? (
        <iframe className="map-frame" title={`Map of ${event.venue}`} src={src} loading="lazy" />
      ) : (
        <div className="map-fallback">
          <p>Directions open a search for the saved address. The pin is not shown until latitude and longitude are stored for this event.</p>
        </div>
      )}
    </div>
  );
}
