/**
 * Bot多语言用户名生成器
 * 支持14种语言，按比例随机分配
 * 生成的用户名看起来像真实玩家
 */

// 14种语言的名字库
const NAME_POOLS: Record<string, { firstNames: string[]; lastNames: string[]; format: "first_last" | "last_first" | "single" }> = {
  // 英语 (20%)
  en: {
    firstNames: ["James", "John", "Robert", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Chris",
      "Daniel", "Matthew", "Anthony", "Mark", "Steven", "Paul", "Andrew", "Kevin", "Brian", "George",
      "Emma", "Olivia", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail",
      "Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery", "Blake"],
    lastNames: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
      "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White",
      "Harris", "Clark", "Lewis", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Hill"],
    format: "first_last",
  },
  // 中文 (12%)
  zh: {
    firstNames: ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "洋", "勇",
      "军", "杰", "涛", "明", "超", "秀英", "华", "丹", "鑫", "玲",
      "桂英", "秀兰", "玉兰", "婷", "雪", "飞", "平", "刚", "建华", "建国"],
    lastNames: ["王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
      "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
      "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧"],
    format: "last_first",
  },
  // 日语 (8%)
  ja: {
    firstNames: ["太郎", "花子", "健太", "美咲", "大輔", "愛", "翔太", "さくら", "拓也", "陽子",
      "悠斗", "結衣", "蓮", "凛", "大翔", "葵", "陽翔", "芽依", "湊", "紬",
      "颯太", "美月", "隼人", "七海", "悠真", "心春", "朝陽", "彩花", "奏", "楓"],
    lastNames: ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤",
      "吉田", "山田", "佐々木", "松本", "井上", "木村", "林", "斎藤", "清水", "山口",
      "森", "池田", "橋本", "阿部", "石川", "山崎", "中島", "前田", "藤田", "小川"],
    format: "last_first",
  },
  // 韩语 (8%)
  ko: {
    firstNames: ["민준", "서연", "지훈", "지민", "준서", "서현", "현우", "하은", "도윤", "수빈",
      "예준", "지아", "시우", "하윤", "주원", "소율", "지호", "채원", "건우", "지유",
      "우진", "은서", "선우", "다은", "민재", "예은", "현준", "수아", "서준", "하린"],
    lastNames: ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
      "한", "오", "서", "신", "권", "황", "안", "송", "류", "전",
      "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남"],
    format: "last_first",
  },
  // 俄语 (10%)
  ru: {
    firstNames: ["Александр", "Дмитрий", "Максим", "Сергей", "Андрей", "Алексей", "Артём", "Илья", "Кирилл", "Михаил",
      "Анна", "Мария", "Елена", "Дарья", "Алина", "Ирина", "Ольга", "Екатерина", "Наталья", "Татьяна",
      "Иван", "Никита", "Матвей", "Роман", "Егор", "Арсений", "Владимир", "Денис", "Тимофей", "Даниил"],
    lastNames: ["Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов", "Новиков", "Фёдоров",
      "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев",
      "Орлов", "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев"],
    format: "first_last",
  },
  // 阿拉伯语 (8%)
  ar: {
    firstNames: ["محمد", "أحمد", "علي", "حسن", "خالد", "عمر", "يوسف", "إبراهيم", "عبدالله", "سعد",
      "فاطمة", "عائشة", "مريم", "نور", "سارة", "ليلى", "هدى", "أمينة", "زينب", "ريم",
      "طارق", "ماجد", "فيصل", "سلطان", "ناصر", "بدر", "راشد", "سالم", "حمد", "عادل"],
    lastNames: ["العلي", "الحسن", "المحمد", "الأحمد", "الخالد", "السعيد", "العمر", "الرشيد", "الفهد", "الدوسري",
      "القحطاني", "الشمري", "العتيبي", "الحربي", "المطيري", "الزهراني", "الغامدي", "البلوي", "السبيعي", "الجهني",
      "المالكي", "الثبيتي", "الحازمي", "العنزي", "الرويلي", "الشهري", "الأسمري", "الخثعمي", "البيشي", "الزيدي"],
    format: "first_last",
  },
  // 泰语 (5%)
  th: {
    firstNames: ["สมชาย", "สมศรี", "สุรชัย", "วิชัย", "ประเสริฐ", "สมบัติ", "สุนทร", "วิเชียร", "บุญมี", "สมพร",
      "นภา", "สุดา", "วรรณา", "พรทิพย์", "สุภาพร", "อรุณ", "มานะ", "ชัยวัฒน์", "ธนกร", "พิชัย",
      "กานดา", "ปิยะ", "ณัฐ", "ภัทร", "ศิริ", "อนุชา", "วีระ", "ธีระ", "เกียรติ", "ประสิทธิ์"],
    lastNames: ["สุขสวัสดิ์", "วงศ์สุวรรณ", "ศรีสุข", "พงษ์พิพัฒน์", "จันทร์เพ็ญ", "แก้วมณี", "ทองดี", "สมบูรณ์", "พิทักษ์", "รุ่งเรือง",
      "เจริญสุข", "มีสุข", "ดีเลิศ", "ชัยมงคล", "ศรีวิไล", "ประเสริฐ", "สุวรรณ", "บุญเรือง", "ทรัพย์สิน", "วัฒนา",
      "ลิ้มเจริญ", "ตันติ", "อุดมศักดิ์", "กิจเจริญ", "พัฒนา", "สิริ", "มงคล", "ชนะ", "เกษม", "สันติ"],
    format: "first_last",
  },
  // 越南语 (5%)
  vi: {
    firstNames: ["Minh", "Hương", "Tuấn", "Linh", "Dũng", "Hà", "Thắng", "Mai", "Hoàng", "Lan",
      "Phong", "Ngọc", "Đức", "Thảo", "Quang", "Trang", "Hải", "Yến", "Long", "Hạnh",
      "Bình", "Vy", "Khoa", "Trâm", "Nam", "Phương", "Tùng", "Diệu", "Việt", "Thùy"],
    lastNames: ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
      "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đào", "Đinh", "Lương", "Trương",
      "Mai", "Tô", "Thái", "Châu", "Tạ", "Quách", "La", "Hà", "Từ", "Cao"],
    format: "last_first",
  },
  // 印尼语 (5%)
  id: {
    firstNames: ["Budi", "Siti", "Agus", "Sri", "Bambang", "Dewi", "Eko", "Ratna", "Hendra", "Wati",
      "Dedi", "Yuni", "Andi", "Rina", "Joko", "Lina", "Wahyu", "Fitri", "Rizky", "Putri",
      "Arif", "Indah", "Fajar", "Mega", "Dian", "Rini", "Bayu", "Sari", "Adi", "Nita"],
    lastNames: ["Susanto", "Wijaya", "Setiawan", "Kusuma", "Pratama", "Saputra", "Hidayat", "Nugroho", "Santoso", "Wibowo",
      "Putra", "Permana", "Gunawan", "Suryadi", "Hartono", "Utomo", "Firmansyah", "Prasetyo", "Ramadhan", "Kurniawan",
      "Cahyadi", "Lesmana", "Budiman", "Halim", "Tanuwijaya", "Salim", "Surya", "Chandra", "Mulyadi", "Sutrisno"],
    format: "first_last",
  },
  // 葡萄牙语 (5%)
  pt: {
    firstNames: ["João", "Maria", "Pedro", "Ana", "Lucas", "Juliana", "Gabriel", "Fernanda", "Rafael", "Camila",
      "Mateus", "Larissa", "Thiago", "Beatriz", "Bruno", "Amanda", "Felipe", "Letícia", "Gustavo", "Mariana",
      "Diego", "Carolina", "Leonardo", "Isabela", "Rodrigo", "Natália", "Vinícius", "Gabriela", "André", "Bruna"],
    lastNames: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
      "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
      "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas"],
    format: "first_last",
  },
  // 西班牙语 (5%)
  es: {
    firstNames: ["Carlos", "María", "José", "Carmen", "Juan", "Ana", "Luis", "Laura", "Miguel", "Marta",
      "Antonio", "Lucía", "Francisco", "Elena", "David", "Paula", "Javier", "Sara", "Daniel", "Alba",
      "Alejandro", "Claudia", "Pablo", "Sofía", "Sergio", "Irene", "Adrián", "Nuria", "Álvaro", "Cristina"],
    lastNames: ["García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez", "Sánchez", "Ramírez", "Torres",
      "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Gutiérrez", "Ortiz", "Ramos",
      "Vargas", "Castillo", "Jiménez", "Moreno", "Romero", "Alonso", "Ruiz", "Navarro", "Domínguez", "Vázquez"],
    format: "first_last",
  },
  // 法语 (3%)
  fr: {
    firstNames: ["Jean", "Marie", "Pierre", "Sophie", "Michel", "Isabelle", "Philippe", "Nathalie", "Nicolas", "Catherine",
      "Thomas", "Julie", "Antoine", "Camille", "Maxime", "Léa", "Alexandre", "Manon", "Julien", "Chloé",
      "Mathieu", "Emma", "Romain", "Clara", "Hugo", "Inès", "Lucas", "Sarah", "Théo", "Jade"],
    lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
      "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
      "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand"],
    format: "first_last",
  },
  // 德语 (3%)
  de: {
    firstNames: ["Thomas", "Anna", "Michael", "Maria", "Andreas", "Julia", "Stefan", "Sarah", "Christian", "Laura",
      "Markus", "Lena", "Daniel", "Katharina", "Martin", "Lisa", "Tobias", "Sophie", "Jan", "Hannah",
      "Lukas", "Lea", "Felix", "Mia", "Tim", "Emma", "Maximilian", "Johanna", "Alexander", "Marie"],
    lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
      "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
      "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier"],
    format: "first_last",
  },
  // 土耳其语 (3%)
  tr: {
    firstNames: ["Mehmet", "Fatma", "Mustafa", "Ayşe", "Ahmet", "Emine", "Ali", "Hatice", "Hüseyin", "Zeynep",
      "Hasan", "Elif", "İbrahim", "Merve", "İsmail", "Büşra", "Osman", "Esra", "Yusuf", "Nur",
      "Murat", "Selin", "Emre", "Gizem", "Burak", "Deniz", "Serkan", "Ebru", "Cem", "Aslı"],
    lastNames: ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
      "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
      "Polat", "Korkmaz", "Erdoğan", "Yılmaz", "Aktaş", "Güneş", "Aksoy", "Kaplan", "Acar", "Bulut"],
    format: "first_last",
  },
};

