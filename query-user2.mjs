import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

const userId = 37653; // huzhao6099

// 1. 查所有交易记录（包括游戏相关）
const [txCols] = await conn.execute(`SHOW COLUMNS FROM transactions`);
console.log("=== TRANSACTION COLUMNS ===");
console.log(txCols.map(c => c.Field).join(", "));

const [allTxs] = await conn.execute(
  `SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
  [userId]
);
console.log("\n=== ALL TRANSACTIONS ===");
console.log(JSON.stringify(allTxs, null, 2));

// 2. 查 hand_players 表结构
const [hpCols] = await conn.execute(`SHOW COLUMNS FROM hand_players`);
console.log("\n=== HAND_PLAYERS COLUMNS ===");
console.log(hpCols.map(c => c.Field).join(", "));

// 3. 查游戏手牌记录
const [hands] = await conn.execute(
  `SELECT hp.*, gh.roomId, gh.phase, gh.pot, gh.startedAt, gh.endedAt
   FROM hand_players hp 
   LEFT JOIN game_hands gh ON hp.handId = gh.id
   WHERE hp.userId = ? 
   ORDER BY hp.id DESC LIMIT 20`,
  [userId]
);
console.log("\n=== GAME HAND RECORDS ===");
console.log(JSON.stringify(hands, null, 2));

// 4. 查 room_players 表（是否在房间里有筹码）
const [roomPlayers] = await conn.execute(
  `SELECT * FROM room_players WHERE userId = ?`,
  [userId]
);
console.log("\n=== ROOM_PLAYERS (current chips in rooms) ===");
console.log(JSON.stringify(roomPlayers, null, 2));

// 5. 查余额变动历史（如果有 balance_logs 表）
const [tables] = await conn.execute(`SHOW TABLES LIKE '%balance%'`);
console.log("\n=== BALANCE-RELATED TABLES ===");
console.log(JSON.stringify(tables, null, 2));

await conn.end();
