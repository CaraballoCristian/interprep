PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decks_name_unique` ON `decks` (`name`);--> statement-breakpoint
INSERT INTO `decks` (`id`, `name`, `created_at`, `updated_at`) VALUES ('deck-general', 'General', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
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
	`updated_at` text NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cards`("id", "deck_id", "category", "term_eng", "term_esp", "description", "status", "hidden", "history", "total_success", "total_fail", "match_key", "created_at", "updated_at") SELECT "id", 'deck-general', "category", "term_eng", "term_esp", "description", "status", "hidden", "history", "total_success", "total_fail", "match_key", "created_at", "updated_at" FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_deck_match_unique` ON `cards` (`deck_id`,`match_key`);--> statement-breakpoint
CREATE INDEX `cards_deck_idx` ON `cards` (`deck_id`);--> statement-breakpoint
CREATE INDEX `cards_category_idx` ON `cards` (`category`);--> statement-breakpoint
CREATE INDEX `cards_status_idx` ON `cards` (`status`);--> statement-breakpoint
CREATE INDEX `cards_hidden_idx` ON `cards` (`hidden`);--> statement-breakpoint
ALTER TABLE `templates` ADD `deck_ids` text;--> statement-breakpoint
PRAGMA foreign_keys=ON;
