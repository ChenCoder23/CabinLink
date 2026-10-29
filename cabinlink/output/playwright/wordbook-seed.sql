CREATE TABLE `cabinets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`share_token_hash` text NOT NULL,
	`admin_token_hash` text NOT NULL,
	`quota_bytes` integer NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `cabinets_share_token_hash_unique` ON `cabinets` (`share_token_hash`);
CREATE UNIQUE INDEX `cabinets_admin_token_hash_unique` ON `cabinets` (`admin_token_hash`);
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `files_object_key_unique` ON `files` (`object_key`);
CREATE INDEX `idx_files_theme_id` ON `files` (`theme_id`);
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`cabinet_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_themes_cabinet_id` ON `themes` (`cabinet_id`);
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`cabinet_id` text NOT NULL,
	`theme_id` text NOT NULL,
	`object_key` text NOT NULL,
	`upload_id` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`parts_json` text DEFAULT '[]' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `uploads_object_key_unique` ON `uploads` (`object_key`);
CREATE INDEX `idx_uploads_cabinet_id` ON `uploads` (`cabinet_id`);
CREATE INDEX `idx_uploads_expires_at` ON `uploads` (`expires_at`);

PRAGMA optimize;

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
ALTER TABLE `cabinets` ADD `owner_user_id` text;
CREATE INDEX `idx_cabinets_owner_user_id` ON `cabinets` (`owner_user_id`);
CREATE TABLE `email_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`user_id` text,
	`code_hash` text,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` text NOT NULL,
	`window_started_at` text NOT NULL,
	`sends_in_window` integer DEFAULT 1 NOT NULL
);

CREATE TABLE `login_attempts` (
	`username` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started_at` text NOT NULL
);

PRAGMA foreign_keys=OFF;
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`email` text,
	`password_salt` text,
	`password_hash` text,
	`created_at` text NOT NULL
);

INSERT INTO `__new_users`("id", "username", "email", "password_salt", "password_hash", "created_at") SELECT "id", "username", NULL, "password_salt", "password_hash", "created_at" FROM `users`;
DROP TABLE `users`;
ALTER TABLE `__new_users` RENAME TO `users`;
PRAGMA foreign_keys=ON;
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

CREATE TABLE `cabinet_memberships` (
	`cabinet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`cabinet_id`, `user_id`),
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_cabinet_memberships_user_id` ON `cabinet_memberships` (`user_id`);
CREATE TABLE cabinet_links (
  cabinet_id TEXT PRIMARY KEY NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
  admin_token TEXT NOT NULL,
  admin_token_hash TEXT NOT NULL UNIQUE,
  share_token_hash TEXT NOT NULL UNIQUE
);

CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  desktop_title TEXT NOT NULL,
  mobile_title TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL
);

ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;
ALTER TABLE `users` ADD `banned_at` text;
ALTER TABLE `users` ADD `ban_reason` text;
CREATE TABLE IF NOT EXISTS word_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS word_batches (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES word_categories(id), study_date TEXT NOT NULL, uploaded_at TEXT NOT NULL, uploader_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS word_entries (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES word_batches(id), english TEXT NOT NULL, chinese TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS word_batches_date ON word_batches(category_id, study_date);
CREATE INDEX IF NOT EXISTS word_entries_batch ON word_entries(batch_id);
CREATE TABLE IF NOT EXISTS word_tags (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, color TEXT NOT NULL, UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS word_tag_links (tag_id TEXT NOT NULL REFERENCES word_tags(id) ON DELETE CASCADE, word_id TEXT NOT NULL REFERENCES word_entries(id), PRIMARY KEY(tag_id,word_id));

INSERT INTO users(id,username,role,password_salt,password_hash,created_at) VALUES('wordbook-qa','wordbookqa','admin','qa-salt','0e3e85649b0d442ee0f6fdf8ae535342204e606897bafab8b51a8d039861f6b8','2026-10-12T06:42:47.253Z');