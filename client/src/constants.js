export const CATEGORIES = ['Arts', 'Business', 'Community', 'Design', 'Technology', 'Workshop'];

export const INTERESTS = [
  'Web Development',
  'AI & ML',
  'UI/UX Design',
  'Product Management',
  'Data Science',
  'Other',
];

export const COVERS = [
  ['/photos/northline.jpg', 'Northline'],
  ['/photos/harbor.jpg', 'Harbor'],
  ['/photos/lumen.jpg', 'Lumen'],
  ['/photos/atlas.jpg', 'Atlas'],
  ['/photos/kiln.jpg', 'Kiln'],
  ['/photos/pixel.jpg', 'Paper'],
  ['/photos/solstice.jpg', 'Solstice'],
  ['/photos/field.jpg', 'Field'],
  ['/photos/cedar.jpg', 'Cedar'],
  ['/photos/midnight.jpg', 'Midnight'],
  ['/photos/southbank.jpg', 'Southbank'],
  ['/photos/winter.jpg', 'Winter'],
  ['/covers/custom.svg', 'Mark'],
];

export function availability(event) {
  if (event.status === 'cancelled') return 'Called off';
  if (event.status === 'draft') return 'Draft';
  if (event.status === 'archived') return 'Archived';
  if (event.ended) return 'Ended';
  if (event.seatsRemaining === 0) return event.waitlistCount > 0 ? `Waitlist · ${event.waitlistCount}` : 'Waitlist open';
  return `${event.seatsRemaining} seats left`;
}

export function statusLabel(status) {
  const labels = {
    confirmed: 'Confirmed',
    waitlisted: 'Waitlist',
    cancelled: 'Cancelled',
    checked_in: 'Checked in',
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
  };
  return labels[status] || status;
}
