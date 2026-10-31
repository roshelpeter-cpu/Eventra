import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { withTransaction } from './db.js';
import { HttpError, isCapacityConstraint, isUniqueConstraint } from './errors.js';
import { heldSeats, listTicketTypes, quoteForEvent, replaceTicketTypes, startingPriceCents } from './pricing.js';
import {
  escapeLike,
  parseQueryDate,
  slugify,
  validateEventWrite,
  validateRegistrationInput,
} from './validate.js';

const OCCUPIED = new Set(['confirmed', 'checked_in']);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const EVENT_COLUMNS = `
  e.id, e.slug, e.title, e.summary, e.description, e.category, e.venue, e.city,
  e.image_url, e.starts_at, e.ends_at, e.capacity, e.status, e.created_at, e.updated_at, e.details,
  e.address, e.latitude, e.longitude, e.price_cents, e.currency,
  COALESCE((SELECT MIN(tt.price_cents) FROM ticket_types tt WHERE tt.event_id = e.id), e.price_cents) AS starting_price_cents,
  COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'checked_in') THEN COALESCE(r.quantity, 1) ELSE 0 END), 0) AS confirmed_count,
  COALESCE(SUM(CASE WHEN r.status = 'waitlisted' THEN 1 ELSE 0 END), 0) AS waitlist_count,
  COALESCE(SUM(CASE WHEN r.status = 'checked_in' THEN COALESCE(r.quantity, 1) ELSE 0 END), 0) AS checked_in_count
`;

const EVENT_FROM = `
  FROM events e
  LEFT JOIN registrations r ON r.event_id = e.id
`;

function readDetails(raw) {
  const empty = { audience: '', perks: [], schedule: [], speakers: [], faqs: [] };
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return empty;
    return {
      audience: typeof value.audience === 'string' ? value.audience : '',
      perks: Array.isArray(value.perks) ? value.perks.filter((item) => typeof item === 'string') : [],
      schedule: Array.isArray(value.schedule) ? value.schedule : [],
      speakers: Array.isArray(value.speakers) ? value.speakers : [],
      faqs: Array.isArray(value.faqs) ? value.faqs : [],
    };
  } catch {
    return empty;
  }
}

