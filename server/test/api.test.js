import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createAdmin } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { migrate, openDatabase } from '../src/db.js';
import { initializeDatabase } from '../src/seed.js';
import { registerForEvent } from '../src/services.js';

process.env.NODE_ENV = 'test';

const FIRST = ['Ava', 'Ben', 'Cora', 'Dan', 'Eve', 'Finn', 'Gia', 'Hugo', 'Ivy', 'Jed', 'Kim', 'Lio'];
const LAST = ['Carter', 'Nguyen', 'Singh', 'Ross', 'Diaz', 'Khan', 'Walsh', 'Berg', 'Cho', 'Nash', 'Okafor', 'Perez'];

function guest(n, extra = {}) {
  return {
    fullName: `${FIRST[n % FIRST.length]} ${LAST[n % LAST.length]}`,
    email: `guest${n}@campus.example`,
    organization: 'Campus Example',
    interests: ['Engineering'],
    ...extra,
  };
}

describe('Eventra API', { concurrency: 1 }, () => {
  let db;
  let server;
  let base;
  let adminCookie;

  before(async () => {
    db = openDatabase(':memory:');
    migrate(db);
    createAdmin(db, {
      email: 'admin@eventra.test',
      password: 'test-password-123',
      name: 'Test Admin',
      rounds: 4,
    });
    const app = createApp(db);
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
    adminCookie = await login('admin@eventra.test', 'test-password-123');
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    db.close();
  });

  function insertEvent(overrides = {}) {
    const now = new Date().toISOString();
    const starts = overrides.startsAt || new Date(Date.now() + 3 * 86400000).toISOString();
    const ends = overrides.endsAt || new Date(new Date(starts).getTime() + 4 * 3600000).toISOString();
    const info = db.prepare(
      `INSERT INTO events (
         slug, title, summary, description, category, venue, city, image_url,
         starts_at, ends_at, capacity, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      overrides.slug || `gathering-${crypto.randomUUID()}`,
      overrides.title || 'Test Gathering',
      overrides.summary || 'A useful summary for this gathering.',
      overrides.description || 'A longer description of the gathering for guests and organizers.',
      overrides.category || 'Technology',
      overrides.venue || 'Test Hall',
      overrides.city || 'Test City',
      overrides.imageUrl || '/covers/custom.svg',
      starts,
      ends,
      overrides.capacity ?? 10,
      overrides.status || 'published',
      now,
      now,
    );
    return Number(info.lastInsertRowid);
  }

  async function api(pathname, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: response.status, json, text, headers: response.headers };
  }

  async function login(email, password) {
    const response = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie()[0];
    assert.ok(cookie);
    return cookie.split(';')[0];
  }

  test('reports a healthy service', async () => {
    const res = await api('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });

  test('registers a guest and keeps the remaining capacity accurate', async () => {
    const id = insertEvent({ capacity: 5, title: 'Capacity Desk' });
    const res = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(1) });
    assert.equal(res.status, 201);
    assert.equal(res.json.registration.status, 'confirmed');
    assert.match(res.json.registration.ticketCode, /^EV[A-Z0-9]{8}$/);
    assert.equal(res.json.registration.email, 'guest1@campus.example');
    assert.ok(res.json.registration.qrDataUrl.startsWith('data:image/png'));

    const event = await api(`/api/events/${id}`);
    assert.equal(event.json.event.confirmedCount, 1);
    assert.equal(event.json.event.seatsRemaining, 4);
  });

  test('rejects a duplicate email regardless of letter case', async () => {
    const id = insertEvent({ capacity: 5 });
    const first = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(2, { email: 'Ada.Case@Campus.example', fullName: 'Ada Case' }),
    });
    assert.equal(first.status, 201);
    const second = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(3, { email: 'ada.case@campus.example', fullName: 'Ada Case' }),
    });
    assert.equal(second.status, 409);
    assert.equal(second.json.error.code, 'DUPLICATE_REGISTRATION');
    const count = db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n;
    assert.equal(count, 1);
  });

  test('rejects invalid registration input', async () => {
    const id = insertEvent();
    const res = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: { fullName: 'A', email: 'not-an-email', organization: '', interests: [] },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.code, 'VALIDATION');
    assert.ok(res.json.error.fields.fullName);
    assert.ok(res.json.error.fields.email);
    assert.ok(res.json.error.fields.organization);
    assert.ok(res.json.error.fields.interests);
  });

  test('rejects registration when capacity is reached and accepts a waitlist entry', async () => {
    const id = insertEvent({ capacity: 1 });
    const first = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(4) });
    assert.equal(first.status, 201);
    const blocked = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(5) });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.error.code, 'CAPACITY_REACHED');
    const waiting = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(5, { waitlist: true }),
    });
    assert.equal(waiting.status, 201);
    assert.equal(waiting.json.registration.status, 'waitlisted');
    const counts = db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN status = 'waitlisted' THEN 1 ELSE 0 END) AS waiting
       FROM registrations WHERE event_id = ?`,
    ).get(id);
    assert.equal(Number(counts.confirmed), 1);
    assert.equal(Number(counts.waiting), 1);
  });

  test('does not let concurrent registrations exceed capacity', async () => {
    const id = insertEvent({ capacity: 3 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => api(`/api/events/${id}/registrations`, {
        method: 'POST',
        body: guest(20 + index),
      })),
    );
    const created = results.filter((result) => result.status === 201);
    const full = results.filter((result) => result.status === 409 && result.json.error.code === 'CAPACITY_REACHED');
    assert.equal(created.length, 3);
    assert.equal(full.length, 5);
    const occupied = db.prepare(
      `SELECT COUNT(*) AS n FROM registrations
       WHERE event_id = ? AND status IN ('confirmed', 'checked_in')`,
    ).get(id).n;
    assert.equal(occupied, 3);
  });

  test('enforces capacity and uniqueness inside the database', () => {
    const roomy = insertEvent({ capacity: 5 });
    const insert = db.prepare(
      `INSERT INTO registrations (
         event_id, full_name, email, organization, interests, status, ticket_code, created_at, updated_at
       ) VALUES (?, 'Nia Cole', ?, 'Campus Example', '["Design"]', 'confirmed', ?, ?, ?)`,
    );
    const now = new Date().toISOString();
    insert.run(roomy, 'nia.cole@campus.example', 'EVDBTEST1', now, now);
    assert.throws(
      () => insert.run(roomy, 'nia.cole@campus.example', 'EVDBTEST2', now, now),
      /UNIQUE constraint failed/,
    );

    const full = insertEvent({ capacity: 1 });
    insert.run(full, 'one.seat@campus.example', 'EVDBTEST3', now, now);
    assert.throws(
      () => insert.run(full, 'other.person@campus.example', 'EVDBTEST4', now, now),
      /capacity_exceeded/,
    );
    assert.throws(
      () => insert.run(999999, 'missing.event@campus.example', 'EVDBTEST5', now, now),
      /FOREIGN KEY constraint failed/,
    );
  });

  test('rejects unknown, cancelled, ended, and unpublished events', async () => {
    const missing = await api('/api/events/999999/registrations', { method: 'POST', body: guest(40) });
    assert.equal(missing.status, 404);

    const cancelled = insertEvent({ status: 'cancelled' });
    const cancelledRes = await api(`/api/events/${cancelled}/registrations`, { method: 'POST', body: guest(41) });
    assert.equal(cancelledRes.status, 409);
    assert.equal(cancelledRes.json.error.code, 'EVENT_UNAVAILABLE');

    const draft = insertEvent({ status: 'draft', slug: 'hidden-draft', title: 'Hidden Draft Gathering' });
    const hidden = await api(`/api/events/${draft}`);
    assert.equal(hidden.status, 404);
    const listing = await api('/api/events?scope=all&q=Hidden%20Draft%20Gathering');
    assert.equal(listing.json.total, 0);

    const ended = insertEvent({
      startsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      endsAt: new Date(Date.now() - 86400000).toISOString(),
    });
    const endedRes = await api(`/api/events/${ended}/registrations`, { method: 'POST', body: guest(42) });
    assert.equal(endedRes.status, 409);
    assert.equal(endedRes.json.error.code, 'EVENT_ENDED');
  });

  test('treats search text as data rather than SQL', async () => {
    insertEvent({ title: 'Ordinary Calendar Item', slug: 'ordinary-calendar-item' });
    const injected = await api(`/api/events?scope=all&q=${encodeURIComponent("%' OR '1'='1")}`);
    assert.equal(injected.status, 200);
    assert.equal(injected.json.total, 0);
    const oddSort = await api('/api/events?scope=all&sort=latest%3BDROP%20TABLE%20events');
    assert.equal(oddSort.status, 200);
    assert.ok(db.prepare(`SELECT COUNT(*) AS n FROM events`).get().n > 0);
  });

  test('requires an organizer session for admin routes', async () => {
    const metrics = await api('/api/admin/metrics');
    assert.equal(metrics.status, 401);
    const created = await api('/api/admin/events', {
      method: 'POST',
      body: { title: 'Should Not Save' },
    });
    assert.equal(created.status, 401);
    const badLogin = await api('/api/admin/login', {
      method: 'POST',
      body: { email: 'admin@eventra.test', password: 'wrong-password' },
    });
    assert.equal(badLogin.status, 401);
    const me = await api('/api/admin/me', { cookie: adminCookie });
    assert.equal(me.status, 200);
    assert.equal(me.json.admin.email, 'admin@eventra.test');
  });

  test('lets an organizer create an event, search attendees, update status, and check in', async () => {
    const starts = new Date(Date.now() + 5 * 86400000).toISOString();
    const ends = new Date(Date.now() + 5 * 86400000 + 3 * 3600000).toISOString();
    const created = await api('/api/admin/events', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        title: 'Organizer Preview',
        summary: 'A preview gathering created from the admin API.',
        description: 'This description is long enough to satisfy the event validation rules.',
        category: 'Community',
        venue: 'Preview Room',
        city: 'Portland',
        imageUrl: '/covers/custom.svg',
        startsAt: starts,
        endsAt: ends,
        capacity: 4,
        status: 'published',
      },
    });
    assert.equal(created.status, 201);
    const eventId = created.json.event.id;

    const registration = await api(`/api/events/${eventId}/registrations`, {
      method: 'POST',
      body: guest(60, { fullName: 'Searchable Person', email: 'searchable.person@campus.example' }),
    });
    assert.equal(registration.status, 201);

    const found = await api('/api/admin/registrations?q=searchable.person', { cookie: adminCookie });
    assert.equal(found.status, 200);
    assert.equal(found.json.total, 1);
    assert.equal(found.json.registrations[0].email, 'searchable.person@campus.example');

    const cancelled = await api(`/api/admin/registrations/${registration.json.registration.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'cancelled' },
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.registration.status, 'cancelled');

    const restored = await api(`/api/admin/registrations/${registration.json.registration.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'confirmed' },
    });
    assert.equal(restored.status, 200);

    const checked = await api('/api/admin/check-in', {
      method: 'POST',
      cookie: adminCookie,
      body: { ticketCode: registration.json.registration.ticketCode.toLowerCase() },
    });
    assert.equal(checked.status, 200);
    assert.equal(checked.json.registration.status, 'checked_in');
    const again = await api('/api/admin/check-in', {
      method: 'POST',
      cookie: adminCookie,
      body: { ticketCode: registration.json.registration.ticketCode },
    });
    assert.equal(again.status, 200);
    assert.equal(again.json.registration.status, 'checked_in');
  });

  test('promotes the oldest waitlisted guest when a confirmed seat is cancelled', async () => {
    const id = insertEvent({ capacity: 1, title: 'Promotion Desk' });
    const confirmed = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(70) });
    const waiting = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(71, { waitlist: true }),
    });
    assert.equal(waiting.json.registration.status, 'waitlisted');
    const cancelled = await api(`/api/admin/registrations/${confirmed.json.registration.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'cancelled' },
    });
    assert.equal(cancelled.status, 200);
    const promoted = db.prepare(`SELECT status FROM registrations WHERE id = ?`).get(waiting.json.registration.id);
    assert.equal(promoted.status, 'confirmed');
  });

  test('refuses to shrink capacity below confirmed guests', async () => {
    const id = insertEvent({ capacity: 2 });
    await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(80) });
    await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(81) });
    const shrunk = await api(`/api/admin/events/${id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { capacity: 1 },
    });
    assert.equal(shrunk.status, 409);
    assert.equal(shrunk.json.error.code, 'CAPACITY_TOO_LOW');
  });

  test('exports attendees as CSV only for an organizer', async () => {
    const denied = await api('/api/admin/registrations.csv');
    assert.equal(denied.status, 401);
    const csv = await api('/api/admin/registrations.csv?q=searchable.person', { cookie: adminCookie });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.text, /ticket_code,full_name,email/);
    assert.match(csv.text, /searchable.person@campus.example/);
  });

  test('masks email on the public ticket and rejects bad JSON', async () => {
    const id = insertEvent({ capacity: 3 });
    const created = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(90) });
    const ticket = await api(`/api/tickets/${created.json.registration.ticketCode}`);
    assert.equal(ticket.status, 200);
    assert.notEqual(ticket.json.ticket.email, 'guest90@campus.example');
    assert.match(ticket.json.ticket.email, /@campus\.example$/);

    const bad = await fetch(`${base}/api/events/${id}/registrations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(bad.status, 400);
    const payload = await bad.json();
    assert.equal(payload.error.code, 'BAD_JSON');
  });

  test('logs an organizer out', async () => {
    const cookie = await login('admin@eventra.test', 'test-password-123');
    const out = await api('/api/admin/logout', { method: 'POST', cookie });
    assert.equal(out.status, 204);
    const me = await api('/api/admin/me', { cookie });
    assert.equal(me.status, 401);
  });
});

describe('Eventra persistence', { concurrency: 1 }, () => {
  test('keeps registrations after the database is closed, reopened, and migrated again', () => {
    const filename = path.join(os.tmpdir(), `eventra-${crypto.randomUUID()}.sqlite`);
    const first = openDatabase(filename);
    migrate(first);
    const now = new Date().toISOString();
    const starts = new Date(Date.now() + 86400000).toISOString();
    const ends = new Date(Date.now() + 2 * 86400000).toISOString();
    const info = first.prepare(
      `INSERT INTO events (
         slug, title, summary, description, category, venue, city, image_url,
         starts_at, ends_at, capacity, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `persist-${crypto.randomUUID()}`,
      'Persistence Gathering',
      'A summary that stays on disk.',
      'A description that should still be here after restart.',
      'Workshop',
      'Disk Hall',
      'Austin',
      '/covers/custom.svg',
      starts,
      ends,
      5,
      'published',
      now,
      now,
    );
    const registration = registerForEvent(first, Number(info.lastInsertRowid), guest(7));
    assert.equal(registration.status, 'confirmed');
    first.close();

    const second = openDatabase(filename);
    migrate(second);
    const saved = second.prepare(`SELECT email, status FROM registrations WHERE ticket_code = ?`).get(registration.ticketCode);
    assert.equal(saved.email, 'guest7@campus.example');
    assert.equal(saved.status, 'confirmed');
    const before = second.prepare(`SELECT COUNT(*) AS n FROM registrations`).get().n;
    migrate(second);
    assert.equal(second.prepare(`SELECT COUNT(*) AS n FROM registrations`).get().n, before);
    second.close();
    fs.rmSync(filename, { force: true });
    fs.rmSync(`${filename}-wal`, { force: true });
    fs.rmSync(`${filename}-shm`, { force: true });
  });

  test('seeds once and does not erase an existing registration on the next startup', () => {
    const filename = path.join(os.tmpdir(), `eventra-seed-${crypto.randomUUID()}.sqlite`);
    const db = openDatabase(filename);
    const first = initializeDatabase(db);
    assert.equal(first.seeded, true);
    assert.equal(first.adminCreated, true);
    const eventCount = db.prepare(`SELECT COUNT(*) AS n FROM events`).get().n;
    assert.ok(eventCount >= 10);
    const event = db.prepare(`SELECT id FROM events WHERE slug = 'northline-design-summit'`).get();
    const registration = registerForEvent(db, event.id, guest(8, { email: 'kept.guest@campus.example', fullName: 'Kept Guest' }));
    const second = initializeDatabase(db);
    assert.equal(second.seeded, false);
    assert.equal(second.adminCreated, false);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM events`).get().n, eventCount);
    const stillThere = db.prepare(`SELECT id FROM registrations WHERE ticket_code = ?`).get(registration.ticketCode);
    assert.ok(stillThere);
    db.close();
    fs.rmSync(filename, { force: true });
    fs.rmSync(`${filename}-wal`, { force: true });
    fs.rmSync(`${filename}-shm`, { force: true });
  });
});
