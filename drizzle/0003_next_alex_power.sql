CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
DROP INDEX `cards_deck_match_unique`;--> statement-breakpoint
ALTER TABLE `cards` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_user_deck_match_unique` ON `cards` (`user_id`,`deck_id`,`match_key`);--> statement-breakpoint
DROP INDEX `decks_name_unique`;--> statement-breakpoint
ALTER TABLE `decks` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `decks_user_name_unique` ON `decks` (`user_id`,`name`);--> statement-breakpoint
DROP INDEX `templates_name_unique`;--> statement-breakpoint
ALTER TABLE `templates` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `templates_user_name_unique` ON `templates` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `session_state` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `session_state_user_unique` ON `session_state` (`user_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_unique` ON `settings` (`user_id`);
