ALTER TABLE `fulfillment_generator_settings` ADD `multi_product_rate_bps` integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `bulk_gap_days` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `repeat_minimum_days` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `repeat_maximum_days` integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `market_us_weight` integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `market_ca_weight` integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `market_br_weight` integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfillment_generator_settings` ADD `market_mx_weight` integer DEFAULT 10 NOT NULL;