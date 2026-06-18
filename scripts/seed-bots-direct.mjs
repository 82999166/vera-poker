#!/usr/bin/env node
/**
 * Seed 1000 bots directly using the project's drizzle DB connection.
 * Run from project root: node scripts/seed-bots-direct.mjs
 */
import { readFileSync } from "fs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

async function main() {
  // Load bot data
  const bots = JSON.parse(readFileSync("/tmp/bot-seed-data.json", "utf-8"));
  console.log(`Loaded ${bots.length} bots to insert`);

  // Connect directly with mysql2
  const connection = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database");

  let inserted = 0;
  const batchSize = 50;

  for (let i = 0; i < bots.length; i += batchSize) {
    const batch = bots.slice(i, i + batchSize);
    const values = [];
    const placeholders = [];

    for (const bot of batch) {
      const openId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      placeholders.push("(?, ?, ?, ?, ?, ?, ?)");
      values.push(openId, bot.name, bot.nickname, bot.avatar || null, String(bot.balance), true, "user");
    }

    const sql = `INSERT INTO users (openId, name, nickname, avatar, balance, isBot, role) VALUES ${placeholders.join(", ")}`;
    await connection.execute(sql, values);

    inserted += batch.length;
    if (inserted % 100 === 0 || inserted === bots.length) {
      console.log(`  Inserted ${inserted}/${bots.length} bots`);
    }

    // Small delay
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\nDone! Inserted ${inserted} bots.`);

  // Verify
  const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM users WHERE isBot = 1");
  console.log(`Total bots in database: ${rows[0].cnt}`);

  await connection.end();
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
