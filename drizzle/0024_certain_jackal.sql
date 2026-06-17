CREATE TABLE `room_bot_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`botCount` int NOT NULL DEFAULT 3,
	`enabled` boolean NOT NULL DEFAULT true,
	`foldRate` int,
	`minActionDelay` int,
	`maxActionDelay` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `room_bot_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLatitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `users` ADD `lastLongitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `users` ADD `lastLocationAt` timestamp;