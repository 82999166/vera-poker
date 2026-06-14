/**
 * 读取生成的bot数据，输出SQL语句用于插入数据库
 */
import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync("/home/ubuntu/vera-poker/scripts/bot-data.json", "utf-8"));

// 生成INSERT SQL for 200 new bots
const insertStatements = data.newBots.map((bot, i) => {
  const openId = `bot_gen_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
  const name = bot.name.replace(/'/g, "''");
  const nickname = bot.nickname.replace(/'/g, "''");
  const avatar = bot.avatar.replace(/'/g, "''");
  return `('${openId}', '${name}', '${nickname}', '${avatar}', '${bot.balance}.00', 1, 'user')`;
});

// Split into batches of 50 for SQL execution
const batchSize = 50;
const batches = [];
for (let i = 0; i < insertStatements.length; i += batchSize) {
  const batch = insertStatements.slice(i, i + batchSize);
  batches.push(`INSERT INTO users (openId, name, nickname, avatar, balance, isBot, role) VALUES\n${batch.join(",\n")};`);
}

// Write SQL file
writeFileSync("/home/ubuntu/vera-poker/scripts/insert-bots.sql", batches.join("\n\n"));

// Generate UPDATE SQL for existing 8 bots' avatars
const updateSql = `-- Update existing 8 bots with avatars (update by isBot=1 and avatar IS NULL or empty)
UPDATE users SET avatar = '${data.existingBotAvatars[0]}' WHERE isBot = 1 AND (avatar IS NULL OR avatar = '') LIMIT 1;
`;

writeFileSync("/home/ubuntu/vera-poker/scripts/update-existing-bots.sql", updateSql);

console.log(`Generated ${batches.length} batch INSERT statements for ${data.newBots.length} bots`);
console.log("SQL files written to scripts/insert-bots.sql and scripts/update-existing-bots.sql");
