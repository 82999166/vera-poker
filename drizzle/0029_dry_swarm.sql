CREATE TABLE `tg_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`chatId` varchar(128) NOT NULL,
	`type` enum('group','channel','supergroup') NOT NULL DEFAULT 'group',
	`description` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tg_groups_id` PRIMARY KEY(`id`)
);
