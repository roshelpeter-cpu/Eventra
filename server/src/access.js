import { HttpError } from './errors.js';
import { getTicket, maskEmail } from './services.js';
import { normalizeEmail } from './validate.js';

function validEmail(email) {
  return Boolean(email) && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function findTicket(db, emailRaw, codeRaw) {
  const email = normalizeEmail(emailRaw);
  const code = String(codeRaw ?? '').trim();
  const fields = {};
  if (!validEmail(email)) fields.email = 'Enter the email used at registration.';
  if (code.length < 4 || code.length > 40) fields.ticketCode = 'Enter your ticket reference.';
  if (Object.keys(fields).length) {
    throw new HttpError(400, 'VALIDATION', 'Check the highlighted fields.', fields);
  }
  let ticket;
  try {
    ticket = getTicket(db, code, { mask: false });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new HttpError(404, 'NOT_FOUND', 'No ticket matches those details.');
    }
    throw error;
  }
  if (normalizeEmail(ticket.email) !== email) {
    throw new HttpError(404, 'NOT_FOUND', 'No ticket matches those details.');
  }
  return { ...ticket, email: maskEmail(ticket.email) };
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
