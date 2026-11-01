PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`side_a` text NOT NULL,
	`side_b` text NOT NULL,
	`categories` text,
	`statuses` text DEFAULT '["new","easy","hard"]' NOT NULL,
	`continuous` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_templates`("id", "name", "side_a", "side_b", "categories", "statuses", "created_at", "updated_at") SELECT "id", "name", "side_a", "side_b", "categories", "statuses", "created_at", "updated_at" FROM `templates`;--> statement-breakpoint
DROP TABLE `templates`;--> statement-breakpoint
ALTER TABLE `__new_templates` RENAME TO `templates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `templates_name_unique` ON `templates` (`name`);