import crypto from 'node:crypto';
import { withTransaction } from './db.js';
import { HttpError } from './errors.js';
import { heldSeats, quoteForEvent } from './pricing.js';
import {
  getEventRecord,
  getRegistrationById,
  issueRegistration,
  mapWriteError,
  registerForEvent,
} from './services.js';
import { validateRegistrationInput } from './validate.js';

const HOLD_MS = 15 * 60 * 1000;

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function developmentPaymentsAllowed() {
  return process.env.NODE_ENV !== 'production';
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function newPublicId() {
  return crypto.randomBytes(18).toString('base64url');
}

function expireStale(db) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE payments SET status = 'expired', updated_at = ?
     WHERE status = 'pending' AND expires_at <= ?`,
  ).run(now, now);
}

function occupiedSeats(db, eventId) {
  return Number(
    db.prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS n FROM registrations
       WHERE event_id = ? AND status IN ('confirmed', 'checked_in')`,
    ).get(eventId).n,
  );
}

const PAYMENT_SELECT = `
  SELECT p.*, e.slug, e.title, e.venue, e.city, e.starts_at, e.image_url, e.capacity
  FROM payments p
  JOIN events e ON e.id = p.event_id
`;

function mapPayment(row) {
  return {
    publicId: row.public_id,
    status: row.status,
    provider: row.provider,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    quantity: Number(row.quantity),
    ticketLabel: row.ticket_label,
    fullName: row.full_name,
    email: row.email,
    organization: row.organization,
    expiresAt: row.expires_at,
    note: row.note || '',
    providerOrderId: row.provider_order_id || null,
    event: {
      id: row.event_id,
      slug: row.slug,
      title: row.title,
      venue: row.venue,
      city: row.city,
      startsAt: row.starts_at,
      imageUrl: row.image_url,
    },
  };
}

function loadPayment(db, publicId) {
  return db.prepare(`${PAYMENT_SELECT} WHERE p.public_id = ?`).get(publicId) || null;
}

export function getPayment(db, publicId) {
  expireStale(db);
  const row = loadPayment(db, publicId);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'That payment could not be found.');
  return mapPayment(row);
}

function assertOpen(raw) {
  if (!raw || raw.status === 'draft' || raw.status === 'archived') {
    throw new HttpError(404, 'EVENT_NOT_FOUND', 'That event does not exist.');
  }
  if (raw.status !== 'published') {
    throw new HttpError(409, 'EVENT_UNAVAILABLE', 'This event is not open for registration.');
  }
  if (new Date(raw.ends_at).getTime() < Date.now()) {
    throw new HttpError(409, 'EVENT_ENDED', 'Registration is closed because this event has ended.');
  }
}

function checkoutConfig(row) {
  if (row.provider === 'razorpay') {
    return {
      provider: 'razorpay',
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: row.provider_order_id,
      amount: Number(row.amount_cents),
      currency: row.currency,
    };
  }
  return {
    provider: 'development',
    simulation: true,
    amount: Number(row.amount_cents),
    currency: row.currency,
  };
}

