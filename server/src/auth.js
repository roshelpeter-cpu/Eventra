import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { HttpError } from './errors.js';
import { normalizeEmail } from './validate.js';

export const SESSION_COOKIE = 'eventra_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function createAdmin(db, { email, password, name, rounds = 10 }) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO admins (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)`,
  ).run(normalizeEmail(email), bcrypt.hashSync(password, rounds), name.trim(), now);
  return Number(info.lastInsertRowid);
}

let dummyHash;
function timingPad() {
  if (!dummyHash) dummyHash = bcrypt.hashSync('eventra-timing-pad', 8);
  return dummyHash;
}

export function loginAdmin(db, email, password) {
  const admin = db.prepare(`SELECT * FROM admins WHERE email = ?`).get(normalizeEmail(email));
  const matches = bcrypt.compareSync(String(password ?? ''), admin?.password_hash || timingPad());
  if (!admin || !matches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MS).toISOString();
  db.prepare(`INSERT INTO sessions (id, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
    token,
    admin.id,
    expires,
    now.toISOString(),
  );
  return {
    token,
    expires,
    admin: { id: admin.id, email: admin.email, name: admin.name },
  };
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(token);
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function adminFromRequest(db, req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = db.prepare(
    `SELECT a.id, a.email, a.name, s.expires_at
     FROM sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ?`,
  ).get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    destroySession(db, token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, token };
}

export function changeAdminPassword(db, adminId, currentPassword, nextPassword) {
  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(adminId);
  const matches = bcrypt.compareSync(String(currentPassword ?? ''), admin?.password_hash || timingPad());
  if (!admin || !matches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }
  const password = String(nextPassword ?? '');
  if (password.length < 10 || password.length > 200) {
    throw new HttpError(400, 'VALIDATION', 'Choose a password of at least 10 characters.', {
      password: 'Use at least 10 characters.',
    });
  }
  db.prepare(`UPDATE admins SET password_hash = ? WHERE id = ?`).run(bcrypt.hashSync(password, 10), admin.id);
}

export function requireAdmin(db, req) {
  const admin = adminFromRequest(db, req);
  if (!admin) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Sign in as an administrator to continue.');
  }
  return admin;
}

export function sessionCookie(token, expires) {
  const maxAge = Math.max(0, Math.floor((new Date(expires).getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function allowedOrigins() {
  return new Set(
    (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function assertOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return;
  const host = `${req.protocol}://${req.get('host')}`;
  if (origin === host || allowedOrigins().has(origin)) return;
  throw new HttpError(403, 'FORBIDDEN', 'This request origin is not allowed.');
}
