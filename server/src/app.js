import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  adminFromRequest,
  allowedOrigins,
  assertOrigin,
  clearSessionCookie,
  destroySession,
  changeAdminPassword,
  loginAdmin,
  readCookie,
  requireAdmin,
  SESSION_COOKIE,
  sessionCookie,
} from './auth.js';
import { HttpError } from './errors.js';
import {
  checkInByCode,
  createEvent,
  getAdminEvent,
  getHighlights,
  getMetrics,
  getPublicEvent,
  getTicket,
  listEvents,
  listRegistrations,
  registerForEvent,
  registrationsCsv,
  ticketSvg,
  updateEvent,
  updateRegistrationStatus,
  withQr,
} from './services.js';
import { parsePositiveInt } from './validate.js';

const buckets = new Map();

function rateLimit(key, limit, windowMs) {
  if (process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Wait a moment and try again.');
  }
  recent.push(now);
  buckets.set(key, recent);
}

function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'local';
}

export function createApp(db, { clientDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    const allowed = allowedOrigins();
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
      return res.sendStatus(204);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        assertOrigin(req);
      } catch (error) {
        return next(error);
      }
    }
    return next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'eventra' });
  });

  app.get('/api/highlights', (req, res, next) => {
    try {
      res.json(getHighlights(db));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/events', (req, res, next) => {
    try {
      res.json(listEvents(db, req.query));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/events/:id', (req, res, next) => {
    try {
      res.json({ event: getPublicEvent(db, req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/events/:id/registrations', asyncRoute(async (req, res) => {
    rateLimit(`register:${clientIp(req)}`, 30, 15 * 60 * 1000);
    const registration = await withQr(registerForEvent(db, req.params.id, req.body));
    res.status(201).json({ registration });
  }));

  app.post('/api/contact', (req, res, next) => {
    try {
      rateLimit(`contact:${clientIp(req)}`, 8, 15 * 60 * 1000);
      const name = String(req.body?.name ?? '').trim().replace(/\s+/g, ' ');
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const topic = String(req.body?.topic ?? '').trim().replace(/\s+/g, ' ');
      const message = String(req.body?.message ?? '').trim();
      const fields = {};
      if (name.length < 2 || name.length > 120) fields.name = 'Enter your name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';
      if (topic.length < 2 || topic.length > 80) fields.topic = 'Choose a topic.';
      if (message.length < 10 || message.length > 2000) fields.message = 'Write a message of at least 10 characters.';
      if (Object.keys(fields).length) {
        throw new HttpError(400, 'VALIDATION', 'Check the highlighted fields.', fields);
      }
      db.prepare(
        `INSERT INTO messages (name, email, topic, body, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(name, email, topic, message, new Date().toISOString());
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tickets/:code', asyncRoute(async (req, res) => {
    const ticket = await withQr(getTicket(db, req.params.code, { mask: true }));
    res.json({ ticket });
  }));

  app.get('/api/tickets/:code/download', asyncRoute(async (req, res) => {
    const ticket = getTicket(db, req.params.code, { mask: true });
    const svg = await ticketSvg(ticket);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eventra-${ticket.ticketCode}.svg"`);
    res.send(svg);
  }));

  app.post('/api/admin/login', (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '');
      rateLimit(`login:${clientIp(req)}:${email.toLowerCase()}`, 12, 10 * 60 * 1000);
      const session = loginAdmin(db, email, req.body?.password);
      res.setHeader('Set-Cookie', sessionCookie(session.token, session.expires));
      res.json({ admin: session.admin });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/logout', (req, res) => {
    destroySession(db, readCookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(204).end();
  });

  app.get('/api/admin/me', (req, res, next) => {
    try {
      const admin = adminFromRequest(db, req);
      if (!admin) {
        throw new HttpError(401, 'UNAUTHORIZED', 'Sign in as an administrator to continue.');
      }
      res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/login' || req.path === '/logout' || req.path === '/me') return next();
    try {
      req.admin = requireAdmin(db, req);
      return next();
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/admin/password', (req, res, next) => {
    try {
      changeAdminPassword(db, req.admin.id, req.body?.currentPassword, req.body?.nextPassword);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/metrics', (req, res, next) => {
    try {
      res.json(getMetrics(db));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/messages', (req, res, next) => {
    try {
      const messages = db.prepare(
        `SELECT id, name, email, topic, body, created_at AS createdAt
         FROM messages ORDER BY id DESC LIMIT 20`,
      ).all();
      res.json({ messages });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/events', (req, res, next) => {
    try {
      res.json(listEvents(db, req.query, { admin: true }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/events', (req, res, next) => {
    try {
      res.status(201).json({ event: createEvent(db, req.body) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/events/:id', (req, res, next) => {
    try {
      res.json({ event: getAdminEvent(db, req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/events/:id', (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) throw new HttpError(400, 'VALIDATION', 'Event id is invalid.');
      res.json({ event: updateEvent(db, id, req.body) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/registrations.csv', (req, res, next) => {
    try {
      const csv = registrationsCsv(db, req.query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eventra-attendees.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/registrations', (req, res, next) => {
    try {
      res.json(listRegistrations(db, req.query));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/registrations/:id', (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) throw new HttpError(400, 'VALIDATION', 'Registration id is invalid.');
      const registration = updateRegistrationStatus(db, id, req.body?.status);
      res.json({ registration });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/check-in', (req, res, next) => {
    try {
      const registration = checkInByCode(db, req.body?.ticketCode);
      res.json({ registration });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That API route does not exist.' } });
  });

  if (clientDist && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
      return res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        error: { code: 'BAD_JSON', message: 'Request body must be valid JSON.' },
      });
    }
    if (error instanceof HttpError) {
      const payload = { code: error.code, message: error.message };
      if (error.fields) payload.fields = error.fields;
      return res.status(error.status).json({ error: payload });
    }
    console.error(error);
    return res.status(500).json({
      error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
    });
  });

  return app;
}
