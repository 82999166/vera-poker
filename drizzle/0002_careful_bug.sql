ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','cs','finance','tech') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `staffUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `staffPasswordHash` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_staffUsername_unique` UNIQUE(`staffUsername`);