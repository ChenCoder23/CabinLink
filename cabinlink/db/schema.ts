import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cabinets = sqliteTable("cabinets", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  shareTokenHash: text("share_token_hash").notNull().unique(), adminTokenHash: text("admin_token_hash").notNull().unique(),
  quotaBytes: integer("quota_bytes").notNull(), ownerUserId: text("owner_user_id"), closedAt: text("closed_at"), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_cabinets_owner_user_id").on(table.ownerUserId)]);
export const cabinetLinks = sqliteTable("cabinet_links", {
  cabinetId: text("cabinet_id").primaryKey().references(() => cabinets.id, { onDelete: "cascade" }),
  adminToken: text("admin_token").notNull(),
  adminTokenHash: text("admin_token_hash").notNull().unique(),
  shareTokenHash: text("share_token_hash").notNull().unique(),
});
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), username: text("username").unique(), email: text("email").unique(),
  avatarUrl: text("avatar_url").notNull().default(""), role: text("role").notNull().default("user"), bannedAt: text("banned_at"), banReason: text("ban_reason"),
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
  uploaderUserId: text("uploader_user_id").references(()=>users.id), sizeBytes: integer("size_bytes").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_files_theme_id").on(table.themeId)]);
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(), cabinetId: text("cabinet_id").notNull().references(() => cabinets.id, { onDelete: "cascade" }),
  themeId: text("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }), objectKey: text("object_key").notNull().unique(),
  uploadId: text("upload_id").notNull(), originalName: text("original_name").notNull(), contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(), completing: integer("completing").notNull().default(0), partsJson: text("parts_json").notNull().default("[]"), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("idx_uploads_cabinet_id").on(table.cabinetId), index("idx_uploads_expires_at").on(table.expiresAt)]);

export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), targetId: text("target_id").notNull(), action: text("action").notNull(), detail: text("detail"), createdAt: text("created_at").notNull(),
});

export const wordCategories = sqliteTable("word_categories", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(), createdAt: text("created_at").notNull(),
});
export const wordBatches = sqliteTable("word_batches", {
  id: text("id").primaryKey(), categoryId: text("category_id").notNull().references(() => wordCategories.id),
  studyDate: text("study_date").notNull(), uploadedAt: text("uploaded_at").notNull(), uploaderId: text("uploader_id").notNull().references(() => users.id),
}, table => [index("word_batches_date").on(table.categoryId,table.studyDate)]);
export const wordEntries = sqliteTable("word_entries", {
  id: text("id").primaryKey(), batchId: text("batch_id").notNull().references(() => wordBatches.id), english: text("english").notNull(), chinese: text("chinese").notNull(),
}, table => [index("word_entries_batch").on(table.batchId)]);
export const wordTags = sqliteTable("word_tags", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), name: text("name").notNull(), color: text("color").notNull(),
}, table => [uniqueIndex("word_tags_user_name").on(table.userId,table.name)]);
export const wordTagLinks = sqliteTable("word_tag_links", {
  tagId: text("tag_id").notNull().references(() => wordTags.id,{onDelete:"cascade"}), wordId: text("word_id").notNull().references(() => wordEntries.id),
}, table => [primaryKey({columns:[table.tagId,table.wordId]})]);

export const workbenchOwner=sqliteTable("workbench_owner",{id:integer("id").primaryKey(),userId:text("user_id").notNull().unique().references(()=>users.id)});
export const workbenchProfile=sqliteTable("workbench_profile",{userId:text("user_id").primaryKey().references(()=>users.id),introduction:text("introduction").notNull().default("")});
export const workbenchTasks=sqliteTable("workbench_tasks",{id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>users.id),kind:text("kind").notNull(),title:text("title").notNull(),description:text("description").notNull().default(""),dueDate:text("due_date").notNull().default(""),criteria:text("criteria").notNull().default(""),progress:integer("progress").notNull().default(0),sortOrder:integer("sort_order").notNull().default(0),focus:integer("focus").notNull().default(0),poster:text("poster").notNull().default(""),celebration:integer("celebration").notNull().default(0),seen:integer("seen").notNull().default(0)},t=>[index("workbench_tasks_user").on(t.userId)]);
export const wordLibraries=sqliteTable("word_libraries",{id:text("id").primaryKey(),categoryId:text("category_id").notNull().references(()=>wordCategories.id),uploaderId:text("uploader_id").notNull().references(()=>users.id),name:text("name").notNull(),status:text("status").notNull().default("importing"),total:integer("total").notNull().default(0),imported:integer("imported").notNull().default(0),error:text("error").notNull().default(""),createdAt:text("created_at").notNull()});
export const wordLibraryEntries=sqliteTable("word_library_entries",{libraryId:text("library_id").notNull().references(()=>wordLibraries.id),position:integer("position").notNull(),english:text("english").notNull(),chinese:text("chinese").notNull()},t=>[primaryKey({columns:[t.libraryId,t.position]})]);
export const wordSchedules=sqliteTable("word_schedules",{id:text("id").primaryKey(),libraryId:text("library_id").notNull().unique().references(()=>wordLibraries.id),startDate:text("start_date").notNull(),publishTime:text("publish_time").notNull(),dailyCount:integer("daily_count").notNull(),status:text("status").notNull().default("active"),createdAt:text("created_at").notNull()});
export const wordScheduleRuns=sqliteTable("word_schedule_runs",{id:text("id").primaryKey(),scheduleId:text("schedule_id").notNull().references(()=>wordSchedules.id),studyDate:text("study_date").notNull(),batchId:text("batch_id").notNull(),count:integer("count").notNull(),createdAt:text("created_at").notNull()},t=>[uniqueIndex("word_schedule_runs_schedule_date").on(t.scheduleId,t.studyDate)]);
