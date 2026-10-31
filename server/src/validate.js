import { HttpError } from './errors.js';

export const CATEGORIES = ['Arts', 'Business', 'Community', 'Design', 'Technology', 'Workshop'];
export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'archived'];
export const REGISTRATION_STATUSES = ['confirmed', 'waitlisted', 'cancelled', 'checked_in'];
export const INTEREST_SUGGESTIONS = [
  'Product',
  'Engineering',
  'Design',
  'Data',
  'Marketing',
  'Research',
  'Operations',
  'Writing',
];

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function slugify(title) {
  const slug = String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'event';
}

function fail(fields) {
  throw new HttpError(400, 'VALIDATION', 'Check the highlighted fields.', fields);
}

export function validateRegistrationInput(body) {
  const fields = {};
  const source = body && typeof body === 'object' ? body : {};
  const fullName = String(source.fullName ?? '').trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(source.email);
  const organization = String(source.organization ?? '').trim().replace(/\s+/g, ' ');
  let interests = source.interests;

  if (fullName.length < 2) fields.fullName = 'Enter your full name.';
  else if (fullName.length > 120) fields.fullName = 'Name must be 120 characters or fewer.';
  else if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(fullName)) {
    fields.fullName = 'Use letters, spaces, apostrophes, or hyphens.';
  }

  if (!email) fields.email = 'Enter your email address.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = 'Enter a valid email address.';
  }

  if (organization.length < 2) fields.organization = 'Enter your college or organization.';
  else if (organization.length > 160) fields.organization = 'Organization must be 160 characters or fewer.';

  if (!Array.isArray(interests)) {
    fields.interests = 'Choose at least one domain interest.';
    interests = [];
  } else {
    const unique = [];
    const seen = new Set();
    for (const item of interests) {
      const label = String(item ?? '').trim().replace(/\s+/g, ' ');
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (label.length < 2 || label.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N}\s&/+-]{0,31}$/u.test(label)) {
        fields.interests = 'Each interest must be 2–32 characters and use letters or numbers.';
        break;
      }
      unique.push(label);
    }
    if (!fields.interests && unique.length === 0) fields.interests = 'Choose at least one domain interest.';
    if (!fields.interests && unique.length > 6) fields.interests = 'Choose up to six interests.';
    interests = unique;
  }

  let quantity = 1;
  if (source.quantity !== undefined && source.quantity !== null && source.quantity !== '') {
    const parsed = Number(source.quantity);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      fields.quantity = 'Choose between 1 and 10 tickets.';
    } else quantity = parsed;
  }

  let ticketTypeId = null;
  if (source.ticketTypeId !== undefined && source.ticketTypeId !== null && source.ticketTypeId !== '') {
    const parsed = Number(source.ticketTypeId);
    if (!Number.isInteger(parsed) || parsed < 1) fields.ticketTypeId = 'Choose a ticket type.';
    else ticketTypeId = parsed;
  }

  if (Object.keys(fields).length) fail(fields);
  return {
    fullName,
    email,
    organization,
    interests,
    waitlist: Boolean(source.waitlist),
    quantity,
    ticketTypeId,
  };
}

function validImage(url) {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (!value || value.length > 500) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return !value.includes('..');
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n');
}

