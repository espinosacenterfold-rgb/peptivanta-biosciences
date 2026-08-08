CREATE TABLE `auth_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_order_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`code_hash` text NOT NULL,
	`code_salt` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `manual_fulfillment_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_order_codes_order_id_idx` ON `customer_order_codes` (`order_id`);--> statement-breakpoint
CREATE INDEX `customer_order_codes_expires_at_idx` ON `customer_order_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `customer_order_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `manual_fulfillment_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_order_links_order_id_idx` ON `customer_order_links` (`order_id`);--> statement-breakpoint
CREATE INDEX `customer_order_links_customer_id_idx` ON `customer_order_links` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customer_profile_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`actor` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_profile_events_customer_id_idx` ON `customer_profile_events` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_sessions_token_hash_unique` ON `customer_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `customer_sessions_customer_id_idx` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_sessions_expires_at_idx` ON `customer_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`recovery_salt` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'active_unlinked' NOT NULL,
	`profile_version` integer DEFAULT 1 NOT NULL,
	`privacy_consent_at` text NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_public_id_unique` ON `customers` (`public_id`);--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_username_normalized_idx` ON `customers` (`username_normalized`);--> statement-breakpoint
CREATE TABLE `feedback_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`source_type` text NOT NULL,
	`manual_order_id` integer,
	`sample_case_id` integer,
	`customer_id` integer,
	`media_asset_id` integer,
	`country_code` text DEFAULT '' NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`order_kind` text DEFAULT 'new' NOT NULL,
	`order_snapshot_json` text DEFAULT '{}' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`content_json` text DEFAULT '{}' NOT NULL,
	`original_text` text DEFAULT '' NOT NULL,
	`public_text` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`risk_flags_json` text DEFAULT '[]' NOT NULL,
	`template_version` text DEFAULT '' NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`published_at` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`manual_order_id`) REFERENCES `manual_fulfillment_orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sample_case_id`) REFERENCES `fulfillment_cases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_library_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_entries_public_id_unique` ON `feedback_entries` (`public_id`);--> statement-breakpoint
CREATE INDEX `feedback_entries_status_published_idx` ON `feedback_entries` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `feedback_entries_source_submitted_idx` ON `feedback_entries` (`source_type`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `feedback_entries_expires_at_idx` ON `feedback_entries` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_entries_manual_order_idx` ON `feedback_entries` (`manual_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_entries_sample_case_idx` ON `feedback_entries` (`sample_case_id`);--> statement-breakpoint
CREATE TABLE `feedback_generator_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_generator_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`generation_enabled` integer DEFAULT true NOT NULL,
	`daily_maximum` integer DEFAULT 1 NOT NULL,
	`generation_rate_bps` integer DEFAULT 3500 NOT NULL,
	`public_limit` integer DEFAULT 48 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_moderation_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedback_id` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_actions_feedback_id_idx` ON `feedback_moderation_actions` (`feedback_id`);--> statement-breakpoint
CREATE TABLE `media_library_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_platform` text DEFAULT 'manual' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_title` text DEFAULT '' NOT NULL,
	`source_author` text DEFAULT '' NOT NULL,
	`rights_basis` text DEFAULT 'owned_or_authorized' NOT NULL,
	`rights_confirmed_at` text NOT NULL,
	`original_filename` text DEFAULT '' NOT NULL,
	`r2_key` text DEFAULT '' NOT NULL,
	`mime_type` text DEFAULT '' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`available_from` text NOT NULL,
	`expires_at` text NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_library_assets_public_id_unique` ON `media_library_assets` (`public_id`);--> statement-breakpoint
CREATE INDEX `media_library_assets_status_available_idx` ON `media_library_assets` (`status`,`available_from`);--> statement-breakpoint
CREATE INDEX `media_library_assets_expires_at_idx` ON `media_library_assets` (`expires_at`);