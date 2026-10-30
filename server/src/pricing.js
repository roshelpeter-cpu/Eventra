import { HttpError } from './errors.js';

export function listTicketTypes(db, eventId) {
  return db.prepare(
    `SELECT id, event_id, name, price_cents, fee_cents, currency, sort_order
     FROM ticket_types
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
  ).all(eventId).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: Number(row.price_cents),
    feeCents: Number(row.fee_cents),
    currency: row.currency || 'INR',
    sortOrder: Number(row.sort_order),
  }));
}

export function heldSeats(db, eventId, exceptPaymentId = null) {
  const now = new Date().toISOString();
  const row = exceptPaymentId == null
    ? db.prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS n
       FROM payments
       WHERE event_id = ? AND status = 'pending' AND expires_at > ?`,
    ).get(eventId, now)
    : db.prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS n
       FROM payments
       WHERE event_id = ? AND status = 'pending' AND expires_at > ? AND id != ?`,
    ).get(eventId, now, exceptPaymentId);
  return Number(row.n);
}

export function quoteForEvent(db, eventRow, ticketTypeId, quantity) {
  const eventId = eventRow.id;
  const types = listTicketTypes(db, eventId);
  let type = null;
  if (ticketTypeId) {
    type = types.find((item) => item.id === Number(ticketTypeId)) || null;
    if (!type) {
      throw new HttpError(400, 'VALIDATION', 'Choose a ticket type.', {
        ticketTypeId: 'Choose a ticket type.',
      });
    }
  } else if (types.length === 1) {
    type = types[0];
  } else if (types.length > 1) {
    throw new HttpError(400, 'VALIDATION', 'Choose a ticket type.', {
      ticketTypeId: 'Choose a ticket type.',
    });
  }

  const unit = type ? type.priceCents : Number(eventRow.price_cents ?? eventRow.priceCents ?? 0);
  const fee = type ? type.feeCents : 0;
  const qty = quantity;
  return {
    ticketTypeId: type ? type.id : null,
    label: type ? type.name : 'General admission',
    quantity: qty,
    unitCents: unit,
    feeCents: fee,
    subtotalCents: unit * qty,
    feesCents: fee * qty,
    totalCents: (unit + fee) * qty,
    currency: type?.currency || eventRow.currency || 'INR',
  };
}

export function replaceTicketTypes(db, eventId, ticketTypes) {
  db.prepare(`DELETE FROM ticket_types WHERE event_id = ?`).run(eventId);
  if (!ticketTypes.length) return;
  const insert = db.prepare(
    `INSERT INTO ticket_types (event_id, name, price_cents, fee_cents, currency, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  ticketTypes.forEach((type, index) => {
    insert.run(eventId, type.name, type.priceCents, type.feeCents, type.currency || 'INR', index);
  });
}

export function startingPriceCents(ticketTypes, fallback = 0) {
  if (!ticketTypes.length) return fallback;
  return Math.min(...ticketTypes.map((type) => type.priceCents));
}
