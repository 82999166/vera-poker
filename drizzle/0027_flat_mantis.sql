CREATE TABLE `red_packet_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`redPacketId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `red_packet_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `red_packets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text,
	`totalAmount` decimal(18,2) NOT NULL,
	`totalCount` int NOT NULL,
	`claimedCount` int NOT NULL DEFAULT 0,
	`claimedAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`type` enum('random','fixed') NOT NULL DEFAULT 'random',
	`condition` json,
	`imageUrl` text,
	`status` enum('active','paused','completed','expired') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `red_packets_id` PRIMARY KEY(`id`)
);
