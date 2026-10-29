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
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`username` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`email` text,
	`password_salt` text,
	`password_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "email", "password_salt", "password_hash", "created_at") SELECT "id", "username", NULL, "password_salt", "password_hash", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
