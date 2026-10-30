import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// 1. Enums
// ============================================================================

export const userRoleEnum = pgEnum("user_role", [
  "REPORTER",
  "OPERATOR",
  "TECHNICIAN",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "ACTIVE",
  "INACTIVE",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const locationSourceEnum = pgEnum("location_source", ["GPS", "MANUAL"]);

export const photoTypeEnum = pgEnum("photo_type", [
  "REPORT_INITIAL",
  "STATUS_UPDATE",
  "SOFT_DELETE",
]);

// ============================================================================
// 2. Better-Auth & User Tables (Relational)
// ============================================================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Better-Auth username plugin fields (mapped to NIP)
    username: text("username").unique(),
    displayUsername: text("display_username"),
    // Custom Airport Perimeter fields
    nip: text("nip").notNull().unique(),
    role: userRoleEnum("role").notNull().default("REPORTER"),
    phone: text("phone"),
    unit: text("unit").notNull().default("Operasional Bandara"),
    status: accountStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_nip_idx").on(table.nip),
    index("user_role_idx").on(table.role),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// 3. Master Data Catalog Tables (Relational)
// ============================================================================

export const perimeterParts = pgTable("perimeter_parts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const damageTypes = pgTable(
  "damage_types",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => perimeterParts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    exclusiveGroup: text("exclusive_group"), // e.g., "rust_severity" for Berkarat sedang vs berat
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("damage_types_part_id_idx").on(table.partId)]
);

// ============================================================================
// 4. Hybrid Reports & Audit Tables (PostgreSQL Relational + JSONB NoSQL)
// ============================================================================

export interface ReportFindingSnapshot {
  partId: string;
  partName: string;
  damages: Array<{
    id: string;
    name: string;
    exclusiveGroup?: string | null;
  }>;
}

export interface ReportGpsMetadata {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt?: string;
}

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    side: text("side"),
    segmentCode: text("segment_code"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    locationSource: locationSourceEnum("location_source")
      .notNull()
      .default("MANUAL"),
    // NoSQL JSONB column for flexible nested findings snapshot
    findings: jsonb("findings")
      .$type<ReportFindingSnapshot[]>()
      .notNull()
      .default([]),
    // NoSQL JSONB column for raw GPS device telemetry
    gpsMetadata: jsonb("gps_metadata").$type<ReportGpsMetadata | null>(),
    narrative: text("narrative").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    deletionReason: text("deletion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reports_reporter_id_idx").on(table.reporterId),
    index("reports_status_idx").on(table.status),
    index("reports_created_at_idx").on(table.createdAt),
    index("reports_findings_gin_idx").using("gin", table.findings),
  ]
);

export const reportStatusHistory = pgTable(
  "report_status_history",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    previousStatus: reportStatusEnum("previous_status"),
    newStatus: reportStatusEnum("new_status").notNull(),
    narrative: text("narrative").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("report_status_history_report_id_idx").on(table.reportId)]
);

export const reportPhotos = pgTable(
  "report_photos",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    historyId: text("history_id").references(() => reportStatusHistory.id, {
      onDelete: "cascade",
    }),
    photoType: photoTypeEnum("photo_type").notNull().default("REPORT_INITIAL"),
    filePath: text("file_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    exifOrMeta: jsonb("exif_or_meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("report_photos_report_id_idx").on(table.reportId),
    index("report_photos_history_id_idx").on(table.historyId),
  ]
);

// ============================================================================
// 5. Drizzle Relations
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  reporter: one(user, {
    fields: [reports.reporterId],
    references: [user.id],
  }),
  history: many(reportStatusHistory),
  photos: many(reportPhotos),
}));
