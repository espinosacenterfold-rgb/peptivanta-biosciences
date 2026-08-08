CREATE TABLE `media_collection_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`interval_days` integer DEFAULT 3 NOT NULL,
	`keywords_json` text DEFAULT '["多肽包装","实验室产品包装","外贸发货包装","COA检测报告"]' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_collection_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`platform` text DEFAULT 'xiaohongshu' NOT NULL,
	`keyword` text NOT NULL,
	`search_url` text NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_collection_tasks_public_id_unique` ON `media_collection_tasks` (`public_id`);--> statement-breakpoint
CREATE INDEX `media_collection_tasks_status_created_idx` ON `media_collection_tasks` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `feedback_generator_settings` ADD `generation_interval_days` integer DEFAULT 3 NOT NULL;