function mapEvent(row) {
  const confirmedCount = Number(row.confirmed_count || 0);
  const waitlistCount = Number(row.waitlist_count || 0);
  const capacity = Number(row.capacity);
  const seatsRemaining = Math.max(0, capacity - confirmedCount);
  const ended = new Date(row.ends_at).getTime() < Date.now();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    venue: row.venue,
    city: row.city,
    address: row.address || '',
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    priceCents: Number(row.price_cents || 0),
    startingPriceCents: Number(row.starting_price_cents ?? row.price_cents ?? 0),
    currency: row.currency || 'USD',
    imageUrl: row.image_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity,
    confirmedCount,
    waitlistCount,
    checkedInCount: Number(row.checked_in_count || 0),
    seatsRemaining,
    status: row.status,
    ended,
    registrationOpen: row.status === 'published' && !ended && seatsRemaining > 0,
    waitlistOpen: row.status === 'published' && !ended && seatsRemaining === 0,
    details: readDetails(row.details),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eventByPredicate(db, clause, param) {
  return db.prepare(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE ${clause} GROUP BY e.id`,
  ).get(param);
}

export function getEventRecord(db, idOrSlug) {
  const key = String(idOrSlug ?? '');
  if (/^\d+$/.test(key)) {
    const byId = eventByPredicate(db, 'e.id = ?', Number(key));
    if (byId) return byId;
  }
  return eventByPredicate(db, 'e.slug = ?', key) || null;
}

export function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  const visible = user.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`;
}

function mapRegistration(row, { mask = false } = {}) {
  return {
    id: row.id,
    eventId: row.event_id,
    fullName: row.full_name,
    email: mask ? maskEmail(row.email) : row.email,
    organization: row.organization,
    interests: JSON.parse(row.interests),
    status: row.status,
    ticketCode: row.ticket_code,
    quantity: Number(row.quantity || 1),
    ticketLabel: row.ticket_label || 'General admission',
    amountCents: Number(row.amount_cents || 0),
    currency: row.currency || 'USD',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checkedInAt: row.checked_in_at,
    event: row.title
      ? {
          id: row.event_id,
          title: row.title,
          slug: row.slug,
          venue: row.venue,
          city: row.city,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          imageUrl: row.image_url,
          status: row.event_status,
          category: row.category,
        }
      : undefined,
  };
}

const REGISTRATION_SELECT = `
  SELECT
    r.id, r.event_id, r.full_name, r.email, r.organization, r.interests, r.status,
    r.ticket_code, r.quantity, r.ticket_label, r.amount_cents, r.currency,
    r.created_at, r.updated_at, r.checked_in_at,
    e.title, e.slug, e.venue, e.city, e.starts_at, e.ends_at, e.image_url,
    e.status AS event_status, e.category
  FROM registrations r
  JOIN events e ON e.id = r.event_id
`;

export function getRegistrationById(db, id, options) {
  const row = db.prepare(`${REGISTRATION_SELECT} WHERE r.id = ?`).get(id);
  return row ? mapRegistration(row, options) : null;
}

function occupiedCount(db, eventId) {
  return Number(
    db.prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS n FROM registrations
       WHERE event_id = ? AND status IN ('confirmed', 'checked_in')`,
    ).get(eventId).n,
  );
}

export function issueRegistration(db, fields) {
  const insert = db.prepare(
    `INSERT INTO registrations (
       event_id, full_name, email, organization, interests, status, ticket_code,
       created_at, updated_at, quantity, ticket_label, amount_cents, currency
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = fields.now || new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ticketCode = makeTicketCode();
    try {
      const info = insert.run(
        fields.eventId,
        fields.fullName,
        fields.email,
        fields.organization,
        JSON.stringify(fields.interests),
        fields.status,
        ticketCode,
        now,
        now,
        fields.quantity,
        fields.ticketLabel,
        fields.amountCents,
        fields.currency,
      );
      return Number(info.lastInsertRowid);
    } catch (error) {
      if (isUniqueConstraint(error) && /ticket_code/i.test(error.message || '') && attempt < 4) continue;
      throw error;
    }
  }
  throw new HttpError(500, 'INTERNAL', 'Could not issue a ticket. Please try again.');
}

function makeTicketCode() {
  const bytes = crypto.randomBytes(8);
  let code = 'EV';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

export function mapWriteError(error) {
  if (error instanceof HttpError) return error;
  if (isUniqueConstraint(error)) {
    if (/ticket_code/i.test(error.message || '')) {
      return new HttpError(500, 'INTERNAL', 'Could not issue a ticket. Please try again.');
    }
    return new HttpError(
      409,
      'DUPLICATE_REGISTRATION',
      'This email is already registered for this event.',
      { email: 'This email is already registered for this event.' },
    );
  }
  if (isCapacityConstraint(error)) {
    return new HttpError(409, 'CAPACITY_REACHED', 'This event is at capacity.');
  }
  return error;
}

function unavailableMessage(status) {
  if (status === 'cancelled') return 'This event has been called off. Registration is closed.';
  if (status === 'draft') return 'This event is not open for registration.';
  if (status === 'archived') return 'This event is archived and no longer accepts registration.';
  return 'This event is not open for registration.';
}

function promoteWaitlist(db, eventId, now) {
  const event = db.prepare(`SELECT capacity, status FROM events WHERE id = ?`).get(eventId);
  if (!event || event.status !== 'published') return [];
  const open = event.capacity - occupiedCount(db, eventId);
  if (open <= 0) return [];
  const waiting = db.prepare(
    `SELECT id FROM registrations
     WHERE event_id = ? AND status = 'waitlisted'
     ORDER BY created_at ASC, id ASC
     LIMIT ?`,
  ).all(eventId, open);
  const update = db.prepare(
    `UPDATE registrations
     SET status = 'confirmed', updated_at = ?, checked_in_at = NULL
     WHERE id = ? AND status = 'waitlisted'`,
  );
  const promoted = [];
  for (const row of waiting) {
    update.run(now, row.id);
    promoted.push(row.id);
  }
  return promoted;
}

export function registerForEvent(db, idOrSlug, body) {
  const input = validateRegistrationInput(body);
  let registrationId = null;

  try {
    withTransaction(db, () => {
      const raw = getEventRecord(db, idOrSlug);
      if (!raw || raw.status === 'draft' || raw.status === 'archived') {
        throw new HttpError(404, 'EVENT_NOT_FOUND', 'That event does not exist.');
      }
      if (raw.status !== 'published') {
        throw new HttpError(409, 'EVENT_UNAVAILABLE', unavailableMessage(raw.status));
      }
      if (new Date(raw.ends_at).getTime() < Date.now()) {
        throw new HttpError(409, 'EVENT_ENDED', 'Registration is closed because this event has ended.');
      }

      const existing = db.prepare(
        `SELECT id FROM registrations WHERE event_id = ? AND email = ?`,
      ).get(raw.id, input.email);
      if (existing) {
        throw new HttpError(
          409,
          'DUPLICATE_REGISTRATION',
          'This email is already registered for this event.',
          { email: 'This email is already registered for this event.' },
        );
      }

      const quote = quoteForEvent(db, raw, input.ticketTypeId, input.quantity);
      if (quote.totalCents > 0) {
        throw new HttpError(
          402,
          'PAYMENT_REQUIRED',
          'Pay for this ticket before the registration can be confirmed.',
        );
      }

      const open = raw.capacity - occupiedCount(db, raw.id) - heldSeats(db, raw.id);
      let status = 'confirmed';
      if (input.quantity > open) {
        if (open <= 0 && input.quantity === 1 && input.waitlist) {
          status = 'waitlisted';
        } else if (open <= 0 && input.quantity === 1) {
          throw new HttpError(
            409,
            'CAPACITY_REACHED',
            'This event is at capacity. You can join the waitlist instead.',
          );
        } else {
          throw new HttpError(
            409,
            'CAPACITY_REACHED',
            open <= 0
              ? 'This event is at capacity.'
              : `Only ${open} seat${open === 1 ? '' : 's'} are available.`,
          );
        }
      }

      registrationId = issueRegistration(db, {
        eventId: raw.id,
        fullName: input.fullName,
        email: input.email,
        organization: input.organization,
        interests: input.interests,
        status,
        quantity: input.quantity,
        ticketLabel: quote.label,
        amountCents: 0,
        currency: quote.currency,
      });
    });
  } catch (error) {
    throw mapWriteError(error);
  }

  return getRegistrationById(db, registrationId);
}

export function updateRegistrationStatus(db, id, nextStatus) {
  if (!['confirmed', 'waitlisted', 'cancelled', 'checked_in'].includes(nextStatus)) {
    throw new HttpError(400, 'VALIDATION', 'Choose a valid registration status.', {
      status: 'Choose a valid registration status.',
    });
  }

  try {
    withTransaction(db, () => {
      const current = db.prepare(`SELECT * FROM registrations WHERE id = ?`).get(id);
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'That registration does not exist.');
      if (current.status === nextStatus) return;

      if (nextStatus === 'checked_in' && !OCCUPIED.has(current.status)) {
        throw new HttpError(
          409,
          'NOT_CONFIRMED',
          'Only a confirmed seat can be checked in.',
        );
      }

      const now = new Date().toISOString();
      let checkedInAt = current.checked_in_at;
      if (nextStatus === 'checked_in') checkedInAt = current.checked_in_at || now;
      if (nextStatus === 'confirmed' || nextStatus === 'waitlisted' || nextStatus === 'cancelled') {
        checkedInAt = null;
      }

      db.prepare(
        `UPDATE registrations SET status = ?, updated_at = ?, checked_in_at = ? WHERE id = ?`,
      ).run(nextStatus, now, checkedInAt, id);

      if (OCCUPIED.has(current.status) && !OCCUPIED.has(nextStatus)) {
        promoteWaitlist(db, current.event_id, now);
      }
    });
  } catch (error) {
    throw mapWriteError(error);
  }

  return getRegistrationById(db, id);
}

export function checkInByCode(db, ticketCode) {
  const code = String(ticketCode ?? '').trim().toUpperCase();
  if (!/^EV[A-Z0-9]{8}$/.test(code)) {
    throw new HttpError(400, 'VALIDATION', 'Enter a ticket code like EV followed by 8 characters.', {
      ticketCode: 'Enter the code printed on the ticket.',
    });
  }
  const row = db.prepare(`SELECT id, status FROM registrations WHERE ticket_code = ?`).get(code);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'No ticket matches that code.');
  if (row.status === 'cancelled') {
    throw new HttpError(409, 'TICKET_CANCELLED', 'This ticket was cancelled.');
  }
  if (row.status === 'waitlisted') {
    throw new HttpError(409, 'NOT_CONFIRMED', 'This guest is still on the waitlist.');
  }
  if (row.status === 'checked_in') return getRegistrationById(db, row.id);
  return updateRegistrationStatus(db, row.id, 'checked_in');
}

function sortClause(sort) {
  switch (sort) {
    case 'latest':
      return 'e.starts_at DESC';
    case 'title':
      return 'e.title COLLATE NOCASE ASC';
    case 'popular':
      return 'confirmed_count DESC, e.starts_at ASC';
    case 'price':
      return 'starting_price_cents ASC, e.starts_at ASC';
    case 'price_desc':
      return 'starting_price_cents DESC, e.starts_at ASC';
    case 'soonest':
    default:
      return 'e.starts_at ASC';
  }
}

export function listCategories(db, { admin = false } = {}) {
  const rows = admin
    ? db.prepare(`SELECT DISTINCT category FROM events ORDER BY category`).all()
    : db.prepare(
        `SELECT DISTINCT category FROM events
         WHERE status IN ('published', 'cancelled')
         ORDER BY category`,
      ).all();
  return rows.map((row) => row.category);
}

export function listEvents(db, query, { admin = false } = {}) {
  const where = [];
  const params = [];
  const now = new Date().toISOString();
  const q = first(query.q)?.trim();
  const category = first(query.category)?.trim();
  const city = first(query.city)?.trim();
  const sort = first(query.sort) || 'soonest';
  const scope = first(query.scope) || 'upcoming';
  const status = first(query.status);
  const from = parseQueryDate(first(query.from), 'start');
  const to = parseQueryDate(first(query.to), 'end');
  const price = first(query.price);
  const limit = clamp(query.limit, 1, 60, 60);
  const offset = clamp(query.offset, 0, 5000, 0);

  if (admin) {
    if (status && status !== 'all') {
      where.push('e.status = ?');
      params.push(status);
    }
  } else if (scope === 'past') {
    where.push(`e.status = 'published' AND e.ends_at < ?`);
    params.push(now);
  } else if (scope === 'cancelled') {
    where.push(`e.status = 'cancelled'`);
  } else if (scope === 'all') {
    where.push(`e.status IN ('published', 'cancelled')`);
  } else {
    where.push(`e.status = 'published' AND e.ends_at >= ?`);
    params.push(now);
  }

  if (category) {
    where.push('e.category = ?');
    params.push(category);
  }
  if (city) {
    where.push('e.city = ?');
    params.push(city);
  }
  if (from) {
    where.push('e.starts_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('e.starts_at <= ?');
    params.push(to);
  }
  if (price === 'free') {
    where.push(`COALESCE((SELECT MIN(tt.price_cents) FROM ticket_types tt WHERE tt.event_id = e.id), e.price_cents) = 0`);
  } else if (price === 'paid') {
    where.push(`COALESCE((SELECT MIN(tt.price_cents) FROM ticket_types tt WHERE tt.event_id = e.id), e.price_cents) > 0`);
  }
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      `(e.title LIKE ? ESCAPE '\\' OR e.summary LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\' OR e.city LIKE ? ESCAPE '\\' OR e.venue LIKE ? ESCAPE '\\' OR e.category LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM} ${whereSql} GROUP BY e.id ORDER BY ${sortClause(sort)} LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS n FROM events e ${whereSql}`).get(...params).n,
  );
  return {
    events: rows.map(mapEvent),
    total,
    limit,
    offset,
    categories: listCategories(db, { admin }),
    cities: listCities(db, { admin }),
  };
}

function listCities(db, { admin = false } = {}) {
  const where = admin ? '' : `WHERE status IN ('published', 'cancelled')`;
  return db.prepare(`SELECT DISTINCT city FROM events ${where} ORDER BY city ASC`).all().map((row) => row.city);
}

function withOffer(db, event) {
  const ticketTypes = listTicketTypes(db, event.id);
  const held = heldSeats(db, event.id);
  const seatsRemaining = Math.max(0, event.capacity - event.confirmedCount - held);
  return {
    ...event,
    ticketTypes,
    heldSeats: held,
    seatsRemaining,
    registrationOpen: event.status === 'published' && !event.ended && seatsRemaining > 0,
    waitlistOpen: event.status === 'published' && !event.ended && seatsRemaining === 0,
  };
}

export function getPublicEvent(db, idOrSlug) {
  const row = getEventRecord(db, idOrSlug);
  if (!row || row.status === 'draft' || row.status === 'archived') {
    throw new HttpError(404, 'EVENT_NOT_FOUND', 'That event does not exist.');
  }
  return withOffer(db, mapEvent(row));
}

export function getAdminEvent(db, idOrSlug) {
  const row = getEventRecord(db, idOrSlug);
  if (!row) throw new HttpError(404, 'EVENT_NOT_FOUND', 'That event does not exist.');
  return withOffer(db, mapEvent(row));
}

function uniqueSlug(db, base) {
  let slug = base;
  let suffix = 2;
  while (db.prepare(`SELECT id FROM events WHERE slug = ?`).get(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export function createEvent(db, body) {
  const data = validateEventWrite(body, { partial: false });
  const now = new Date().toISOString();
  const slug = uniqueSlug(db, slugify(data.title));
  const info = db.prepare(
    `INSERT INTO events (
       slug, title, summary, description, category, venue, city, image_url,
       starts_at, ends_at, capacity, status, created_at, updated_at, details,
       address, latitude, longitude, price_cents, currency
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    slug,
    data.title,
    data.summary,
    data.description,
    data.category,
    data.venue,
    data.city,
    data.imageUrl,
    data.startsAt,
    data.endsAt,
    data.capacity,
    data.status,
    now,
    now,
    JSON.stringify({
      format: data.format || 'in-person',
      audience: '',
      perks: [],
      schedule: [],
      speakers: [],
      faqs: [],
    }),
    data.address || '',
    data.latitude ?? null,
    data.longitude ?? null,
    data.ticketTypes?.length ? startingPriceCents(data.ticketTypes, data.priceCents || 0) : (data.priceCents || 0),
    'USD',
  );
  const eventId = Number(info.lastInsertRowid);
  if (data.ticketTypes) replaceTicketTypes(db, eventId, data.ticketTypes);
  return getAdminEvent(db, eventId);
}

export function updateEvent(db, id, body) {
  const numericId = Number(id);
  const existing = db.prepare(`SELECT * FROM events WHERE id = ?`).get(numericId);
  if (!existing) throw new HttpError(404, 'EVENT_NOT_FOUND', 'That event does not exist.');
  const data = validateEventWrite(body, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'VALIDATION', 'Provide at least one field to update.');
  }

  const next = {
    title: data.title ?? existing.title,
    summary: data.summary ?? existing.summary,
    description: data.description ?? existing.description,
    category: data.category ?? existing.category,
    venue: data.venue ?? existing.venue,
    city: data.city ?? existing.city,
    imageUrl: data.imageUrl ?? existing.image_url,
    startsAt: data.startsAt ?? existing.starts_at,
    endsAt: data.endsAt ?? existing.ends_at,
    capacity: data.capacity ?? existing.capacity,
    status: data.status ?? existing.status,
    address: data.address ?? existing.address ?? '',
    latitude: data.latitude !== undefined ? data.latitude : existing.latitude,
    longitude: data.longitude !== undefined ? data.longitude : existing.longitude,
    priceCents: data.priceCents ?? existing.price_cents ?? 0,
  };

  if ((next.latitude == null) !== (next.longitude == null)) {
    throw new HttpError(400, 'VALIDATION', 'Check the highlighted fields.', {
      latitude: 'Enter both latitude and longitude, or leave both empty.',
    });
  }

  if (new Date(next.endsAt) <= new Date(next.startsAt)) {
    throw new HttpError(400, 'VALIDATION', 'Check the highlighted fields.', {
      endsAt: 'End must be after the start.',
    });
  }

  if (next.capacity < occupiedCount(db, existing.id)) {
    throw new HttpError(
      409,
      'CAPACITY_TOO_LOW',
      `Capacity cannot be lower than the ${occupiedCount(db, existing.id)} confirmed guests.`,
    );
  }

  let detailsJson = existing.details || '{}';
  if (data.format) {
    let details = {};
    try {
      details = JSON.parse(existing.details || '{}') || {};
    } catch {
      details = {};
    }
    if (!details || typeof details !== 'object' || Array.isArray(details)) details = {};
    details.format = data.format;
    detailsJson = JSON.stringify(details);
  }

  const priceCents = data.ticketTypes?.length
    ? startingPriceCents(data.ticketTypes, next.priceCents)
    : next.priceCents;
  db.prepare(
    `UPDATE events
     SET title = ?, summary = ?, description = ?, category = ?, venue = ?, city = ?,
         image_url = ?, starts_at = ?, ends_at = ?, capacity = ?, status = ?, details = ?,
         address = ?, latitude = ?, longitude = ?, price_cents = ?, currency = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.title,
    next.summary,
    next.description,
    next.category,
    next.venue,
    next.city,
    next.imageUrl,
    next.startsAt,
    next.endsAt,
    next.capacity,
    next.status,
    detailsJson,
    next.address,
    next.latitude,
    next.longitude,
    priceCents,
    existing.currency || 'USD',
    new Date().toISOString(),
    existing.id,
  );
  if (data.ticketTypes) replaceTicketTypes(db, existing.id, data.ticketTypes);
  return getAdminEvent(db, existing.id);
}

function registrationFilters(query) {
  const where = [];
  const params = [];
  const q = first(query.q)?.trim();
  const status = first(query.status);
  const eventId = first(query.eventId);
  if (eventId) {
    if (!/^\d+$/.test(eventId)) {
      throw new HttpError(400, 'VALIDATION', 'Event filter is invalid.');
    }
    where.push('r.event_id = ?');
    params.push(Number(eventId));
  }
  if (status && status !== 'all') {
    if (!['confirmed', 'waitlisted', 'cancelled', 'checked_in'].includes(status)) {
      throw new HttpError(400, 'VALIDATION', 'Status filter is invalid.');
    }
    where.push('r.status = ?');
    params.push(status);
  }
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      `(r.full_name LIKE ? ESCAPE '\\' OR r.email LIKE ? ESCAPE '\\' OR r.organization LIKE ? ESCAPE '\\' OR r.ticket_code LIKE ? ESCAPE '\\' OR e.title LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function listRegistrations(db, query) {
  const { whereSql, params } = registrationFilters(query);
  const pageSize = clamp(first(query.pageSize), 1, 50, 8);
  const page = clamp(first(query.page), 1, 100000, 1);
  const total = Number(
    db.prepare(
      `SELECT COUNT(*) AS n FROM registrations r JOIN events e ON e.id = r.event_id ${whereSql}`,
    ).get(...params).n,
  );
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(
    `${REGISTRATION_SELECT} ${whereSql}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, (safePage - 1) * pageSize);
  return {
    registrations: rows.map((row) => mapRegistration(row)),
    total,
    page: safePage,
    pageSize,
    pages,
  };
}

export function registrationsCsv(db, query) {
  const { whereSql, params } = registrationFilters(query);
  const rows = db.prepare(
    `${REGISTRATION_SELECT} ${whereSql}
     ORDER BY e.starts_at ASC, r.created_at ASC
     LIMIT 5000`,
  ).all(...params);
  const header = [
    'ticket_code',
    'full_name',
    'email',
    'organization',
    'interests',
    'status',
    'event',
    'city',
    'starts_at',
    'registered_at',
    'checked_in_at',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    const values = [
      row.ticket_code,
      row.full_name,
      row.email,
      row.organization,
      JSON.parse(row.interests).join('; '),
      row.status,
      row.title,
      row.city,
      row.starts_at,
      row.created_at,
      row.checked_in_at || '',
    ];
    lines.push(values.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function getHighlights(db) {
  const now = new Date().toISOString();
  const upcoming = Number(
    db.prepare(
      `SELECT COUNT(*) AS n FROM events WHERE status = 'published' AND ends_at >= ?`,
    ).get(now).n,
  );
  const seats = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN capacity > occupied THEN capacity - occupied ELSE 0 END), 0) AS n
     FROM (
       SELECT e.capacity,
         COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'checked_in') THEN COALESCE(r.quantity, 1) ELSE 0 END), 0) AS occupied
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.status = 'published' AND e.ends_at >= ?
       GROUP BY e.id
     )`,
  ).get(now);
  const cities = Number(
    db.prepare(
      `SELECT COUNT(DISTINCT city) AS n FROM events WHERE status = 'published' AND ends_at >= ?`,
    ).get(now).n,
  );
  const guests = Number(
    db.prepare(
      `SELECT COUNT(*) AS n FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.status IN ('confirmed', 'checked_in') AND e.status = 'published'`,
    ).get().n,
  );
  return {
    upcoming,
    seatsRemaining: Number(seats.n),
    cities,
    confirmedGuests: guests,
    categories: listCategories(db),
  };
}

export function getMetrics(db) {
  const totals = {
    events: count(db, `SELECT COUNT(*) AS n FROM events`),
    published: count(db, `SELECT COUNT(*) AS n FROM events WHERE status = 'published'`),
    draft: count(db, `SELECT COUNT(*) AS n FROM events WHERE status = 'draft'`),
    cancelled: count(db, `SELECT COUNT(*) AS n FROM events WHERE status = 'cancelled'`),
    archived: count(db, `SELECT COUNT(*) AS n FROM events WHERE status = 'archived'`),
    active: Number(
      db.prepare(`SELECT COUNT(*) AS n FROM events WHERE status = 'published' AND ends_at >= ?`).get(new Date().toISOString()).n,
    ),
  };
  const byStatus = Object.fromEntries(
    db.prepare(`SELECT status, COUNT(*) AS n FROM registrations GROUP BY status`).all().map((row) => [row.status, Number(row.n)]),
  );
  const registrationTotals = {
    all: count(db, `SELECT COUNT(*) AS n FROM registrations`),
    confirmed: byStatus.confirmed || 0,
    waitlisted: byStatus.waitlisted || 0,
    checkedIn: byStatus.checked_in || 0,
    cancelled: byStatus.cancelled || 0,
  };
  const fill = db.prepare(
    `SELECT COALESCE(SUM(capacity), 0) AS capacity, COALESCE(SUM(occupied), 0) AS occupied
     FROM (
       SELECT e.capacity,
         COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'checked_in') THEN COALESCE(r.quantity, 1) ELSE 0 END), 0) AS occupied
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.status = 'published'
       GROUP BY e.id
     )`,
  ).get();
  const capacity = Number(fill.capacity);
  const occupied = Number(fill.occupied);
  const days = utcDays(14);
  const grouped = new Map(
    db.prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM registrations
       WHERE created_at >= ?
       GROUP BY day`,
    ).all(`${days[0]}T00:00:00.000Z`).map((row) => [row.day, Number(row.n)]),
  );
  const registrationsByDay = days.map((day) => ({ day, count: grouped.get(day) || 0 }));
  const byCategory = db.prepare(
    `SELECT e.category AS category,
       COUNT(DISTINCT e.id) AS events,
       COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'checked_in') THEN 1 ELSE 0 END), 0) AS registrations
     FROM events e
     LEFT JOIN registrations r ON r.event_id = e.id
     WHERE e.status IN ('published', 'cancelled')
     GROUP BY e.category
     ORDER BY registrations DESC, e.category ASC`,
  ).all().map((row) => ({
    category: row.category,
    events: Number(row.events),
    registrations: Number(row.registrations),
  }));
  const now = new Date().toISOString();
  const capacityByEvent = db.prepare(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM}
     WHERE e.status = 'published' AND e.ends_at >= ?
     GROUP BY e.id
     ORDER BY e.starts_at ASC
     LIMIT 8`,
  ).all(now).map(mapEvent);
  const recent = db.prepare(
    `${REGISTRATION_SELECT} ORDER BY r.created_at DESC, r.id DESC LIMIT 6`,
  ).all().map((row) => mapRegistration(row));

  return {
    totals,
    registrations: registrationTotals,
    fillRate: capacity === 0 ? 0 : occupied / capacity,
    publishedCapacity: capacity,
    publishedOccupied: occupied,
    registrationsByDay,
    byCategory,
    capacityByEvent,
    recentRegistrations: recent,
  };
}

export async function withQr(registration) {
  const qrDataUrl = await QRCode.toDataURL(registration.ticketCode, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: { dark: '#07111f', light: '#f4f8ff' },
  });
  return { ...registration, qrDataUrl };
}

export function getTicket(db, code, { mask = true } = {}) {
  const normalized = String(code ?? '').trim().toUpperCase();
  const row = db.prepare(`${REGISTRATION_SELECT} WHERE r.ticket_code = ?`).get(normalized);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'That ticket could not be found.');
  return mapRegistration(row, { mask });
}

export function getTicketStatus(db, code) {
  const ticket = getTicket(db, code, { mask: true });
  return {
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    valid: ticket.status === 'confirmed' || ticket.status === 'checked_in',
    event: {
      title: ticket.event.title,
      startsAt: ticket.event.startsAt,
      venue: ticket.event.venue,
      city: ticket.event.city,
    },
  };
}

export function listTicketsForEmail(db, email) {
  return db.prepare(
    `${REGISTRATION_SELECT} WHERE r.email = ? ORDER BY r.created_at DESC, r.id DESC`,
  ).all(email).map((row) => mapRegistration(row, { mask: true }));
}

export async function ticketSvg(ticket) {
  const qr = await QRCode.toDataURL(ticket.ticketCode, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#07111f', light: '#f4f8ff' },
  });
  const when = new Date(ticket.event.startsAt).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="840" height="420" viewBox="0 0 840 420">
  <rect width="840" height="420" fill="#07111f"/>
  <rect x="28" y="28" width="784" height="364" fill="none" stroke="#3ecbff" stroke-width="3"/>
  <text x="56" y="78" fill="#3ecbff" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">EVENTRA TICKET</text>
  <text x="56" y="132" fill="#f4f8ff" font-family="Arial, sans-serif" font-size="36">${xml(ticket.event.title)}</text>
  <text x="56" y="178" fill="#f4f8ff" font-family="Arial, sans-serif" font-size="18">${xml(ticket.fullName)}</text>
  <text x="56" y="214" fill="#93a4c3" font-family="Arial, sans-serif" font-size="16">${xml(ticket.event.venue)} · ${xml(ticket.event.city)}</text>
  <text x="56" y="246" fill="#93a4c3" font-family="Arial, sans-serif" font-size="16">${xml(when)}</text>
  <text x="56" y="320" fill="#3ecbff" font-family="Arial, sans-serif" font-size="28" letter-spacing="2">${xml(ticket.ticketCode)}</text>
  <text x="56" y="354" fill="#93a4c3" font-family="Arial, sans-serif" font-size="14">${xml(ticket.status.replace('_', ' '))}</text>
  <image href="${qr}" x="560" y="78" width="220" height="220"/>
</svg>`;
}

function xml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]
  ));
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function first(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function clamp(value, min, max, fallback) {
  const number = Number(first(value));
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function count(db, sql) {
  return Number(db.prepare(sql).get().n);
}

function utcDays(amount) {
  const days = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = amount - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - offset);
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}
