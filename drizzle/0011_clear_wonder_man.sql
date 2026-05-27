CREATE TABLE `auto_reply_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(256) NOT NULL,
	`matchType` enum('exact','contains','regex') NOT NULL DEFAULT 'contains',
	`replyContent` text NOT NULL,
	`replyType` enum('text','text_button') NOT NULL DEFAULT 'text',
	`buttonText` varchar(128),
	`buttonUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 0,
	`triggerCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auto_reply_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `broadcast_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`buttonText` varchar(128),
	`buttonUrl` text,
	`targetType` enum('all','active','deposited','custom') NOT NULL DEFAULT 'all',
	`targetUserIds` json,
	`scheduledAt` timestamp,
	`status` enum('draft','pending','sending','completed','cancelled','failed') NOT NULL DEFAULT 'draft',
	`totalCount` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `broadcast_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fission_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`rewardType` enum('balance','none') NOT NULL DEFAULT 'balance',
	`inviterReward` decimal(10,2) NOT NULL DEFAULT '0.00',
	`inviteeReward` decimal(10,2) NOT NULL DEFAULT '0.00',
	`requireDeposit` boolean NOT NULL DEFAULT false,
	`minDepositAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`maxRewardPerUser` decimal(10,2) NOT NULL DEFAULT '0.00',
	`linkCode` varchar(32) NOT NULL,
	`clickCount` int NOT NULL DEFAULT 0,
	`registerCount` int NOT NULL DEFAULT 0,
	`rewardPaidCount` int NOT NULL DEFAULT 0,
	`totalRewardPaid` decimal(18,2) NOT NULL DEFAULT '0.00',
	`isActive` boolean NOT NULL DEFAULT true,
	`startTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fission_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `fission_campaigns_linkCode_unique` UNIQUE(`linkCode`)
);
--> statement-breakpoint
CREATE TABLE `fission_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`linkCode` varchar(32) NOT NULL,
	`userId` int,
	`inviterId` int,
	`ipAddress` varchar(64),
	`userAgent` text,
	`registered` boolean NOT NULL DEFAULT false,
	`deposited` boolean NOT NULL DEFAULT false,
	`rewardPaid` boolean NOT NULL DEFAULT false,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fission_clicks_id` PRIMARY KEY(`id`)
);
