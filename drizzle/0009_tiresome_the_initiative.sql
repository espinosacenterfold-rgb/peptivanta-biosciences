CREATE TABLE `media_cleanup_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_public_id` text DEFAULT '' NOT NULL,
	`source_title` text DEFAULT '' NOT NULL,
	`r2_key` text DEFAULT '' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_cleanup_events_created_at_idx` ON `media_cleanup_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `media_storage_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`hard_limit_bytes` integer DEFAULT 10000000000 NOT NULL,
	`cleanup_target_bytes` integer DEFAULT 9500000000 NOT NULL,
	`retention_days` integer DEFAULT 180 NOT NULL,
	`protect_customer_media` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `media_storage_settings` (
	`id`, `hard_limit_bytes`, `cleanup_target_bytes`, `retention_days`,
	`protect_customer_media`
) VALUES (1, 10000000000, 9500000000, 180, 1)
ON CONFLICT(`id`) DO NOTHING;
