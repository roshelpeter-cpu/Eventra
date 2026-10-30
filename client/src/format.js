export function formatWhen(iso) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDay(iso) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const day = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(startDate);
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `${day}, ${time.format(startDate)} – ${time.format(endDate)}`;
  return `${formatWhen(start)} – ${formatWhen(end)}`;
}

export function formatChartDay(day) {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function toDateTimeLocal(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function paragraphs(text) {
  return String(text || '').split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
}

export function pageTitle(title) {
  return title ? `${title} · Eventra` : 'Eventra';
}

export function dateParts(iso) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
  };
}

export function formatTimeRange(start, end) {
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${time.format(startDate)} – ${time.format(endDate)}`;
  }
  return `${formatWhen(start)} – ${formatWhen(end)}`;
}

export function eventFormat(event) {
  const value = event?.details?.format;
  if (value === 'online') return 'Online';
  if (value === 'hybrid') return 'Hybrid';
  if (value === 'in-person') return 'In person';
  const blob = `${event?.venue || ''} ${event?.city || ''}`.toLowerCase();
  if (/\bonline\b|\bvirtual\b|\bremote\b/.test(blob)) return 'Online';
  if (blob.includes('hybrid')) return 'Hybrid';
  return 'In person';
}

export function placeLine(event) {
  const kind = eventFormat(event);
  if (kind === 'Online') return event.venue || 'Online';
  return `${event.venue}, ${event.city}`;
}

export function formatMoney(cents, currency = 'INR') {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function priceLabel(event) {
  const cents = Number(event?.startingPriceCents ?? event?.priceCents ?? 0);
  if (cents <= 0) return 'Free entry';
  return `From ${formatMoney(cents, event.currency || 'INR')}`;
}
