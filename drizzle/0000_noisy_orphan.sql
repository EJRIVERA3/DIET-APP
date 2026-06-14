CREATE TABLE `daily_logs` (
	`user_key` text NOT NULL,
	`day_date` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_key`, `day_date`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_key` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
