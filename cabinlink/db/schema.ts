import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cabinets = sqliteTable("cabinets", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  shareTokenHash: text("share_token_hash").notNull().unique(), adminTokenHash: text("admin_token_hash").notNull().unique(),
  quotaBytes: integer("quota_bytes").notNull(), ownerUserId: text("owner_user_id"), closedAt: text("closed_at"), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_cabinets_owner_user_id").on(table.ownerUserId)]);
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), username: text("username").unique(), email: text("email").unique(),
  passwordSalt: text("password_salt"), passwordHash: text("password_hash"), createdAt: text("created_at").notNull(),
});
export const cabinetMemberships = sqliteTable("cabinet_memberships", {
  cabinetId: text("cabinet_id").notNull().references(() => cabinets.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull(),
}, (table) => [primaryKey({ columns: [table.cabinetId, table.userId] }), index("idx_cabinet_memberships_user_id").on(table.userId)]);
export const emailCodes = sqliteTable("email_codes", {
  email: text("email").primaryKey(), purpose: text("purpose").notNull(), userId: text("user_id"),
  codeHash: text("code_hash"), expiresAt: text("expires_at").notNull(), attempts: integer("attempts").notNull().default(0),
  sentAt: text("sent_at").notNull(), windowStartedAt: text("window_started_at").notNull(), sendsInWindow: integer("sends_in_window").notNull().default(1),
});
export const loginAttempts = sqliteTable("login_attempts", {
  username: text("username").primaryKey(), attempts: integer("attempts").notNull(), windowStartedAt: text("window_started_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_sessions_user_id").on(table.userId), index("idx_sessions_expires_at").on(table.expiresAt)]);
export const themes = sqliteTable("themes", {
  id: text("id").primaryKey(), cabinetId: text("cabinet_id").notNull().references(() => cabinets.id, { onDelete: "cascade" }),
  name: text("name").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_themes_cabinet_id").on(table.cabinetId)]);
export const files = sqliteTable("files", {
  id: text("id").primaryKey(), themeId: text("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(), originalName: text("original_name").notNull(), contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_files_theme_id").on(table.themeId)]);
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(), cabinetId: text("cabinet_id").notNull().references(() => cabinets.id, { onDelete: "cascade" }),
  themeId: text("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }), objectKey: text("object_key").notNull().unique(),
  uploadId: text("upload_id").notNull(), originalName: text("original_name").notNull(), contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(), partsJson: text("parts_json").notNull().default("[]"), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_uploads_cabinet_id").on(table.cabinetId), index("idx_uploads_expires_at").on(table.expiresAt)]);
