ALTER TABLE `users` ADD `bonusBalance` decimal(18,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bonusUnlocked` boolean DEFAULT false NOT NULL;