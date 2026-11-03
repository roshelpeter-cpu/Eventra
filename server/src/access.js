import crypto from 'node:crypto';
import { withTransaction } from './db.js';
import { HttpError } from './errors.js';
import { sendVerificationEmail } from './mail.js';
import { listTicketsForEmail, maskEmail } from './services.js';
import { normalizeEmail } from './validate.js';

const TICKET_PURPOSE = 'ticket_email';
const GRANT_PURPOSE = 'ticket_grant';
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_HOURLY_LIMIT = 5;
const GRANT_TTL_MS = 20 * 60 * 1000;

function validEmail(email) {
  return Boolean(email) && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashSecret(value) {
  const pepper = process.env.OTP_PEPPER || 'eventra-development-pepper';
  return crypto.createHmac('sha256', pepper).update(String(value)).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!validEmail(email)) {
    throw new HttpError(400, 'VALIDATION', 'Enter a valid email address.', {
      email: 'Enter the email used at registration.',
    });
  }
  return email;
}

function latestCode(db, purpose, subject) {
  return db.prepare(
    `SELECT * FROM verification_codes
     WHERE purpose = ? AND subject = ?
     ORDER BY id DESC LIMIT 1`,
  ).get(purpose, subject);
}

function verificationPayload(email, now, expires) {
  return {
    verification: {
      sent: true,
      expiresAt: expires,
      resendAvailableAt: new Date(now + OTP_RESEND_MS).toISOString(),
      maskedEmail: maskEmail(email),
    },
  };
}

export async function requestTicketAccess(db, emailRaw) {
  const email = requireEmail(emailRaw);
  const now = Date.now();
  const recent = latestCode(db, TICKET_PURPOSE, email);
  if (recent && !recent.consumed_at && now - new Date(recent.created_at).getTime() < OTP_RESEND_MS) {
    throw new HttpError(429, 'RATE_LIMITED', 'Wait a minute before requesting another code.');
  }
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const burst = Number(
    db.prepare(
      `SELECT COUNT(*) AS n FROM verification_codes
       WHERE purpose = ? AND subject = ? AND created_at >= ?`,
    ).get(TICKET_PURPOSE, email, hourAgo).n,
  );
  if (burst >= OTP_HOURLY_LIMIT) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many codes were requested. Try again later.');
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await sendVerificationEmail({ to: email, code, kind: 'tickets' });
  const created = new Date(now).toISOString();
  const expires = new Date(now + OTP_TTL_MS).toISOString();
  withTransaction(db, () => {
    db.prepare(
      `UPDATE verification_codes
       SET consumed_at = ?
       WHERE purpose = ? AND subject = ? AND consumed_at IS NULL`,
    ).run(created, TICKET_PURPOSE, email);
    db.prepare(
      `INSERT INTO verification_codes (purpose, subject, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    ).run(TICKET_PURPOSE, email, hashSecret(code), expires, created);
  });
  return verificationPayload(email, now, expires);
}

export function verifyTicketAccess(db, emailRaw, codeRaw) {
  const email = requireEmail(emailRaw);
  const code = String(codeRaw ?? '').replace(/\s+/g, '');
  const generic = new HttpError(400, 'CODE_INVALID', 'That verification code is incorrect.');
  if (!/^\d{6}$/.test(code)) throw generic;
  const saved = latestCode(db, TICKET_PURPOSE, email);
  if (!saved || saved.consumed_at) throw generic;
  if (new Date(saved.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, 'CODE_EXPIRED', 'This verification code has expired. Request a new one.');
  }
  if (Number(saved.attempts) >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(400, 'CODE_INVALID', 'Too many incorrect attempts. Request a new code.');
  }
  if (!safeEqual(saved.code_hash, hashSecret(code))) {
    const attempts = Number(saved.attempts) + 1;
    db.prepare(`UPDATE verification_codes SET attempts = ? WHERE id = ?`).run(attempts, saved.id);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new HttpError(400, 'CODE_INVALID', 'Too many incorrect attempts. Request a new code.');
    }
    throw new HttpError(400, 'CODE_INVALID', 'That verification code is incorrect.', {
      attemptsRemaining: String(OTP_MAX_ATTEMPTS - attempts),
    });
  }
  const now = new Date();
  const created = now.toISOString();
  const token = crypto.randomBytes(32).toString('base64url');
  const grantExpires = new Date(now.getTime() + GRANT_TTL_MS).toISOString();
  withTransaction(db, () => {
    db.prepare(`UPDATE verification_codes SET consumed_at = ? WHERE id = ?`).run(created, saved.id);
    db.prepare(
      `UPDATE verification_codes
       SET consumed_at = ?
       WHERE purpose = ? AND subject = ? AND consumed_at IS NULL`,
    ).run(created, GRANT_PURPOSE, saved.subject);
    db.prepare(
      `INSERT INTO verification_codes (purpose, subject, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    ).run(GRANT_PURPOSE, saved.subject, hashSecret(token), grantExpires, created);
  });
  return {
    accessToken: token,
    expiresAt: grantExpires,
    maskedEmail: maskEmail(saved.subject),
    tickets: listTicketsForEmail(db, saved.subject),
  };
}

export function listVerifiedTickets(db, tokenRaw) {
  const token = String(tokenRaw ?? '').trim();
  const denied = new HttpError(401, 'ACCESS_EXPIRED', 'Verify your email again to view tickets.');
  if (token.length < 20 || token.length > 200) throw denied;
  const saved = db.prepare(
    `SELECT * FROM verification_codes
     WHERE purpose = ? AND code_hash = ? AND consumed_at IS NULL
     ORDER BY id DESC LIMIT 1`,
  ).get(GRANT_PURPOSE, hashSecret(token));
  if (!saved || new Date(saved.expires_at).getTime() < Date.now()) throw denied;
  return listTicketsForEmail(db, saved.subject);
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