// 语言分配比例 (总和=100%)
const LANGUAGE_WEIGHTS: Record<string, number> = {
  en: 20,
  zh: 12,
  ja: 8,
  ko: 8,
  ru: 10,
  ar: 8,
  th: 5,
  vi: 5,
  id: 5,
  pt: 5,
  es: 5,
  fr: 3,
  de: 3,
  tr: 3,
};

/**
 * 根据权重随机选择一种语言
 */
function pickRandomLanguage(): string {
  const total = Object.values(LANGUAGE_WEIGHTS).reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (const [lang, weight] of Object.entries(LANGUAGE_WEIGHTS)) {
    rand -= weight;
    if (rand <= 0) return lang;
  }
  return "en"; // fallback
}

/**
 * 从数组中随机选择一个元素
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成一个随机的多语言用户名
 * 格式：根据语言习惯组合名字
 * 有一定概率添加数字后缀（模拟真实用户名）
 */
export function generateBotName(lang?: string): { name: string; nickname: string; language: string } {
  const language = lang || pickRandomLanguage();
  const pool = NAME_POOLS[language] || NAME_POOLS.en;
  
  const firstName = pickRandom(pool.firstNames);
  const lastName = pickRandom(pool.lastNames);
  
  let nickname: string;
  let name: string;
  
  // 根据语言格式组合
  if (pool.format === "last_first") {
    nickname = `${lastName}${firstName}`;
  } else if (pool.format === "single") {
    nickname = firstName;
  } else {
    nickname = `${firstName} ${lastName}`;
  }
  
  // name 用于内部标识（英文化）
  name = nickname;
  
  // 30% 概率添加数字后缀（模拟真实用户名习惯）
  if (Math.random() < 0.30) {
    const suffix = Math.floor(Math.random() * 99) + 1;
    nickname = `${nickname}${suffix}`;
  }
  
  // 15% 概率使用缩写形式（更像真实用户名）
  if (Math.random() < 0.15 && pool.format === "first_last") {
    nickname = `${firstName.charAt(0)}.${lastName}`;
  }
  
  return { name, nickname, language };
}

