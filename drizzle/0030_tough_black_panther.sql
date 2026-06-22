CREATE TABLE `chain_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`depositAddressId` int NOT NULL,
	`chain` varchar(32) NOT NULL,
	`txHash` varchar(256) NOT NULL,
	`fromAddress` varchar(256),
	`toAddress` varchar(256) NOT NULL,
	`amount` decimal(18,6) NOT NULL,
	`creditedAmount` decimal(18,2),
	`confirmations` int NOT NULL DEFAULT 0,
	`status` enum('detected','confirmed','credited','failed','ignored') NOT NULL DEFAULT 'detected',
	`blockNumber` bigint,
	`blockTimestamp` timestamp,
	`creditedAt` timestamp,
	`transactionId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chain_deposits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consolidations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromAddress` varchar(256) NOT NULL,
	`toAddress` varchar(256) NOT NULL,
	`chain` varchar(32) NOT NULL,
	`amount` decimal(18,6) NOT NULL,
	`txHash` varchar(256),
	`gasFee` decimal(18,6),
	`status` enum('pending','submitted','confirmed','failed') NOT NULL DEFAULT 'pending',
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consolidations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deposit_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chain` varchar(32) NOT NULL,
	`address` varchar(256) NOT NULL,
	`derivationIndex` int NOT NULL,
	`privateKeyEnc` text,
	`totalDeposited` decimal(18,2) NOT NULL DEFAULT '0',
	`lastScannedAt` timestamp,
	`status` enum('active','disabled','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposit_addresses_id` PRIMARY KEY(`id`)
);
