ALTER TABLE `room_bot_config` ADD `aiLevel` int;--> statement-breakpoint
ALTER TABLE `users` ADD `withdrawAddress` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `withdrawChain` varchar(32);