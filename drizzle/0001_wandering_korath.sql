CREATE TABLE `agent_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`downlineId` int NOT NULL,
	`level` int NOT NULL,
	`isUnlocked` boolean NOT NULL DEFAULT false,
	`unlockProgress` json,
	`unlockedAt` timestamp,
	`totalCommissionEarned` decimal(18,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commission_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`downlineId` int NOT NULL,
	`handId` int,
	`level` int NOT NULL,
	`rakeAmount` decimal(18,2) NOT NULL,
	`commissionRate` decimal(5,2) NOT NULL,
	`commissionAmount` decimal(18,2) NOT NULL,
	`status` enum('pending','settled','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commission_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cs_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','resolved','escalated') NOT NULL DEFAULT 'active',
	`language` varchar(10) DEFAULT 'en',
	`messages` json,
	`resolvedBy` enum('ai','human'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cs_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faq_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(64) NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`keywords` text,
	`language` varchar(10) NOT NULL DEFAULT 'en',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_hands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`handNumber` int NOT NULL,
	`communityCards` varchar(64),
	`serverSeed` varchar(128),
	`serverSeedHash` varchar(128),
	`clientSeed` varchar(128),
	`deckHash` varchar(128),
	`txHash` varchar(256),
	`potSize` decimal(18,2) DEFAULT '0.00',
	`rakeAmount` decimal(18,2) DEFAULT '0.00',
	`winnerId` int,
	`winningHand` varchar(64),
	`status` enum('dealing','preflop','flop','turn','river','showdown','completed') NOT NULL DEFAULT 'dealing',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `game_hands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hand_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`handId` int NOT NULL,
	`userId` int NOT NULL,
	`seatIndex` int NOT NULL,
	`holeCards` varchar(32),
	`betAmount` decimal(18,2) DEFAULT '0.00',
	`winAmount` decimal(18,2) DEFAULT '0.00',
	`action` enum('fold','check','call','raise','all_in','none') DEFAULT 'none',
	`isWinner` boolean DEFAULT false,
	`finalHand` varchar(64),
	CONSTRAINT `hand_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdraw','game','commission','system','security','room_invite') NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('multi_account','collusion','bot_behavior','abnormal_withdraw','self_play','ip_cluster') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`details` json,
	`actionTaken` enum('none','flagged','frozen','banned') NOT NULL DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`seatIndex` int NOT NULL,
	`chipCount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`status` enum('active','sitting_out','left') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('public','private') NOT NULL DEFAULT 'public',
	`status` enum('waiting','playing','paused','closed') NOT NULL DEFAULT 'waiting',
	`gameType` enum('texas_holdem','omaha') NOT NULL DEFAULT 'texas_holdem',
	`smallBlind` decimal(18,2) NOT NULL,
	`bigBlind` decimal(18,2) NOT NULL,
	`minBuyIn` decimal(18,2) NOT NULL,
	`maxBuyIn` decimal(18,2) NOT NULL,
	`maxPlayers` int NOT NULL DEFAULT 6,
	`ownerId` int,
	`inviteCode` varchar(32),
	`totalRounds` int,
	`playedRounds` int NOT NULL DEFAULT 0,
	`billingMode` enum('standard_rake','per_round_fee') NOT NULL DEFAULT 'standard_rake',
	`roundFee` decimal(18,2) DEFAULT '0.00',
	`rakePercent` decimal(5,2),
	`rakeCap` decimal(18,2),
	`currentPlayers` int NOT NULL DEFAULT 0,
	`fairnessLevel` enum('basic','medium','high') NOT NULL DEFAULT 'basic',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
CREATE TABLE `system_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(64) NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`valueType` enum('string','number','boolean','json') NOT NULL DEFAULT 'string',
	`label` varchar(256) NOT NULL,
	`description` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_configs_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdraw','game_win','game_loss','rake','commission','room_fee','refund','adjustment') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`balanceBefore` decimal(18,2) NOT NULL,
	`balanceAfter` decimal(18,2) NOT NULL,
	`chain` varchar(32),
	`txHash` varchar(256),
	`walletAddress` varchar(256),
	`status` enum('pending','confirmed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`referenceType` varchar(64),
	`referenceId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `tgId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `tgUsername` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `tgAccountAge` int;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `language` varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `users` ADD `balance` decimal(18,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `frozenBalance` decimal(18,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invitedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `inviteCode` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `agentLevel` enum('none','agent') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `riskLevel` enum('normal','watch','frozen','banned') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deviceFingerprint` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `lastIp` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `totalGamesPlayed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalRakeGenerated` decimal(18,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalDeposited` decimal(18,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_tgId_unique` UNIQUE(`tgId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_inviteCode_unique` UNIQUE(`inviteCode`);