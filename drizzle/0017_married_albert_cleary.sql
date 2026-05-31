CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`buttons` json,
	`category` varchar(64) DEFAULT 'general',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `welcome_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`language` varchar(10) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`buttons` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `welcome_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `broadcast_tasks` ADD `targetFilter` json;