export async function startCheckout(db, idOrSlug, body) {
  const input = validateRegistrationInput(body);
  const raw = getEventRecord(db, idOrSlug);
  assertOpen(raw);
  const quote = quoteForEvent(db, raw, input.ticketTypeId, input.quantity);
  if (quote.totalCents === 0) {
    const registration = registerForEvent(db, idOrSlug, body);
    return { registration, payment: null, checkout: null };
  }
  if (!razorpayConfigured() && !developmentPaymentsAllowed()) {
    throw new HttpError(
      503,
      'PAYMENT_NOT_CONFIGURED',
      'Payment is not configured. Add Razorpay test keys before a paid registration can be confirmed.',
    );
  }

  const provider = razorpayConfigured() ? 'razorpay' : 'development';
  let paymentId = null;
  try {
    withTransaction(db, () => {
      expireStale(db);
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

      const now = new Date();
      const pending = db.prepare(
        `SELECT * FROM payments
         WHERE event_id = ? AND email = ? AND status = 'pending' AND expires_at > ?`,
      ).get(raw.id, input.email, now.toISOString());
      if (
        pending
        && pending.quantity === quote.quantity
        && pending.amount_cents === quote.totalCents
        && pending.ticket_label === quote.label
        && pending.provider === provider
      ) {
        paymentId = pending.id;
        return;
      }
      if (pending) {
        db.prepare(
          `UPDATE payments SET status = 'cancelled', note = ?, updated_at = ? WHERE id = ?`,
        ).run('Replaced by a new checkout.', now.toISOString(), pending.id);
      }

      const open = raw.capacity - occupiedSeats(db, raw.id) - heldSeats(db, raw.id);
      if (quote.quantity > open) {
        throw new HttpError(
          409,
          'CAPACITY_REACHED',
          open <= 0 ? 'This event is at capacity.' : `Only ${open} seat${open === 1 ? '' : 's'} are available.`,
        );
      }

      const expires = new Date(now.getTime() + HOLD_MS).toISOString();
      const info = db.prepare(
        `INSERT INTO payments (
           public_id, event_id, ticket_type_id, ticket_label, quantity,
           full_name, email, organization, interests, amount_cents, currency,
           status, provider, expires_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      ).run(
        newPublicId(),
        raw.id,
        quote.ticketTypeId,
        quote.label,
        quote.quantity,
        input.fullName,
        input.email,
        input.organization,
        JSON.stringify(input.interests),
        quote.totalCents,
        quote.currency,
        provider,
        expires,
        now.toISOString(),
        now.toISOString(),
      );
      paymentId = Number(info.lastInsertRowid);
    });
  } catch (error) {
    throw mapWriteError(error);
  }

  const row = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (provider === 'razorpay' && !row.provider_order_id) {
    try {
      const order = await createRazorpayOrder({
        amount: row.amount_cents,
        currency: row.currency,
        receipt: row.public_id,
      });
      db.prepare(
        `UPDATE payments SET provider_order_id = ?, updated_at = ? WHERE id = ?`,
      ).run(order.id, new Date().toISOString(), row.id);
      row.provider_order_id = order.id;
    } catch (error) {
      db.prepare(
        `UPDATE payments SET status = 'failed', note = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
      ).run('The payment provider could not start checkout.', new Date().toISOString(), row.id);
      throw error;
    }
  }

  const loaded = loadPayment(db, row.public_id);
  return { registration: null, payment: mapPayment(loaded), checkout: checkoutConfig(loaded) };
}

async function createRazorpayOrder({ amount, currency, receipt }) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let response;
  try {
    response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency, receipt, payment_capture: 1 }),
    });
  } catch {
    throw new HttpError(502, 'PAYMENT_PROVIDER', 'The payment provider could not be reached.');
  }
  if (!response.ok) {
    throw new HttpError(502, 'PAYMENT_PROVIDER', 'The payment provider could not start checkout.');
  }
  return response.json();
}

async function fetchRazorpayPayment(paymentId) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    throw new HttpError(502, 'PAYMENT_PROVIDER', 'The payment provider could not confirm this payment.');
  }
  return response.json();
}

