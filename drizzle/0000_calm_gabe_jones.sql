CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`term_eng` text NOT NULL,
	`term_esp` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`total_success` integer DEFAULT 0 NOT NULL,
	`total_fail` integer DEFAULT 0 NOT NULL,
	`match_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_match_key_unique` ON `cards` (`match_key`);--> statement-breakpoint
CREATE INDEX `cards_category_idx` ON `cards` (`category`);--> statement-breakpoint
CREATE INDEX `cards_status_idx` ON `cards` (`status`);--> statement-breakpoint
CREATE INDEX `cards_hidden_idx` ON `cards` (`hidden`);--> statement-breakpoint
CREATE TABLE `session_state` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`language` text DEFAULT 'es' NOT NULL,
	`last_template_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`last_template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`side_a` text NOT NULL,
	`side_b` text NOT NULL,
	`categories` text,
	`statuses` text DEFAULT '["new","learning","learned"]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_name_unique` ON `templates` (`name`);