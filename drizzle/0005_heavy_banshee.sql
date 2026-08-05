CREATE TABLE `manual_fulfillment_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`sku` text NOT NULL,
	`product_name` text NOT NULL,
	`specification` text NOT NULL,
	`quantity_units` integer NOT NULL,
	`retail_unit_price_usd_cents` integer NOT NULL,
	`discounted_unit_price_usd_cents` integer NOT NULL,
	`line_amount_usd_cents` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `manual_fulfillment_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `manual_fulfillment_order_items_order_id_idx` ON `manual_fulfillment_order_items` (`order_id`);