async function refundRazorpayPayment(paymentId) {
  if (!paymentId || !razorpayConfigured()) return false;
  try {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function completePayment(db, paymentDbId, providerPaymentId) {
  let registrationId = null;
  try {
    withTransaction(db, () => {
      const row = db.prepare(
        `SELECT p.*, e.capacity FROM payments p JOIN events e ON e.id = p.event_id WHERE p.id = ?`,
      ).get(paymentDbId);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'That payment could not be found.');
      if (row.status === 'paid' && row.registration_id) {
        registrationId = row.registration_id;
        return;
      }
      if (row.status !== 'pending') {
        throw new HttpError(409, 'PAYMENT_CLOSED', 'This payment is no longer pending.');
      }
      const now = new Date().toISOString();
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare(`UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ?`).run(now, row.id);
        throw new HttpError(409, 'PAYMENT_EXPIRED', 'This checkout expired. Start registration again.');
      }
      const open = row.capacity - occupiedSeats(db, row.event_id) - heldSeats(db, row.event_id, row.id);
      if (row.quantity > open) {
        throw new HttpError(409, 'CAPACITY_REACHED', 'Those seats were taken before payment finished.');
      }
      const duplicate = db.prepare(
        `SELECT id FROM registrations WHERE event_id = ? AND email = ?`,
      ).get(row.event_id, row.email);
      if (duplicate) {
        throw new HttpError(409, 'DUPLICATE_REGISTRATION', 'This email is already registered for this event.');
      }
      registrationId = issueRegistration(db, {
        eventId: row.event_id,
        fullName: row.full_name,
        email: row.email,
        organization: row.organization,
        interests: JSON.parse(row.interests),
        status: 'confirmed',
        quantity: row.quantity,
        ticketLabel: row.ticket_label,
        amountCents: row.amount_cents,
        currency: row.currency,
        now,
      });
      db.prepare(
        `UPDATE payments
         SET status = 'paid', registration_id = ?, provider_payment_id = COALESCE(?, provider_payment_id), updated_at = ?
         WHERE id = ?`,
      ).run(registrationId, providerPaymentId || null, now, row.id);
    });
  } catch (error) {
    const mapped = mapWriteError(error);
    if (mapped.code === 'CAPACITY_REACHED' || mapped.code === 'DUPLICATE_REGISTRATION') {
      db.prepare(
        `UPDATE payments SET status = 'failed', note = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
      ).run(mapped.message, new Date().toISOString(), paymentDbId);
    }
    throw mapped;
  }
  return getRegistrationById(db, registrationId);
}

export async function verifyRazorpayPayment(db, body) {
  if (!razorpayConfigured()) {
    throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Razorpay is not configured.');
  }
  const orderId = String(body?.razorpayOrderId || body?.razorpay_order_id || '');
  const paymentId = String(body?.razorpayPaymentId || body?.razorpay_payment_id || '');
  const signature = String(body?.razorpaySignature || body?.razorpay_signature || '');
  if (!orderId || !paymentId || !signature) {
    throw new HttpError(400, 'PAYMENT_INVALID', 'Payment verification failed.');
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (!safeEqual(expected, signature)) {
    throw new HttpError(400, 'PAYMENT_INVALID', 'Payment verification failed.');
  }
  const row = db.prepare(`SELECT * FROM payments WHERE provider = 'razorpay' AND provider_order_id = ?`).get(orderId);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'That payment could not be found.');
  const remote = await fetchRazorpayPayment(paymentId);
  if (remote.order_id !== orderId || Number(remote.amount) !== Number(row.amount_cents) || remote.currency !== row.currency) {
    throw new HttpError(400, 'PAYMENT_INVALID', 'Payment verification failed.');
  }
  if (!['captured', 'authorized'].includes(remote.status)) {
    throw new HttpError(409, 'PAYMENT_CLOSED', 'The payment provider has not captured this payment.');
  }
  try {
    return completePayment(db, row.id, paymentId);
  } catch (error) {
    if (error.code === 'CAPACITY_REACHED') {
      const refunded = await refundRazorpayPayment(paymentId);
      if (refunded) {
        throw new HttpError(409, 'CAPACITY_REACHED', 'Those seats were taken, and the payment was refunded.');
      }
    }
    throw error;
  }
}

export async function handleRazorpayWebhook(db, rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED', 'Razorpay webhooks are not configured.');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!safeEqual(expected, signature || '')) {
    throw new HttpError(400, 'PAYMENT_INVALID', 'Webhook signature verification failed.');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Webhook body must be valid JSON.');
  }
  if (payload.event !== 'payment.captured' && payload.event !== 'order.paid') {
    return { ok: true, ignored: true };
  }
  const entity = payload.payload?.payment?.entity || {};
  const orderId = entity.order_id || payload.payload?.order?.entity?.id;
  const paymentId = entity.id || null;
  if (!orderId) return { ok: true, ignored: true };
  const row = db.prepare(`SELECT * FROM payments WHERE provider = 'razorpay' AND provider_order_id = ?`).get(orderId);
  if (!row) return { ok: true, ignored: true };
  if (entity.amount != null && Number(entity.amount) !== Number(row.amount_cents)) {
    throw new HttpError(400, 'PAYMENT_INVALID', 'Webhook amount did not match the order.');
  }
  if (row.status === 'paid') return { ok: true, duplicate: true };
  const registration = completePayment(db, row.id, paymentId);
  return { ok: true, ticketCode: registration.ticketCode };
}

export function simulatePayment(db, publicId, outcome) {
  if (!developmentPaymentsAllowed()) {
    throw new HttpError(403, 'FORBIDDEN', 'Payment simulation is disabled in production.');
  }
  const row = loadPayment(db, publicId);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'That payment could not be found.');
  if (row.provider !== 'development') {
    throw new HttpError(409, 'PAYMENT_CLOSED', 'This checkout uses the payment provider, not the development simulator.');
  }
  if (row.status === 'paid' && outcome === 'paid') {
    return { registration: getRegistrationById(db, row.registration_id), payment: mapPayment(row) };
  }
  if (outcome === 'paid') {
    const registration = completePayment(db, row.id, null);
    return { registration, payment: getPayment(db, publicId) };
  }
  if (outcome !== 'failed' && outcome !== 'cancelled') {
    throw new HttpError(400, 'VALIDATION', 'Choose a payment outcome.');
  }
  if (row.status !== 'pending') {
    throw new HttpError(409, 'PAYMENT_CLOSED', 'This payment is no longer pending.');
  }
  const now = new Date().toISOString();
  db.prepare(`UPDATE payments SET status = ?, updated_at = ? WHERE id = ?`).run(outcome, now, row.id);
  return { registration: null, payment: getPayment(db, publicId) };
}

export function cancelPayment(db, publicId) {
  const row = loadPayment(db, publicId);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'That payment could not be found.');
  if (row.status === 'pending') {
    db.prepare(
      `UPDATE payments SET status = 'cancelled', updated_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), row.id);
  }
  return getPayment(db, publicId);
}
