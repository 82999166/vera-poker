/**
 * 生成300个中国人名+头像的机器人账号
 * 使用 DiceBear API 生成头像
 */
import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

// 中国姓氏（常见100个）
const surnames = [
  '王','李','张','刘','陈','杨','赵','黄','周','吴',
  '徐','孙','胡','朱','高','林','何','郭','马','罗',
  '梁','宋','郑','谢','韩','唐','冯','于','董','萧',
  '程','曹','袁','邓','许','傅','沈','曾','彭','吕',
  '苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎',
  '余','潘','杜','戴','夏','钟','汪','田','任','姜',
  '范','方','石','姚','谭','廖','邹','熊','金','陆',
  '郝','孔','白','崔','康','毛','邱','秦','江','史',
  '顾','侯','邵','孟','龙','万','段','雷','钱','汤',
  '尹','黎','易','常','武','乔','贺','赖','龚','文'
];

// 男性名字用字
const maleChars = [
  '伟','强','磊','军','勇','杰','涛','明','超','志',
  '刚','鹏','辉','峰','浩','宇','飞','博','毅','翔',
  '龙','斌','健','凯','俊','彬','昊','然','睿','哲',
  '晨','阳','旭','天','宏','文','武','建','国','华',
  '平','安','成','东','海','山','林','松','柏','鑫',
  '波','洋','帆','航','程','远','达','恒','坚','铭'
];

// 女性名字用字
const femaleChars = [
  '芳','娜','敏','静','丽','艳','霞','秀','娟','英',
  '华','慧','巧','美','婷','雪','飞','萍','玲','桂',
  '莲','真','环','雅','倩','琳','素','云','莉','蓉',
  '洁','瑶','璐','颖','露','瑞','凤','青','红','玉',
  '萱','梦','诗','涵','欣','怡','悦','妍','馨','蕊',
  '晴','彤','菲','嘉','琪','薇','岚','珊','宁','茜'
];

// 生成随机中国人名
function generateChineseName(index) {
  const surname = surnames[index % surnames.length];
  const isFemale = index % 3 === 0; // 1/3女性
  const chars = isFemale ? femaleChars : maleChars;
  
  // 随机1-2个字的名
  const nameLen = Math.random() > 0.4 ? 2 : 1;
  let givenName = '';
  for (let i = 0; i < nameLen; i++) {
    givenName += chars[Math.floor(Math.random() * chars.length)];
  }
  return surname + givenName;
}

// 生成头像URL（使用 DiceBear avatars API - 免费无需API key）
function generateAvatarUrl(seed) {
  // 使用多种风格随机分配
  const styles = ['adventurer', 'avataaars', 'big-ears', 'lorelei', 'micah', 'miniavs', 'notionists', 'personas'];
  const style = styles[Math.abs(hashCode(seed)) % styles.length];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

async function main() {
  // 从环境变量获取数据库连接
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  // 解析DATABASE_URL
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

  // 生成300个bot
  const bots = [];
  const usedNames = new Set();
  
  for (let i = 0; i < 300; i++) {
    let name;
    // 确保名字不重复
    do {
      name = generateChineseName(i + Math.floor(Math.random() * 1000));
    } while (usedNames.has(name));
    usedNames.add(name);

    const openId = `bot_cn_${crypto.randomBytes(8).toString('hex')}`;
    const avatar = generateAvatarUrl(name + i);
    const balance = (Math.random() * 80 + 20).toFixed(2); // 20-100随机余额

    bots.push({ openId, name, avatar, balance });
  }

  console.log(`Generated ${bots.length} bot profiles`);

  // 批量插入（每批50个）
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < bots.length; i += batchSize) {
    const batch = bots.slice(i, i + batchSize);
    const values = batch.map(b => 
      `('${b.openId}', '${b.name}', '${b.avatar}', '${b.balance}', 1, 'bot', 'en')`
    ).join(',\n');

    const sql = `INSERT INTO users (openId, name, avatar, balance, isBot, loginMethod, language) VALUES\n${values};`;
    
    await connection.execute(sql);
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${bots.length} bots`);
  }

  console.log(`\nDone! Created ${inserted} Chinese-named bots.`);
  
  // 验证
  const [rows] = await connection.execute('SELECT COUNT(*) as total FROM users WHERE isBot = 1');
  console.log(`Total bots in database: ${rows[0].total}`);

  await connection.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
