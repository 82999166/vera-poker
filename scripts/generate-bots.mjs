/**
 * 批量生成200个机器人（随机英文名 + 真实头像URL）
 * 并补全现有8个机器人的头像
 * 
 * 使用 randomuser.me API 获取真实头像
 * 使用常见英文名随机组合
 */

// 常见英文名（男女各100个）
const maleFirstNames = [
  "James", "John", "Robert", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles",
  "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua",
  "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan",
  "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon",
  "Benjamin", "Samuel", "Raymond", "Gregory", "Frank", "Alexander", "Patrick", "Jack", "Dennis", "Jerry",
  "Tyler", "Aaron", "Jose", "Nathan", "Henry", "Peter", "Douglas", "Zachary", "Kyle", "Noah",
  "Ethan", "Jeremy", "Walter", "Christian", "Keith", "Roger", "Terry", "Austin", "Sean", "Gerald",
  "Carl", "Harold", "Dylan", "Arthur", "Lawrence", "Jordan", "Jesse", "Bryan", "Billy", "Bruce",
  "Gabriel", "Joe", "Logan", "Albert", "Willie", "Alan", "Eugene", "Russell", "Vincent", "Philip",
  "Bobby", "Johnny", "Bradley", "Roy", "Ralph", "Eugene", "Randy", "Wayne", "Elijah", "Mason"
];

const femaleFirstNames = [
  "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan", "Jessica", "Sarah", "Karen",
  "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily", "Donna",
  "Michelle", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia",
  "Kathleen", "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma", "Nicole", "Helen",
  "Samantha", "Katherine", "Christine", "Debra", "Rachel", "Carolyn", "Janet", "Catherine", "Maria", "Heather",
  "Diane", "Ruth", "Julie", "Olivia", "Joyce", "Virginia", "Victoria", "Kelly", "Lauren", "Christina",
  "Joan", "Evelyn", "Judith", "Megan", "Andrea", "Cheryl", "Hannah", "Jacqueline", "Martha", "Gloria",
  "Teresa", "Ann", "Sara", "Madison", "Frances", "Kathryn", "Janice", "Jean", "Abigail", "Alice",
  "Judy", "Sophia", "Grace", "Denise", "Amber", "Doris", "Marilyn", "Danielle", "Beverly", "Isabella",
  "Theresa", "Diana", "Natalie", "Brittany", "Charlotte", "Marie", "Kayla", "Alexis", "Lori", "Chloe"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Turner", "Phillips", "Evans", "Collins", "Edwards", "Stewart", "Morris", "Murphy", "Cook", "Rogers",
  "Morgan", "Peterson", "Cooper", "Reed", "Bailey", "Bell", "Gomez", "Kelly", "Howard", "Ward",
  "Cox", "Diaz", "Richardson", "Wood", "Watson", "Brooks", "Bennett", "Gray", "James", "Reyes",
  "Cruz", "Hughes", "Price", "Myers", "Long", "Foster", "Sanders", "Ross", "Morales", "Powell",
  "Sullivan", "Russell", "Ortiz", "Jenkins", "Gutierrez", "Perry", "Butler", "Barnes", "Fisher", "Henderson"
];

// 生成随机用户名格式：FirstName_LastInitial 或 FirstName.Last 或 FirstNameLastInitial123
function generateUsername(firstName, lastName) {
  const formats = [
    () => `${firstName}_${lastName.charAt(0)}`,
    () => `${firstName}${lastName.charAt(0)}${Math.floor(Math.random() * 99)}`,
    () => `${firstName}.${lastName.substring(0, 3)}`,
    () => `${firstName}${Math.floor(Math.random() * 999)}`,
    () => `${firstName}_${lastName.substring(0, 4)}`,
  ];
  return formats[Math.floor(Math.random() * formats.length)]();
}

// 使用 randomuser.me 的头像（这些是稳定的CDN头像URL）
// 格式: https://randomuser.me/api/portraits/{gender}/{number}.jpg
// gender: men 或 women, number: 0-99
function generateAvatarUrl(index, isMale) {
  const gender = isMale ? "men" : "women";
  const num = index % 100;
  return `https://randomuser.me/api/portraits/${gender}/${num}.jpg`;
}

// 生成200个bot数据
const bots = [];
const usedNames = new Set();

for (let i = 0; i < 200; i++) {
  const isMale = Math.random() > 0.45; // 55% male, 45% female
  const firstNames = isMale ? maleFirstNames : femaleFirstNames;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  let username = generateUsername(firstName, lastName);
  // 确保唯一
  while (usedNames.has(username)) {
    username = generateUsername(firstName, lastName) + Math.floor(Math.random() * 99);
  }
  usedNames.add(username);
  
  const avatar = generateAvatarUrl(i, isMale);
  
  bots.push({
    name: username,
    nickname: `${firstName} ${lastName.charAt(0)}.`,
    avatar: avatar,
    balance: 10000 + Math.floor(Math.random() * 90000), // 10000-100000 随机余额
  });
}

// 为现有8个bot生成头像URL
const existingBotAvatars = [
  "https://randomuser.me/api/portraits/men/75.jpg",
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/51.jpg",
  "https://randomuser.me/api/portraits/women/22.jpg",
  "https://randomuser.me/api/portraits/men/88.jpg",
  "https://randomuser.me/api/portraits/women/91.jpg",
];

// 输出JSON
const output = {
  newBots: bots,
  existingBotAvatars: existingBotAvatars,
};

// 写入文件
import { writeFileSync } from "fs";
writeFileSync("/home/ubuntu/vera-poker/scripts/bot-data.json", JSON.stringify(output, null, 2));
console.log(`Generated ${bots.length} bots`);
console.log(`Sample: ${bots[0].name} - ${bots[0].nickname} - ${bots[0].avatar}`);
console.log(`Sample: ${bots[99].name} - ${bots[99].nickname} - ${bots[99].avatar}`);
console.log(`Sample: ${bots[199].name} - ${bots[199].nickname} - ${bots[199].avatar}`);
