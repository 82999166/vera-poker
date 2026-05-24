CREATE TABLE `tournament_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tournamentId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('registered','playing','eliminated','finished','refunded') NOT NULL DEFAULT 'registered',
	`currentChips` int NOT NULL DEFAULT 0,
	`tableId` varchar(64),
	`seatIndex` int,
	`finishRank` int,
	`eliminatedAtRound` int,
	`prizeAmount` decimal(12,2) DEFAULT '0.00',
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`eliminatedAt` timestamp,
	CONSTRAINT `tournament_registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tournamentId` int NOT NULL,
	`userId` int NOT NULL,
	`rank` int NOT NULL,
	`prizeAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`startingChips` int NOT NULL,
	`finalChips` int NOT NULL DEFAULT 0,
	`roundsPlayed` int NOT NULL DEFAULT 0,
	`handsWon` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tournament_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`status` enum('draft','registration','running','finished','cancelled') NOT NULL DEFAULT 'draft',
	`startTime` timestamp NOT NULL,
	`registrationOpenTime` timestamp,
	`entryFee` decimal(12,2) NOT NULL,
	`startingChips` int NOT NULL DEFAULT 10000,
	`minPlayers` int NOT NULL DEFAULT 10,
	`maxPlayers` int NOT NULL DEFAULT 1000,
	`playersPerTable` int NOT NULL DEFAULT 9,
	`totalRounds` int NOT NULL DEFAULT 60,
	`blindLevelDuration` int NOT NULL DEFAULT 10,
	`blindStructure` json NOT NULL,
	`platformRake` decimal(5,2) NOT NULL DEFAULT '10.00',
	`prizeDistribution` json NOT NULL,
	`tableShuffleInterval` int NOT NULL DEFAULT 15,
	`finalTableThreshold` int NOT NULL DEFAULT 9,
	`registeredCount` int NOT NULL DEFAULT 0,
	`totalPrizePool` decimal(12,2) DEFAULT '0.00',
	`actualStartTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`)
);
