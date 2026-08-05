CREATE TABLE `fulfillment_generator_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`display_limit` integer DEFAULT 300 NOT NULL,
	`daily_minimum` integer DEFAULT 10 NOT NULL,
	`daily_maximum` integer DEFAULT 30 NOT NULL,
	`large_order_rate_bps` integer DEFAULT 1500 NOT NULL,
	`repeat_order_rate_bps` integer DEFAULT 3500 NOT NULL,
	`generation_enabled` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `fulfillment_cases` ADD `items_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_cases` ADD `order_kind` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_cases` ADD `repeat_of_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_cases` ADD `customer_key` text DEFAULT '' NOT NULL;