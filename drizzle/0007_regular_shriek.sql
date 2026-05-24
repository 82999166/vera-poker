CREATE TABLE `admin_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operatorId` int,
	`operatorName` varchar(128),
	`operatorRole` varchar(32),
	`action` varchar(128) NOT NULL,
	`category` enum('finance','user','room','config','agent','system','auth') NOT NULL DEFAULT 'system',
	`targetType` varchar(64),
	`targetId` varchar(64),
	`detail` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`status` enum('success','failed') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_logs_id` PRIMARY KEY(`id`)
);
