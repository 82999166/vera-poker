-- Update existing 8 bots with avatars (update by isBot=1 and avatar IS NULL or empty)
UPDATE users SET avatar = 'https://randomuser.me/api/portraits/men/75.jpg' WHERE isBot = 1 AND (avatar IS NULL OR avatar = '') LIMIT 1;
