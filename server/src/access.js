import crypto from 'node:crypto';
import { HttpError } from './errors.js';
import { listTicketsForEmail } from './services.js';
import { normalizeEmail } from './validate.js';

function pepper() {
  return process.env.OTP_PEPPER || 'eventra-development-pepper';
}

function hashCode(code) {
  return crypto.createHmac('sha256', pepper()).update(code).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function validEmail(email) {
  return Boolean(email) && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function requestTicketCode(db, emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!validEmail(email)) {
    throw new HttpError(400, 'VALIDATION', 'Enter the email used at registration.', {
      email: 'Enter a valid email address.',
    });
  }
  const now = Date.now();
  const recent = db.prepare(
    `SELECT created_at FROM verification_codes
     WHERE purpose = 'ticket_lookup' AND subject = ?
     ORDER BY id DESC LIMIT 1`,
  ).get(email);
  if (recent && now - new Date(recent.created_at).getTime() < 60 * 1000) {
    throw new HttpError(429, 'RATE_LIMITED', 'Wait a minute before requesting another code.');
  }
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const burst = Number(
    db.prepare(
      `SELECT COUNT(*) AS n FROM verification_codes
       WHERE purpose = 'ticket_lookup' AND subject = ? AND created_at >= ?`,
    ).get(email, hourAgo).n,
  );
  if (burst >= 5) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many codes were requested. Try again later.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.OTP_DEV_EXPOSE !== 'true') {
    throw new HttpError(
      503,
      'DELIVERY_UNAVAILABLE',
      'Email delivery is not configured, so a verification code was not created.',
    );
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const created = new Date(now).toISOString();
  const expires = new Date(now + 10 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO verification_codes (purpose, subject, code_hash, expires_at, attempts, created_at)
     VALUES ('ticket_lookup', ?, ?, ?, 0, ?)`,
  ).run(email, hashCode(code), expires, created);
  return {
    delivery: 'development',
    expiresAt: expires,
    code,
    message: 'Development only. This code was not emailed or sent by SMS.',
  };
}

export function verifyTicketCode(db, emailRaw, codeRaw) {
  const email = normalizeEmail(emailRaw);
  const code = String(codeRaw ?? '').replace(/\s+/g, '');
  const generic = new HttpError(400, 'CODE_INVALID', 'That code is not valid. Request a new one if it has expired.');
  if (!validEmail(email) || !/^\d{6}$/.test(code)) throw generic;
  const row = db.prepare(
    `SELECT * FROM verification_codes
     WHERE purpose = 'ticket_lookup' AND subject = ? AND consumed_at IS NULL
     ORDER BY id DESC LIMIT 1`,
  ).get(email);
  if (!row || row.attempts >= 5 || new Date(row.expires_at).getTime() < Date.now()) throw generic;
  if (!safeEqual(row.code_hash, hashCode(code))) {
    db.prepare(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    throw generic;
  }
  db.prepare(`UPDATE verification_codes SET consumed_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);
  const tickets = listTicketsForEmail(db, email).map((ticket) => ({
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    quantity: ticket.quantity,
    ticketLabel: ticket.ticketLabel,
    event: ticket.event,
  }));
  return { tickets };
}

export function subscribeEmail(db, emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!validEmail(email)) {
    throw new HttpError(400, 'VALIDATION', 'Enter a valid email address.', {
      email: 'Enter a valid email address.',
    });
  }
  try {
    db.prepare(`INSERT INTO subscribers (email, created_at) VALUES (?, ?)`).run(email, new Date().toISOString());
  } catch (error) {
    if (!/UNIQUE constraint failed/i.test(error?.message || '')) throw error;
  }
  return { ok: true };
}
