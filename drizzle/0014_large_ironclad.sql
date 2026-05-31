CREATE TABLE `risk_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ruleId` int NOT NULL,
	`ruleKey` varchar(64) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('pending','reviewed','resolved','ignored') NOT NULL DEFAULT 'pending',
	`title` varchar(256) NOT NULL,
	`description` text,
	`evidence` json,
	`aiAnalysis` text,
	`riskScore` int,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`resolution` text,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleKey` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`category` enum('fraud','collusion','bonus_abuse','bot','money_laundering') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`params` json,
	`action` enum('alert_only','freeze_balance','ban_account','notify_admin') NOT NULL DEFAULT 'alert_only',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risk_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `risk_rules_ruleKey_unique` UNIQUE(`ruleKey`)
);
