CREATE TABLE `cabinets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`share_token_hash` text NOT NULL,
	`admin_token_hash` text NOT NULL,
	`quota_bytes` integer NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cabinets_share_token_hash_unique` ON `cabinets` (`share_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `cabinets_admin_token_hash_unique` ON `cabinets` (`admin_token_hash`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX `files_object_key_unique` ON `files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_files_theme_id` ON `files` (`theme_id`);--> statement-breakpoint
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`cabinet_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_themes_cabinet_id` ON `themes` (`cabinet_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_object_key_unique` ON `uploads` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_uploads_cabinet_id` ON `uploads` (`cabinet_id`);--> statement-breakpoint
CREATE INDEX `idx_uploads_expires_at` ON `uploads` (`expires_at`);
--> statement-breakpoint
PRAGMA optimize;
