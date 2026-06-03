CREATE TABLE `checkin_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dayNumber` int NOT NULL,
	`reward` decimal(18,2) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkin_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`couponId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupon_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('fixed','percent','chips') NOT NULL DEFAULT 'fixed',
	`amount` decimal(18,2) NOT NULL,
	`maxBonus` decimal(18,2),
	`minDeposit` decimal(18,2),
	`maxUses` int NOT NULL DEFAULT 0,
	`usedCount` int NOT NULL DEFAULT 0,
	`maxPerUser` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp,
	`status` enum('active','paused','expired') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `first_deposit_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`depositAmount` decimal(18,2) NOT NULL,
	`bonusAmount` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `first_deposit_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `first_deposit_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bonusPercent` int NOT NULL DEFAULT 100,
	`maxBonus` decimal(18,2) NOT NULL DEFAULT '50.00',
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `first_deposit_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_reward_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviterReward` decimal(18,2) NOT NULL DEFAULT '5.00',
	`inviteeReward` decimal(18,2) NOT NULL DEFAULT '3.00',
	`maxRewardsPerUser` int NOT NULL DEFAULT 0,
	`requireDeposit` boolean NOT NULL DEFAULT false,
	`minDepositAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invite_reward_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviterId` int NOT NULL,
	`inviteeId` int NOT NULL,
	`inviterAmount` decimal(18,2) NOT NULL,
	`inviteeAmount` decimal(18,2) NOT NULL,
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `invite_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`buttons` json,
	`targetType` enum('all','active','deposited','custom') NOT NULL DEFAULT 'all',
	`targetUserIds` json,
	`scheduledAt` timestamp NOT NULL,
	`repeatType` enum('once','daily','weekly') NOT NULL DEFAULT 'once',
	`status` enum('pending','sent','cancelled','failed') NOT NULL DEFAULT 'pending',
	`sentCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `scheduled_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_limited_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`type` enum('double_points','no_rake','deposit_bonus','free_chips','custom') NOT NULL DEFAULT 'custom',
	`description` text,
	`config` json,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('upcoming','active','ended','cancelled') NOT NULL DEFAULT 'upcoming',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_limited_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkinDate` varchar(10) NOT NULL,
	`dayNumber` int NOT NULL,
	`reward` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_checkins_id` PRIMARY KEY(`id`)
);
