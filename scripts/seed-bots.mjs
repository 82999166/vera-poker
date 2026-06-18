#!/usr/bin/env node
/**
 * Seed 1000 bots into the database.
 * Reads bot data from /tmp/bot-seed-data.json and inserts via direct DB connection.
 */
import { readFileSync } from "fs";
import mysql from "mysql2/promise";

// Read database URL from env or use the project's .env
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: DATABASE_URL=... node scripts/seed-bots.mjs");
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
};

async function main() {
  // Load bot data
  const bots = JSON.parse(readFileSync("/tmp/bot-seed-data.json", "utf-8"));
  console.log(`Loaded ${bots.length} bots to insert`);

  const conn = await mysql.createConnection(config);
  console.log("Connected to database");

  let inserted = 0;
  const batchSize = 50;

  for (let i = 0; i < bots.length; i += batchSize) {
    const batch = bots.slice(i, i + batchSize);
    const values = batch.map(bot => {
      const openId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return [openId, bot.name, bot.nickname, bot.avatar, String(bot.balance), 1, "user"];
    });

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();

    await conn.execute(
      `INSERT INTO users (openId, name, nickname, avatar, balance, isBot, role) VALUES ${placeholders}`,
      flatValues
    );

    inserted += batch.length;
    if (inserted % 100 === 0 || inserted === bots.length) {
      console.log(`  Inserted ${inserted}/${bots.length} bots`);
    }

    // Small delay to avoid overwhelming the DB
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDone! Inserted ${inserted} bots.`);

  // Verify
  const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM users WHERE isBot = 1");
  console.log(`Total bots in database: ${rows[0].cnt}`);

  await conn.end();
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