export function validateEventWrite(body, { partial = false } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const fields = {};
  const out = {};

  function optional(key) {
    return partial && source[key] === undefined;
  }

  if (!optional('title')) {
    const title = cleanText(source.title).replace(/\s+/g, ' ');
    if (title.length < 3) fields.title = 'Title must be at least 3 characters.';
    else if (title.length > 140) fields.title = 'Title must be 140 characters or fewer.';
    else out.title = title;
  }

  if (!optional('summary')) {
    const summary = cleanText(source.summary).replace(/\s+/g, ' ');
    if (summary.length < 10) fields.summary = 'Summary must be at least 10 characters.';
    else if (summary.length > 240) fields.summary = 'Summary must be 240 characters or fewer.';
    else out.summary = summary;
  }

  if (!optional('description')) {
    const description = cleanText(source.description);
    if (description.length < 20) fields.description = 'Description must be at least 20 characters.';
    else if (description.length > 5000) fields.description = 'Description must be 5000 characters or fewer.';
    else out.description = description;
  }

  if (!optional('category')) {
    const category = cleanText(source.category);
    if (!CATEGORIES.includes(category)) fields.category = 'Choose a category.';
    else out.category = category;
  }

  if (!optional('venue')) {
    const venue = cleanText(source.venue).replace(/\s+/g, ' ');
    if (venue.length < 2) fields.venue = 'Enter a venue.';
    else if (venue.length > 160) fields.venue = 'Venue must be 160 characters or fewer.';
    else out.venue = venue;
  }

  if (!optional('city')) {
    const city = cleanText(source.city).replace(/\s+/g, ' ');
    if (city.length < 2) fields.city = 'Enter a city.';
    else if (city.length > 80) fields.city = 'City must be 80 characters or fewer.';
    else out.city = city;
  }

  if (!optional('imageUrl')) {
    const imageUrl = cleanText(source.imageUrl);
    if (!validImage(imageUrl)) fields.imageUrl = 'Use a site path or an http(s) image URL.';
    else out.imageUrl = imageUrl;
  }

  if (!optional('startsAt')) {
    const starts = new Date(source.startsAt);
    if (Number.isNaN(starts.getTime())) fields.startsAt = 'Enter a valid start date.';
    else out.startsAt = starts.toISOString();
  }

  if (!optional('endsAt')) {
    const ends = new Date(source.endsAt);
    if (Number.isNaN(ends.getTime())) fields.endsAt = 'Enter a valid end date.';
    else out.endsAt = ends.toISOString();
  }

  if (out.startsAt && out.endsAt && new Date(out.endsAt) <= new Date(out.startsAt)) {
    fields.endsAt = 'End must be after the start.';
  }

  if (!optional('capacity')) {
    const capacity = Number(source.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20000) {
      fields.capacity = 'Capacity must be a whole number from 1 to 20000.';
    } else out.capacity = capacity;
  }

  if (!optional('status')) {
    const status = cleanText(source.status || 'draft');
    if (!EVENT_STATUSES.includes(status)) fields.status = 'Choose a valid status.';
    else out.status = status;
  }

  if (source.format !== undefined && source.format !== '') {
    const format = cleanText(source.format);
    if (!['in-person', 'online', 'hybrid'].includes(format)) fields.format = 'Choose in person, online, or hybrid.';
    else out.format = format;
  }

  if (source.address !== undefined || !partial) {
    const address = cleanText(source.address || '').replace(/\s+/g, ' ');
    if (address.length > 240) fields.address = 'Address must be 240 characters or fewer.';
    else out.address = address;
  }

  function coordinate(key, min, max, message) {
    if (source[key] === undefined && partial) return;
    const raw = source[key];
    if (raw === undefined || raw === null || raw === '') {
      out[key] = null;
      return;
    }
    const number = Number(raw);
    if (!Number.isFinite(number) || number < min || number > max) fields[key] = message;
    else out[key] = Math.round(number * 1e6) / 1e6;
  }
  coordinate('latitude', -90, 90, 'Latitude must be between -90 and 90.');
  coordinate('longitude', -180, 180, 'Longitude must be between -180 and 180.');
  if (!partial && (out.latitude == null) !== (out.longitude == null)) {
    fields.latitude = 'Enter both latitude and longitude, or leave both empty.';
  }

  if (source.priceRupees !== undefined || source.priceCents !== undefined) {
    const cents = source.priceCents !== undefined
      ? Number(source.priceCents)
      : Math.round(Number(source.priceRupees) * 100);
    if (!Number.isInteger(cents) || cents < 0 || cents > 100000000) {
      fields.priceRupees = 'Enter a price of zero or more.';
    } else out.priceCents = cents;
  } else if (!partial) {
    out.priceCents = 0;
  }

  if (source.ticketTypes !== undefined) {
    if (!Array.isArray(source.ticketTypes) || source.ticketTypes.length > 6) {
      fields.ticketTypes = 'Add up to six ticket types.';
    } else {
      const names = new Set();
      const ticketTypes = [];
      for (const item of source.ticketTypes) {
        const name = cleanText(item?.name || '').replace(/\s+/g, ' ');
        if (!name) continue;
        const price = item?.priceCents !== undefined
          ? Number(item.priceCents)
          : Math.round(Number(item?.priceRupees) * 100);
        const fee = item?.feeCents !== undefined
          ? Number(item.feeCents)
          : Math.round(Number(item?.feeRupees || 0) * 100);
        if (name.length < 2 || name.length > 40) fields.ticketTypes = 'Each ticket name must be 2–40 characters.';
        else if (names.has(name.toLowerCase())) fields.ticketTypes = 'Ticket names must be unique.';
        else if (!Number.isInteger(price) || price < 0 || price > 100000000) fields.ticketTypes = 'Enter a valid ticket price.';
        else if (!Number.isInteger(fee) || fee < 0 || fee > 100000000) fields.ticketTypes = 'Enter a valid fee.';
        else {
          names.add(name.toLowerCase());
          ticketTypes.push({ name, priceCents: price, feeCents: fee, currency: 'USD' });
        }
      }
      if (!fields.ticketTypes) out.ticketTypes = ticketTypes;
    }
  }

  if (!partial && Object.keys(out).length === 0) {
    fields.title = fields.title || 'Title is required.';
  }

  if (Object.keys(fields).length) fail(fields);
  return out;
}

export function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const number = Number(value);
    if (Number.isSafeInteger(number) && number > 0) return number;
  }
  return null;
}

export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseQueryDate(value, bound) {
  if (value === undefined || value === null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const suffix = bound === 'end' ? 'T23:59:59' : 'T00:00:00';
    const date = new Date(`${raw}${suffix}`);
    if (Number.isNaN(date.getTime())) {
      throw new HttpError(400, 'VALIDATION', 'That date is not valid.');
    }
    return date.toISOString();
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'VALIDATION', 'That date is not valid.');
  }
  return date.toISOString();
}
