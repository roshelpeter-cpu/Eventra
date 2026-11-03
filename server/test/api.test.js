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
import { clearTestInbox, failNextEmail, lastTestEmail } from '../src/mail.js';
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

  test('counts ticket quantity toward capacity', async () => {
    const id = insertEvent({ capacity: 4 });
    const res = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(91, { quantity: 3 }),
    });
    assert.equal(res.status, 201);
    const event = await api(`/api/events/${id}`);
    assert.equal(event.json.event.confirmedCount, 3);
    assert.equal(event.json.event.seatsRemaining, 1);
    assert.equal(event.json.event.latitude, null);
    const tooMany = await api(`/api/events/${id}/registrations`, {
      method: 'POST',
      body: guest(92, { quantity: 2 }),
    });
    assert.equal(tooMany.status, 409);
    assert.equal(tooMany.json.error.code, 'CAPACITY_REACHED');
  });

  test('confirms a paid seat only after a verified development payment', async () => {
    const id = insertEvent({ title: 'Paid Gathering', capacity: 2 });
    db.prepare(
      `INSERT INTO ticket_types (event_id, name, price_cents, fee_cents, currency, sort_order)
       VALUES (?, 'Regular', 50000, 2000, 'INR', 0)`,
    ).run(id);
    const blocked = await api(`/api/events/${id}/registrations`, { method: 'POST', body: guest(90) });
    assert.equal(blocked.status, 402);
    assert.equal(blocked.json.error.code, 'PAYMENT_REQUIRED');

    const abandoned = await api(`/api/events/${id}/checkout`, {
      method: 'POST',
      body: guest(90, { quantity: 2 }),
    });
    assert.equal(abandoned.status, 200);
    assert.equal(abandoned.json.checkout.simulation, true);
    assert.equal(abandoned.json.payment.amountCents, 104000);
    const failed = await api(`/api/payments/${abandoned.json.payment.publicId}/simulate`, {
      method: 'POST',
      body: { outcome: 'failed' },
    });
    assert.equal(failed.json.payment.status, 'failed');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 0);

    const checkout = await api(`/api/events/${id}/checkout`, {
      method: 'POST',
      body: guest(90, { quantity: 2 }),
    });
    const paid = await api(`/api/payments/${checkout.json.payment.publicId}/simulate`, {
      method: 'POST',
      body: { outcome: 'paid' },
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.json.registration.status, 'confirmed');
    const repeat = await api(`/api/payments/${checkout.json.payment.publicId}/simulate`, {
      method: 'POST',
      body: { outcome: 'paid' },
    });
    assert.equal(repeat.json.registration.ticketCode, paid.json.registration.ticketCode);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 1);

    const duplicate = await api(`/api/events/${id}/checkout`, {
      method: 'POST',
      body: guest(90),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.error.code, 'DUPLICATE_REGISTRATION');

    const status = await api(`/api/tickets/${paid.json.registration.ticketCode}/status`);
    assert.equal(status.json.ticket.valid, true);
    assert.equal(status.json.ticket.email, undefined);
    assert.equal(status.json.ticket.fullName, undefined);
  });

  test('confirms a simulated checkout only after a single-use emailed code', async () => {
    const id = insertEvent({ title: 'Checkout Gathering', capacity: 4 });
    db.prepare(
      `INSERT INTO ticket_types (event_id, name, price_cents, fee_cents, currency, sort_order)
       VALUES (?, 'Regular', 4900, 0, 'USD', 0)`,
    ).run(id);
    const checkout = await api(`/api/events/${id}/checkout`, {
      method: 'POST',
      body: guest(94, { quantity: 1 }),
    });
    assert.equal(checkout.status, 200);
    const publicId = checkout.json.payment.publicId;
    clearTestInbox();
    failNextEmail();
    const undelivered = await api(`/api/payments/${publicId}/card`, {
      method: 'POST',
      body: {
        cardLast4: '4242',
        cardBrand: 'Visa',
        cardholderName: 'Ava Carter',
        cardNumber: '4242424242424242',
        cvv: '123',
      },
    });
    assert.equal(undelivered.status, 503);
    assert.equal(undelivered.json.error.code, 'DELIVERY_UNAVAILABLE');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM verification_codes WHERE subject = ?`).get(publicId).n, 0);
    assert.equal(db.prepare(`SELECT status FROM payments WHERE public_id = ?`).get(publicId).status, 'pending');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 0);

    clearTestInbox();
    const card = await api(`/api/payments/${publicId}/card`, {
      method: 'POST',
      body: {
        cardLast4: '4242',
        cardBrand: 'Visa',
        cardholderName: 'Ava Carter',
        cardNumber: '4242424242424242',
        cvv: '123',
      },
    });
    const mailed = lastTestEmail();
    assert.equal(card.status, 200);
    assert.equal(card.json.verification.sent, true);
    assert.equal(card.json.verification.code, undefined);
    assert.equal(mailed.subject, 'Your Eventra Verification Code');
    assert.match(mailed.code, /^\d{6}$/);
    assert.match(mailed.text, /expires in 5 minutes/);
    assert.match(mailed.text, /never ask you to share this code/);
    assert.equal(JSON.stringify(card.json).includes('expires in 5 minutes'), false);
    assert.equal(JSON.stringify(card.json).includes(mailed.code), false);
    assert.equal(JSON.stringify(card.json).includes('4242424242424242'), false);
    assert.equal(card.json.payment.cardLast4, '4242');
    const stored = db.prepare(`SELECT * FROM payments WHERE public_id = ?`).get(publicId);
    assert.equal(stored.card_last4, '4242');
    assert.equal(JSON.stringify(stored).includes('4242424242424242'), false);
    const hashed = db.prepare(
      `SELECT code_hash FROM verification_codes WHERE subject = ? ORDER BY id DESC LIMIT 1`,
    ).get(publicId);
    assert.notEqual(hashed.code_hash, mailed.code);
    assert.equal(hashed.code_hash.includes(mailed.code), false);

    const wrongCode = mailed.code === '111111' ? '222222' : '111111';
    const wrong = await api(`/api/payments/${publicId}/otp/verify`, {
      method: 'POST',
      body: { code: wrongCode },
    });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.json.error.code, 'CODE_INVALID');
    const early = await api(`/api/payments/${publicId}/otp`, { method: 'POST', body: {} });
    assert.equal(early.status, 429);

    db.prepare(
      `UPDATE verification_codes SET expires_at = ? WHERE id = (SELECT MAX(id) FROM verification_codes WHERE subject = ?)`,
    ).run(new Date(Date.now() - 1000).toISOString(), publicId);
    const expired = await api(`/api/payments/${publicId}/otp/verify`, {
      method: 'POST',
      body: { code: mailed.code },
    });
    assert.equal(expired.status, 400);
    assert.equal(expired.json.error.code, 'CODE_EXPIRED');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 0);

    db.prepare(`UPDATE verification_codes SET created_at = ? WHERE subject = ?`).run(
      new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      publicId,
    );
    const resent = await api(`/api/payments/${publicId}/otp`, { method: 'POST', body: {} });
    const replacement = lastTestEmail();
    assert.equal(resent.status, 200);
    assert.equal(resent.json.verification.code, undefined);
    assert.notEqual(replacement.code, mailed.code);
    assert.equal(JSON.stringify(resent.json).includes(replacement.code), false);
    const stale = await api(`/api/payments/${publicId}/otp/verify`, {
      method: 'POST',
      body: { code: mailed.code },
    });
    assert.equal(stale.status, 400);

    const paid = await api(`/api/payments/${publicId}/otp/verify`, {
      method: 'POST',
      body: { code: replacement.code },
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.json.registration.status, 'confirmed');
    assert.equal(paid.json.payment.note, '');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 1);
    assert.equal(
      db.prepare(`SELECT COALESCE(SUM(quantity), 0) AS n FROM registrations WHERE event_id = ? AND status = 'confirmed'`).get(id).n,
      1,
    );
    const reused = await api(`/api/payments/${publicId}/otp/verify`, {
      method: 'POST',
      body: { code: replacement.code },
    });
    assert.equal(reused.status, 200);
    assert.equal(reused.json.registration.ticketCode, paid.json.registration.ticketCode);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 1);
  });

  test('does not claim a code was sent when Resend credentials are missing', async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.EMAIL_FROM;
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => {
      logged.push(args.map((item) => String(item)).join(' '));
    };
    process.env.NODE_ENV = 'development';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    try {
      const id = insertEvent({ title: 'Unsent Gathering', capacity: 4 });
      db.prepare(
        `INSERT INTO ticket_types (event_id, name, price_cents, fee_cents, currency, sort_order)
         VALUES (?, 'Regular', 4900, 0, 'USD', 0)`,
      ).run(id);
      const checkout = await api(`/api/events/${id}/checkout`, {
        method: 'POST',
        body: guest(96, { email: 'unsent.guest@campus.example', fullName: 'Unsent Guest' }),
      });
      assert.equal(checkout.status, 200);
      const publicId = checkout.json.payment.publicId;
      const card = await api(`/api/payments/${publicId}/card`, {
        method: 'POST',
        body: { cardLast4: '4242', cardBrand: 'Visa', cardholderName: 'Unsent Guest' },
      });
      assert.equal(card.status, 503);
      assert.equal(card.json.error.code, 'DELIVERY_UNAVAILABLE');
      assert.equal(card.json.error.message, 'We could not send a verification code. Please try again.');
      assert.equal(card.json.verification, undefined);
      assert.equal(JSON.stringify(card.json).includes('RESEND'), false);
      assert.equal(JSON.stringify(card.json).includes('SMTP'), false);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM verification_codes WHERE subject = ?`).get(publicId).n, 0);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?`).get(id).n, 0);

      const tickets = await api('/api/tickets/otp', {
        method: 'POST',
        body: { email: 'missing.resend@campus.example' },
      });
      assert.equal(tickets.status, 503);
      assert.equal(tickets.json.verification, undefined);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM verification_codes WHERE subject = ?`).get('missing.resend@campus.example').n, 0);
      assert.match(logged.join('\n'), /Set RESEND_API_KEY and EMAIL_FROM/);
      assert.equal(/\b\d{6}\b/.test(logged.join('\n')), false);
    } finally {
      console.error = originalError;
      process.env.NODE_ENV = previousEnv;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
      if (previousFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = previousFrom;
    }
  });

  test('lists every ticket for an email only after its own verification code', async () => {
    const firstEvent = insertEvent({ title: 'Ada Gathering', venue: 'North Hall', city: 'Test City' });
    const secondEvent = insertEvent({ title: 'Ada Workshop', venue: 'South Hall', city: 'Test City' });
    const otherEvent = insertEvent({ title: 'Ben Gathering', venue: 'West Hall', city: 'Test City' });
    const ada = 'ada.tickets@campus.example';
    const ben = 'ben.tickets@campus.example';
    const first = await api(`/api/events/${firstEvent}/registrations`, {
      method: 'POST',
      body: guest(11, { email: ada, fullName: 'Ada Lovelace', quantity: 2 }),
    });
    const second = await api(`/api/events/${secondEvent}/registrations`, {
      method: 'POST',
      body: guest(12, { email: ada, fullName: 'Ada Lovelace', quantity: 1 }),
    });
    const other = await api(`/api/events/${otherEvent}/registrations`, {
      method: 'POST',
      body: guest(13, { email: ben, fullName: 'Ben Example', quantity: 1 }),
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(other.status, 201);

    clearTestInbox();
    failNextEmail();
    const undelivered = await api('/api/tickets/otp', { method: 'POST', body: { email: ada } });
    assert.equal(undelivered.status, 503);
    assert.equal(undelivered.json.verification, undefined);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM verification_codes WHERE purpose = 'ticket_email' AND subject = ?`).get(ada).n, 0);

    clearTestInbox();
    const sent = await api('/api/tickets/otp', { method: 'POST', body: { email: ada } });
    const mailed = lastTestEmail();
    assert.equal(sent.status, 200);
    assert.equal(sent.json.verification.sent, true);
    assert.equal(sent.json.verification.code, undefined);
    assert.equal(sent.json.accessToken, undefined);
    assert.equal(JSON.stringify(sent.json).includes(mailed.code), false);
    assert.equal(mailed.subject, 'Your Eventra Ticket Access Code');
    assert.equal(mailed.kind, 'tickets');
    assert.match(mailed.code, /^\d{6}$/);
    assert.match(mailed.text, /expires in 5 minutes/);
    assert.match(mailed.text, /never ask you to share this code/);
    assert.match(mailed.text, /tickets registered to this email address/);
    const stored = db.prepare(
      `SELECT purpose, code_hash FROM verification_codes WHERE subject = ? AND purpose = 'ticket_email' ORDER BY id DESC LIMIT 1`,
    ).get(ada);
    assert.equal(stored.purpose, 'ticket_email');
    assert.notEqual(stored.code_hash, mailed.code);

    const cooled = await api('/api/tickets/otp', { method: 'POST', body: { email: ada } });
    assert.equal(cooled.status, 429);

    const wrongCode = mailed.code === '111111' ? '222222' : '111111';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrong = await api('/api/tickets/otp/verify', { method: 'POST', body: { email: ada, code: wrongCode } });
      assert.equal(wrong.status, 400);
      assert.equal(wrong.json.error.code, 'CODE_INVALID');
      assert.equal(wrong.json.tickets, undefined);
      assert.equal(wrong.json.accessToken, undefined);
    }
    const locked = await api('/api/tickets/otp/verify', { method: 'POST', body: { email: ada, code: wrongCode } });
    assert.equal(locked.status, 400);
    assert.match(locked.json.error.message, /Too many incorrect attempts/);
    const lockedCorrect = await api('/api/tickets/otp/verify', { method: 'POST', body: { email: ada, code: mailed.code } });
    assert.equal(lockedCorrect.status, 400);
    assert.equal(lockedCorrect.json.tickets, undefined);

    db.prepare(
      `UPDATE verification_codes SET created_at = ?, expires_at = ? WHERE purpose = 'ticket_email' AND subject = ?`,
    ).run(new Date(Date.now() - 2 * 60 * 1000).toISOString(), new Date(Date.now() - 1000).toISOString(), ada);
    const expired = await api('/api/tickets/otp/verify', { method: 'POST', body: { email: ada, code: mailed.code } });
    assert.equal(expired.status, 400);
    assert.equal(expired.json.error.code, 'CODE_EXPIRED');

    const resent = await api('/api/tickets/otp', { method: 'POST', body: { email: ada } });
    const replacement = lastTestEmail();
    assert.equal(resent.status, 200);
    assert.equal(resent.json.verification.code, undefined);
    assert.notEqual(replacement.code, mailed.code);
    assert.equal(JSON.stringify(resent.json).includes(replacement.code), false);
    const stale = await api('/api/tickets/otp/verify', { method: 'POST', body: { email: ada, code: mailed.code } });
    assert.equal(stale.status, 400);

    const paymentCode = '135790';
    const pepper = process.env.OTP_PEPPER || 'eventra-development-pepper';
    db.prepare(
      `INSERT INTO verification_codes (purpose, subject, code_hash, expires_at, attempts, created_at)
       VALUES ('payment_email', 'pay_ticket_isolation', ?, ?, 0, ?)`,
    ).run(
      crypto.createHmac('sha256', pepper).update(paymentCode).digest('hex'),
      new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    );
    const paymentCodeOnTickets = await api('/api/tickets/otp/verify', {
      method: 'POST',
      body: { email: ada, code: paymentCode },
    });
    assert.equal(paymentCodeOnTickets.status, 400);
    assert.equal(paymentCodeOnTickets.json.tickets, undefined);

    const verified = await api('/api/tickets/otp/verify', {
      method: 'POST',
      body: { email: ada, code: replacement.code },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.json.code, undefined);
    assert.notEqual(verified.json.accessToken, replacement.code);
    assert.equal(verified.json.tickets.length, 2);
    const titles = verified.json.tickets.map((ticket) => ticket.event.title).sort();
    assert.deepEqual(titles, ['Ada Gathering', 'Ada Workshop']);
    const quantities = Object.fromEntries(verified.json.tickets.map((ticket) => [ticket.event.title, ticket.quantity]));
    assert.equal(quantities['Ada Gathering'], 2);
    assert.equal(quantities['Ada Workshop'], 1);
    for (const ticket of verified.json.tickets) {
      assert.equal(ticket.qrDataUrl.startsWith('data:image'), true);
      assert.equal(ticket.email.includes(ada), false);
      assert.equal(ticket.status, 'confirmed');
    }
    assert.equal(JSON.stringify(verified.json).includes(ben), false);
    assert.equal(verified.json.tickets.some((ticket) => ticket.ticketCode === other.json.registration.ticketCode), false);

    const reused = await api('/api/tickets/otp/verify', {
      method: 'POST',
      body: { email: ada, code: replacement.code },
    });
    assert.equal(reused.status, 400);

    const listed = await api('/api/tickets/list', {
      method: 'POST',
      body: { accessToken: verified.json.accessToken, email: ben },
    });
    assert.equal(listed.status, 200);
    assert.equal(listed.json.tickets.length, 2);
    assert.equal(JSON.stringify(listed.json).includes(other.json.registration.ticketCode), false);
    const emailOnly = await api('/api/tickets/list', { method: 'POST', body: { email: ada } });
    assert.equal(emailOnly.status, 401);
    assert.equal(emailOnly.json.tickets, undefined);
    const paymentAsToken = await api('/api/tickets/list', { method: 'POST', body: { accessToken: paymentCode } });
    assert.equal(paymentAsToken.status, 401);

    db.prepare(`UPDATE verification_codes SET expires_at = ? WHERE purpose = 'ticket_grant' AND subject = ?`).run(
      new Date(Date.now() - 1000).toISOString(),
      ada,
    );
    const expiredGrant = await api('/api/tickets/list', {
      method: 'POST',
      body: { accessToken: verified.json.accessToken },
    });
    assert.equal(expiredGrant.status, 401);

    clearTestInbox();
    const emptyEmail = 'empty.tickets@campus.example';
    const emptySent = await api('/api/tickets/otp', { method: 'POST', body: { email: emptyEmail } });
    const emptyMail = lastTestEmail();
    assert.equal(emptySent.status, 200);
    const emptyVerified = await api('/api/tickets/otp/verify', {
      method: 'POST',
      body: { email: emptyEmail, code: emptyMail.code },
    });
    assert.equal(emptyVerified.status, 200);
    assert.deepEqual(emptyVerified.json.tickets, []);
    const emptyListed = await api('/api/tickets/list', {
      method: 'POST',
      body: { accessToken: emptyVerified.json.accessToken },
    });
    assert.deepEqual(emptyListed.json.tickets, []);

    const opened = verified.json.tickets.find((ticket) => ticket.event.title === 'Ada Gathering');
    const detail = await api(`/api/tickets/${opened.ticketCode}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.ticket.event.venue, 'North Hall');
    assert.equal(detail.json.ticket.qrDataUrl.startsWith('data:image'), true);
    const download = await api(`/api/tickets/${opened.ticketCode}/download`);
    assert.equal(download.status, 200);
    assert.match(download.text, /<svg/);
    const removed = await api('/api/tickets/lookup', { method: 'POST', body: { email: ada, ticketCode: opened.ticketCode } });
    assert.equal(removed.status, 404);

    const burstEmail = 'burst.tickets@campus.example';
    clearTestInbox();
    for (let count = 0; count < 5; count += 1) {
      if (count > 0) {
        db.prepare(`UPDATE verification_codes SET created_at = ? WHERE purpose = 'ticket_email' AND subject = ?`).run(
          new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          burstEmail,
        );
      }
      const burst = await api('/api/tickets/otp', { method: 'POST', body: { email: burstEmail } });
      assert.equal(burst.status, 200);
      assert.equal(burst.json.verification.code, undefined);
    }
    db.prepare(`UPDATE verification_codes SET created_at = ? WHERE purpose = 'ticket_email' AND subject = ?`).run(
      new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      burstEmail,
    );
    const blocked = await api('/api/tickets/otp', { method: 'POST', body: { email: burstEmail } });
    assert.equal(blocked.status, 429);
  });

  test('rejects an unsigned payment webhook and saves a newsletter address once', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    try {
      const webhook = await api('/api/webhooks/razorpay', {
        method: 'POST',
        body: { event: 'payment.captured' },
      });
      assert.equal(webhook.status, 400);
      assert.equal(webhook.json.error.code, 'PAYMENT_INVALID');
    } finally {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    }
    const subscribed = await api('/api/subscribe', {
      method: 'POST',
      body: { email: 'News@Campus.example' },
    });
    assert.equal(subscribed.status, 201);
    const repeat = await api('/api/subscribe', {
      method: 'POST',
      body: { email: 'news@campus.example' },
    });
    assert.equal(repeat.status, 201);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE email = ?`).get('news@campus.example').n, 1);
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
