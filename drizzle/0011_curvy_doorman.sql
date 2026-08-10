ALTER TABLE `customers` ADD `password_plaintext` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_library_assets` ADD `preview_url` text DEFAULT '' NOT NULL;