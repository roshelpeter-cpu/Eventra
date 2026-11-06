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
