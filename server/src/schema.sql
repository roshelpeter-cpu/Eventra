PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  image_url TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 20000),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'cancelled', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  address TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'INR'
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  interests TEXT NOT NULL CHECK (json_valid(interests)),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled', 'checked_in')),
  ticket_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  checked_in_at TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 20),
  ticket_label TEXT NOT NULL DEFAULT 'General admission',
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  UNIQUE (event_id, email)
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_status_starts ON events (status, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (category);
CREATE INDEX IF NOT EXISTS idx_events_city ON events (city);
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations (event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations (email);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations (created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions (admin_id);

CREATE TABLE IF NOT EXISTS ticket_types (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  event_id INTEGER NOT NULL REFERENCES events(id),
  ticket_type_id INTEGER REFERENCES ticket_types(id),
  ticket_label TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 20),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  interests TEXT NOT NULL CHECK (json_valid(interests)),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'development')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  registration_id INTEGER REFERENCES registrations(id),
  note TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY,
  purpose TEXT NOT NULL,
  subject TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types (event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_payments_event_status ON payments (event_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_email ON payments (event_id, email);
CREATE INDEX IF NOT EXISTS idx_verification_subject ON verification_codes (purpose, subject, created_at);

-- TRIGGERS
DROP TRIGGER IF EXISTS enforce_capacity_insert;
CREATE TRIGGER enforce_capacity_insert
BEFORE INSERT ON registrations
WHEN NEW.status IN ('confirmed', 'checked_in')
BEGIN
  SELECT CASE
    WHEN (
      SELECT COALESCE(SUM(quantity), 0) FROM registrations
      WHERE event_id = NEW.event_id
        AND status IN ('confirmed', 'checked_in')
    ) + COALESCE(NEW.quantity, 1) > (SELECT capacity FROM events WHERE id = NEW.event_id)
    THEN RAISE(ABORT, 'capacity_exceeded')
  END;
END;

DROP TRIGGER IF EXISTS enforce_capacity_update;
CREATE TRIGGER enforce_capacity_update
BEFORE UPDATE OF status ON registrations
WHEN NEW.status IN ('confirmed', 'checked_in')
  AND OLD.status NOT IN ('confirmed', 'checked_in')
BEGIN
  SELECT CASE
    WHEN (
      SELECT COALESCE(SUM(quantity), 0) FROM registrations
      WHERE event_id = NEW.event_id
        AND status IN ('confirmed', 'checked_in')
    ) + COALESCE(NEW.quantity, 1) > (SELECT capacity FROM events WHERE id = NEW.event_id)
    THEN RAISE(ABORT, 'capacity_exceeded')
  END;
END;
