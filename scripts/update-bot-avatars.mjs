/**
 * 更新所有bot头像为Telegram风格（名字首字/首字母 + 彩色背景）
 * 使用 ui-avatars.com 生成
 */
import { createConnection } from 'mysql2/promise';

// Telegram 风格的背景色（从TG源码提取的渐变色系）
const TG_COLORS = [
  '7BC862', 'E17076', '6EC9CB', 'FAA774', '65AADD',
  'EE7AE6', 'E5CA77', 'A695E7', '6BC587', 'E57B6F',
  '5DA5DC', 'D190D3', 'F5A76C', '7FAAD6', 'D493A8',
  '8FBFE8', 'C9A76B', '6FB1B8', 'D68F8F', '9AC47E',
  'B48BDB', 'E8A862', '6AADCB', 'CC8BA5', '8FBF7F'
];

function getColorForName(name) {
  // 基于名字hash选择颜色（确保同一名字总是同一颜色）
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return TG_COLORS[Math.abs(hash) % TG_COLORS.length];
}

function generateTgAvatar(name) {
  if (!name) return null;
  const firstChar = name.charAt(0);
  const bgColor = getColorForName(name);
  // ui-avatars.com: 生成首字母头像，白色文字，彩色背景
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstChar)}&background=${bgColor}&color=fff&size=128&bold=true&format=png`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(dbUrl);
  const connection = await createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to database');

  // 获取所有bot
  const [bots] = await connection.execute(
    'SELECT id, name, nickname FROM users WHERE isBot = 1'
  );
  console.log(`Found ${bots.length} bots to update`);

  // 批量更新（每批50个）
  let updated = 0;
  for (const bot of bots) {
    const displayName = bot.nickname || bot.name || `Bot${bot.id}`;
    const avatarUrl = generateTgAvatar(displayName);
    
    await connection.execute(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [avatarUrl, bot.id]
    );
    updated++;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated}/${bots.length} bots`);
    }
  }

  console.log(`\nDone! Updated ${updated} bot avatars to TG-style.`);

  // 验证
  const [sample] = await connection.execute(
    "SELECT id, name, avatar FROM users WHERE isBot = 1 ORDER BY RAND() LIMIT 5"
  );
  console.log('\nSample results:');
  for (const s of sample) {
    console.log(`  ${s.name} → ${s.avatar}`);
  }

  await connection.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
