import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

const userId = 37653; // huzhao6099

// 1. 关键发现：transactions 表有 balanceBefore/balanceAfter
// 已知3笔充值：0→1000, 2.98→1002.98, -10→990
// 说明中间有消费把余额从1000降到2.98，再从1002.98降到-10（负数！）
// 最后充值1000后变为990

// 2. 查 game_hands 表结构
const [ghCols] = await conn.execute(`SHOW COLUMNS FROM game_hands`);
console.log("=== GAME_HANDS COLUMNS ===");
console.log(ghCols.map(c => c.Field).join(", "));

// 3. 查游戏手牌记录（只用 hand_players 表的字段）
const [hands] = await conn.execute(
  `SELECT hp.id, hp.handId, hp.seatIndex, hp.betAmount, hp.winAmount, hp.isWinner, hp.finalHand
   FROM hand_players hp 
   WHERE hp.userId = ? 
   ORDER BY hp.id DESC LIMIT 20`,
  [userId]
);
console.log("\n=== GAME HAND RECORDS (hand_players) ===");
console.log(JSON.stringify(hands, null, 2));

// 4. 查 room_players 表（是否在房间里有筹码被锁定）
const [roomPlayers] = await conn.execute(
  `SELECT * FROM room_players WHERE userId = ?`,
  [userId]
);
console.log("\n=== ROOM_PLAYERS (chips currently in rooms) ===");
console.log(JSON.stringify(roomPlayers, null, 2));

// 5. 分析余额变化轨迹
console.log("\n=== BALANCE TRAIL ANALYSIS ===");
console.log("充值1: 0.00 → 1000.00 (2026-05-24 10:50)");
console.log("  [游戏消耗: 1000.00 → 2.98，共消耗 997.02]");
console.log("充值2: 2.98 → 1002.98 (2026-05-25 05:42)");
console.log("  [游戏消耗: 1002.98 → -10.00，共消耗 1012.98 (余额变负数！)]");
console.log("充值3: -10.00 → 990.00 (2026-05-27 08:24)");
console.log("当前余额: 980.00 (990 - 10 = 980，说明最近又消耗了10)");

// 6. 查看余额是否有负数的情况（余额变-10是bug！）
console.log("\n=== 注意：第2次充值前余额为 -10.00，这是一个 BUG ===");
console.log("余额不应该变成负数，说明游戏结算或买入逻辑有问题");

// 7. 查所有 game_hands 涉及该用户的记录
const [ghData] = await conn.execute(
  `SELECT gh.* FROM game_hands gh 
   INNER JOIN hand_players hp ON hp.handId = gh.id
   WHERE hp.userId = ?
   ORDER BY gh.id DESC LIMIT 10`,
  [userId]
);
console.log("\n=== GAME_HANDS DATA ===");
console.log(JSON.stringify(ghData, null, 2));

await conn.end();
