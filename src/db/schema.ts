import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 30 }).notNull().default("customer"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const establishments = pgTable(
  "establishments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    address: text("address").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    openingTime: varchar("opening_time", { length: 5 }).notNull().default("08:00"),
    closingTime: varchar("closing_time", { length: 5 }).notNull().default("18:00"),
    accent: varchar("accent", { length: 20 }).notNull().default("emerald"),
    category: varchar("category", { length: 30 }).notNull().default("medical"),
    state: varchar("state", { length: 40 }),
    ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("establishments_slug_idx").on(table.slug)],
);

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    establishmentId: integer("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull().default(10),
    capacity: integer("capacity").notNull().default(1),
    color: varchar("color", { length: 20 }).notNull().default("emerald"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("services_establishment_idx").on(table.establishmentId)],
);

export const queueTickets = pgTable(
  "queue_tickets",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    ticketNumber: varchar("ticket_number", { length: 20 }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    establishmentId: integer("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("waiting"),
    partySize: integer("party_size").notNull().default(1),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    distanceKm: decimal("distance_km", { precision: 8, scale: 2 }),
    travelMinutes: integer("travel_minutes").notNull().default(0),
    serviceMinutesSnapshot: integer("service_minutes_snapshot").notNull().default(10),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastLat: decimal("last_lat", { precision: 10, scale: 7 }),
    lastLon: decimal("last_lon", { precision: 10, scale: 7 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    requeuedAt: timestamp("requeued_at", { withTimezone: true }),
    needsActionAt: timestamp("needs_action_at", { withTimezone: true }),
    requeueCount: integer("requeue_count").notNull().default(0),
    previousNumber: varchar("previous_number", { length: 20 }),
  },
  (table) => [
    uniqueIndex("queue_tickets_public_idx").on(table.publicId),
    index("queue_tickets_location_status_idx").on(table.establishmentId, table.status),
    index("queue_tickets_service_idx").on(table.serviceId),
  ],
);

export type User = typeof users.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type Service = typeof services.$inferSelect;
export type QueueTicket = typeof queueTickets.$inferSelect;
