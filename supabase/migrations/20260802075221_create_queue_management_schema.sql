/*
# Create Quantum Leap queue management schema

1. New Tables
- `users` — app users (customers, business owners, admins) with email/password auth
- `sessions` — session tokens for authenticated users
- `establishments` — business locations (hospitals, clinics, banks, etc.)
- `services` — queue services offered by each establishment
- `queue_tickets` — individual queue entries with live status tracking

2. Security
- RLS enabled on all tables.
- This app uses Drizzle ORM with a direct PostgreSQL connection (service-level access),
  so RLS policies are permissive (anon+authenticated) — the app enforces auth in Next.js
  server routes, not through Supabase client SDK policies.

3. Important Notes
- All tables use serial/integer primary keys to match the existing Drizzle schema.
- Timestamps are timestamptz with defaults.
- Indexes added for frequently queried columns.
*/

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(180) NOT NULL,
  password_hash text NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'customer',
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash varchar(64) PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS establishments (
  id serial PRIMARY KEY,
  name varchar(160) NOT NULL,
  slug varchar(180) NOT NULL,
  address text NOT NULL,
  latitude decimal(10,7) NOT NULL,
  longitude decimal(10,7) NOT NULL,
  phone varchar(40),
  status varchar(20) NOT NULL DEFAULT 'open',
  opening_time varchar(5) NOT NULL DEFAULT '08:00',
  closing_time varchar(5) NOT NULL DEFAULT '18:00',
  accent varchar(20) NOT NULL DEFAULT 'emerald',
  category varchar(30) NOT NULL DEFAULT 'medical',
  state varchar(40),
  owner_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS establishments_slug_idx ON establishments(slug);

CREATE TABLE IF NOT EXISTS services (
  id serial PRIMARY KEY,
  establishment_id integer NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 10,
  capacity integer NOT NULL DEFAULT 1,
  color varchar(20) NOT NULL DEFAULT 'emerald',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS services_establishment_idx ON services(establishment_id);

CREATE TABLE IF NOT EXISTS queue_tickets (
  id serial PRIMARY KEY,
  public_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_number varchar(20) NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  customer_name varchar(120) NOT NULL,
  phone varchar(40),
  establishment_id integer NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  service_id integer NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'waiting',
  party_size integer NOT NULL DEFAULT 1,
  latitude decimal(10,7),
  longitude decimal(10,7),
  distance_km decimal(8,2),
  travel_minutes integer NOT NULL DEFAULT 0,
  service_minutes_snapshot integer NOT NULL DEFAULT 10,
  joined_at timestamptz DEFAULT now() NOT NULL,
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_lat decimal(10,7),
  last_lon decimal(10,7),
  last_seen_at timestamptz,
  requeued_at timestamptz,
  needs_action_at timestamptz,
  requeue_count integer NOT NULL DEFAULT 0,
  previous_number varchar(20)
);

CREATE UNIQUE INDEX IF NOT EXISTS queue_tickets_public_idx ON queue_tickets(public_id);
CREATE INDEX IF NOT EXISTS queue_tickets_location_status_idx ON queue_tickets(establishment_id, status);
CREATE INDEX IF NOT EXISTS queue_tickets_service_idx ON queue_tickets(service_id);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;

-- Permissive policies: the app uses Drizzle ORM with a direct PostgreSQL connection
-- and enforces auth in Next.js server routes. These policies allow access via the
-- Supabase client SDK as well (anon+authenticated).
DROP POLICY IF EXISTS "anon_all_users" ON users;
CREATE POLICY "anon_all_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_all_sessions" ON sessions;
CREATE POLICY "anon_all_sessions" ON sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_all_establishments" ON establishments;
CREATE POLICY "anon_all_establishments" ON establishments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_all_services" ON services;
CREATE POLICY "anon_all_services" ON services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_all_tickets" ON queue_tickets;
CREATE POLICY "anon_all_tickets" ON queue_tickets FOR SELECT TO anon, authenticated USING (true);

-- Insert/update/delete policies for app operations
DROP POLICY IF EXISTS "anon_modify_users" ON users;
CREATE POLICY "anon_modify_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_modify_sessions" ON sessions;
CREATE POLICY "anon_modify_sessions" ON sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_modify_establishments" ON establishments;
CREATE POLICY "anon_modify_establishments" ON establishments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_establishments" ON establishments;
CREATE POLICY "anon_update_establishments" ON establishments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_establishments" ON establishments;
CREATE POLICY "anon_delete_establishments" ON establishments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_modify_services" ON services;
CREATE POLICY "anon_modify_services" ON services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tickets" ON queue_tickets;
CREATE POLICY "anon_insert_tickets" ON queue_tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tickets" ON queue_tickets;
CREATE POLICY "anon_update_tickets" ON queue_tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tickets" ON queue_tickets;
CREATE POLICY "anon_delete_tickets" ON queue_tickets FOR DELETE TO anon, authenticated USING (true);
