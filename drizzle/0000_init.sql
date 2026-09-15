CREATE TABLE `member_avatars` (
	`member_id` char(26) NOT NULL,
	`hash` char(64),
	`image` mediumblob,
	`external_url` varchar(2048),
	`source_hash` char(64),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `member_avatars_member_id` PRIMARY KEY(`member_id`)
);
--> statement-breakpoint
CREATE TABLE `member_profiles` (
	`member_id` char(26) NOT NULL,
	`email` varchar(254),
	`personal_phone` varchar(40),
	`business_phone` varchar(40),
	`whatsapp` varchar(40),
	`legacy_phone` varchar(40),
	`facebook` varchar(1024),
	`instagram` varchar(1024),
	`github` varchar(1024),
	`portfolio` varchar(1024),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `member_profiles_member_id` PRIMARY KEY(`member_id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` char(26) NOT NULL,
	`username` varchar(64) NOT NULL,
	`hr_employee_id` varchar(64),
	`name` varchar(191),
	`job_role` varchar(191),
	`designation` varchar(191),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`source` enum('hr','manual') NOT NULL,
	`hr_missing_since` datetime(3),
	`profile_claimed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `members_id` PRIMARY KEY(`id`),
	CONSTRAINT `members_username_unique` UNIQUE(`username`),
	CONSTRAINT `members_hr_employee_id_unique` UNIQUE(`hr_employee_id`)
);
--> statement-breakpoint
CREATE TABLE `username_aliases` (
	`alias` varchar(64) NOT NULL,
	`member_id` char(26) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `username_aliases_alias` PRIMARY KEY(`alias`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`status` enum('running','applied','skipped','aborted','failed') NOT NULL,
	`source_hashes` json,
	`summary` json,
	`conflicts` json,
	`error` varchar(1024),
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	CONSTRAINT `sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `member_avatars` ADD CONSTRAINT `member_avatars_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_profiles` ADD CONSTRAINT `member_profiles_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `username_aliases` ADD CONSTRAINT `username_aliases_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sync_runs_started_at_idx` ON `sync_runs` (`started_at`);