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
  details TEXT NOT NULL DEFAULT '{}'
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

CREATE TRIGGER IF NOT EXISTS enforce_capacity_insert
BEFORE INSERT ON registrations
WHEN NEW.status IN ('confirmed', 'checked_in')
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*) FROM registrations
      WHERE event_id = NEW.event_id
        AND status IN ('confirmed', 'checked_in')
    ) >= (SELECT capacity FROM events WHERE id = NEW.event_id)
    THEN RAISE(ABORT, 'capacity_exceeded')
  END;
END;

CREATE TRIGGER IF NOT EXISTS enforce_capacity_update
BEFORE UPDATE OF status ON registrations
WHEN NEW.status IN ('confirmed', 'checked_in')
  AND OLD.status NOT IN ('confirmed', 'checked_in')
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*) FROM registrations
      WHERE event_id = NEW.event_id
        AND status IN ('confirmed', 'checked_in')
    ) >= (SELECT capacity FROM events WHERE id = NEW.event_id)
    THEN RAISE(ABORT, 'capacity_exceeded')
  END;
END;
