CREATE TABLE `admin_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`name` varchar(128) NOT NULL,
	`role` enum('super_admin','admin','cs','finance','tech') NOT NULL DEFAULT 'cs',
	`permissions` json DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastLoginAt` timestamp,
	`lastLoginIp` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_username_unique` UNIQUE(`username`)
);
