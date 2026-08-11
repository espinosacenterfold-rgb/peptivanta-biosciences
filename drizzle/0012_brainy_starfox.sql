ALTER TABLE `media_collection_settings` ADD `auto_import_limit` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `provider` text DEFAULT 'jina' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `result_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `asset_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `error_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `started_at` text;--> statement-breakpoint
ALTER TABLE `media_collection_tasks` ADD `finished_at` text;
