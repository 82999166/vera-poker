import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(url);

// Query user
const [users] = await conn.execute(
  `SELECT id, name, nickname, tgId, tgUsername, balance, frozenBalance, totalDeposited, createdAt, lastSignedIn, riskLevel, role
   FROM users WHERE nickname = ? OR tgUsername = ? LIMIT 5`,
  ["huzhao6099", "huzhao6099"]
);
console.log("=== USER INFO ===");
console.log(JSON.stringify(users, null, 2));

if (users.length > 0) {
  const userId = users[0].id;
  
  // Get transaction columns first
  const [cols] = await conn.execute(`SHOW COLUMNS FROM transactions`);
  const colNames = cols.map(c => c.Field);
  
  // Query transactions with safe columns
  const safeFields = ["id", "type", "amount", "status", "createdAt", "operatorName", "txHash", "note"]
    .filter(f => colNames.includes(f));
  const [txs] = await conn.execute(
    `SELECT ${safeFields.join(", ")} FROM transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 30`,
    [userId]
  );
  console.log("\n=== TRANSACTIONS (last 30) ===");
  console.log(JSON.stringify(txs, null, 2));

  // Query game hands
  const [hands] = await conn.execute(
    `SELECT hp.handId, hp.seatIn, hp.seatOut, hp.netChange, gh.createdAt, gh.roomId
     FROM hand_players hp JOIN game_hands gh ON hp.handId = gh.id
     WHERE hp.userId = ? ORDER BY gh.createdAt DESC LIMIT 10`,
    [userId]
  );
  console.log("\n=== RECENT GAME HANDS (last 10) ===");
  console.log(JSON.stringify(hands, null, 2));
}

await conn.end();