/**
 * 批量生成多语言用户名
 * 按比例分配各语言
 */
export function generateBotNames(count: number): Array<{ name: string; nickname: string; language: string }> {
  const result: Array<{ name: string; nickname: string; language: string }> = [];
  const usedNicknames = new Set<string>();
  
  // 按比例计算每种语言的数量
  const total = Object.values(LANGUAGE_WEIGHTS).reduce((a, b) => a + b, 0);
  const langCounts: Record<string, number> = {};
  let assigned = 0;
  
  const langs = Object.keys(LANGUAGE_WEIGHTS);
  for (let i = 0; i < langs.length; i++) {
    const lang = langs[i];
    if (i === langs.length - 1) {
      langCounts[lang] = count - assigned; // 最后一个语言取剩余
    } else {
      langCounts[lang] = Math.round((LANGUAGE_WEIGHTS[lang] / total) * count);
      assigned += langCounts[lang];
    }
  }
  
  // 为每种语言生成名字
  for (const [lang, langCount] of Object.entries(langCounts)) {
    for (let i = 0; i < langCount; i++) {
      let attempts = 0;
      let generated: { name: string; nickname: string; language: string };
      do {
        generated = generateBotName(lang);
        attempts++;
      } while (usedNicknames.has(generated.nickname) && attempts < 10);
      
      usedNicknames.add(generated.nickname);
      result.push(generated);
    }
  }
  
  // 打乱顺序
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * 获取语言列表及其权重（用于管理后台展示）
 */
export function getLanguageWeights(): Array<{ code: string; name: string; weight: number }> {
  const langNames: Record<string, string> = {
    en: "English",
    zh: "中文",
    ja: "日本語",
    ko: "한국어",
    ru: "Русский",
    ar: "العربية",
    th: "ไทย",
    vi: "Tiếng Việt",
    id: "Bahasa Indonesia",
    pt: "Português",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    tr: "Türkçe",
  };
  
  return Object.entries(LANGUAGE_WEIGHTS).map(([code, weight]) => ({
    code,
    name: langNames[code] || code,
    weight,
  }));
}
