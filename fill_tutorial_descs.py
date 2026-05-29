"""
批量为 es/pt/ru/ar/vi/th/id 补充缺失的 15 个 tutorial.*Desc 键
"""

# 缺失的 15 个键及其各语言翻译
translations = {
    "tutorial.rank1Desc": {
        "es": "A, K, Q, J, 10 del mismo palo",
        "pt": "A, K, Q, J, 10 do mesmo naipe",
        "ru": "A, K, Q, J, 10 одной масти",
        "ar": "A, K, Q, J, 10 من نفس اللون",
        "vi": "A, K, Q, J, 10 cùng chất",
        "th": "A, K, Q, J, 10 ไพ่ดอกเดียวกัน",
        "id": "A, K, Q, J, 10 dengan jenis yang sama",
    },
    "tutorial.rank2Desc": {
        "es": "Cinco cartas consecutivas del mismo palo",
        "pt": "Cinco cartas consecutivas do mesmo naipe",
        "ru": "Пять последовательных карт одной масти",
        "ar": "خمس بطاقات متتالية من نفس اللون",
        "vi": "Năm lá bài liên tiếp cùng chất",
        "th": "ไพ่ห้าใบเรียงกันดอกเดียวกัน",
        "id": "Lima kartu berurutan dengan jenis yang sama",
    },
    "tutorial.rank3Desc": {
        "es": "Cuatro cartas del mismo valor + cualquier carta",
        "pt": "Quatro cartas do mesmo valor + qualquer carta",
        "ru": "Четыре карты одного достоинства + любая карта",
        "ar": "أربع بطاقات من نفس الرتبة + أي بطاقة",
        "vi": "Bốn lá bài cùng giá trị + bất kỳ lá nào",
        "th": "ไพ่สี่ใบค่าเดียวกัน + ไพ่ใดก็ได้",
        "id": "Empat kartu dengan nilai yang sama + kartu apapun",
    },
    "tutorial.rank4Desc": {
        "es": "Trío + par",
        "pt": "Trinca + par",
        "ru": "Тройка + пара",
        "ar": "ثلاثة أوراق متشابهة + زوج",
        "vi": "Ba lá cùng giá trị + một đôi",
        "th": "ไพ่สามใบค่าเดียวกัน + คู่",
        "id": "Tiga kartu sama + sepasang kartu",
    },
    "tutorial.rank5Desc": {
        "es": "Cinco cartas del mismo palo, no consecutivas",
        "pt": "Cinco cartas do mesmo naipe, não consecutivas",
        "ru": "Пять карт одной масти, не последовательных",
        "ar": "خمس بطاقات من نفس اللون، غير متتالية",
        "vi": "Năm lá bài cùng chất, không liên tiếp",
        "th": "ไพ่ห้าใบดอกเดียวกัน ไม่เรียงกัน",
        "id": "Lima kartu dengan jenis yang sama, tidak berurutan",
    },
    "tutorial.rank6Desc": {
        "es": "Cinco cartas consecutivas de diferentes palos",
        "pt": "Cinco cartas consecutivas de naipes diferentes",
        "ru": "Пять последовательных карт разных мастей",
        "ar": "خمس بطاقات متتالية من ألوان مختلفة",
        "vi": "Năm lá bài liên tiếp khác chất",
        "th": "ไพ่ห้าใบเรียงกันต่างดอก",
        "id": "Lima kartu berurutan dengan jenis berbeda",
    },
    "tutorial.rank7Desc": {
        "es": "Tres cartas del mismo valor + dos diferentes",
        "pt": "Três cartas do mesmo valor + duas diferentes",
        "ru": "Три карты одного достоинства + две другие",
        "ar": "ثلاث بطاقات من نفس الرتبة + بطاقتان أخريان",
        "vi": "Ba lá cùng giá trị + hai lá khác",
        "th": "ไพ่สามใบค่าเดียวกัน + ไพ่อีกสองใบ",
        "id": "Tiga kartu dengan nilai yang sama + dua kartu lain",
    },
    "tutorial.rank8Desc": {
        "es": "Dos pares diferentes + una carta",
        "pt": "Dois pares diferentes + uma carta",
        "ru": "Две разные пары + одна карта",
        "ar": "زوجان مختلفان + بطاقة واحدة",
        "vi": "Hai đôi khác nhau + một lá bài",
        "th": "สองคู่ต่างกัน + ไพ่หนึ่งใบ",
        "id": "Dua pasang berbeda + satu kartu",
    },
    "tutorial.rank9Desc": {
        "es": "Un par + tres cartas diferentes",
        "pt": "Um par + três cartas diferentes",
        "ru": "Одна пара + три другие карты",
        "ar": "زوج واحد + ثلاث بطاقات أخرى",
        "vi": "Một đôi + ba lá bài khác",
        "th": "หนึ่งคู่ + ไพ่อีกสามใบ",
        "id": "Satu pasang + tiga kartu lain",
    },
    "tutorial.rank10Desc": {
        "es": "Sin combinación — la carta más alta juega",
        "pt": "Sem combinação — a carta mais alta joga",
        "ru": "Нет комбинации — играет старшая карта",
        "ar": "لا توجد تركيبة — أعلى بطاقة تلعب",
        "vi": "Không có bộ bài — lá bài cao nhất thắng",
        "th": "ไม่มีการจัดเรียง — ไพ่ที่สูงที่สุดชนะ",
        "id": "Tidak ada kombinasi — kartu tertinggi yang bermain",
    },
    "tutorial.flow1Desc": {
        "es": "Cada jugador recibe 2 cartas. Las apuestas comienzan a la izquierda del dealer.",
        "pt": "Cada jogador recebe 2 cartas. As apostas começam à esquerda do dealer.",
        "ru": "Каждый игрок получает 2 карты. Торговля начинается слева от дилера.",
        "ar": "يحصل كل لاعب على ورقتين. يبدأ الرهان على يسار الموزع.",
        "vi": "Mỗi người chơi nhận 2 lá bài. Đặt cược bắt đầu từ bên trái dealer.",
        "th": "ผู้เล่นแต่ละคนได้รับไพ่ 2 ใบ การเดิมพันเริ่มจากทางซ้ายของดีลเลอร์",
        "id": "Setiap pemain menerima 2 kartu. Taruhan dimulai dari kiri dealer.",
    },
    "tutorial.flow2Desc": {
        "es": "Se revelan 3 cartas comunitarias. Primera ronda de apuestas.",
        "pt": "3 cartas comunitárias são reveladas. Primeira rodada de apostas.",
        "ru": "Открываются 3 общие карты. Первый круг торговли.",
        "ar": "يتم الكشف عن 3 بطاقات مجتمعية. جولة الرهان الأولى.",
        "vi": "3 lá bài cộng đồng được lật. Vòng đặt cược đầu tiên.",
        "th": "เปิดไพ่กลาง 3 ใบ รอบการเดิมพันแรก",
        "id": "3 kartu komunitas diungkapkan. Ronde taruhan pertama.",
    },
    "tutorial.flow3Desc": {
        "es": "Se revela la 4ª carta comunitaria. Segunda ronda de apuestas.",
        "pt": "4ª carta comunitária revelada. Segunda rodada de apostas.",
        "ru": "Открывается 4-я общая карта. Второй круг торговли.",
        "ar": "يتم الكشف عن البطاقة المجتمعية الرابعة. جولة الرهان الثانية.",
        "vi": "Lá bài cộng đồng thứ 4 được lật. Vòng đặt cược thứ hai.",
        "th": "เปิดไพ่กลางใบที่ 4 รอบการเดิมพันที่สอง",
        "id": "Kartu komunitas ke-4 diungkapkan. Ronde taruhan kedua.",
    },
    "tutorial.flow4Desc": {
        "es": "5ª y última carta comunitaria. Última ronda de apuestas.",
        "pt": "5ª e última carta comunitária. Última rodada de apostas.",
        "ru": "5-я и последняя общая карта. Последний круг торговли.",
        "ar": "البطاقة المجتمعية الخامسة والأخيرة. جولة الرهان الأخيرة.",
        "vi": "Lá bài cộng đồng thứ 5 và cuối cùng. Vòng đặt cược cuối.",
        "th": "ไพ่กลางใบที่ 5 และใบสุดท้าย รอบการเดิมพันสุดท้าย",
        "id": "Kartu komunitas ke-5 dan terakhir. Ronde taruhan terakhir.",
    },
    "tutorial.flow5Desc": {
        "es": "Los jugadores restantes revelan sus manos. La mejor mano de 5 cartas gana.",
        "pt": "Os jogadores restantes revelam suas mãos. A melhor mão de 5 cartas vence.",
        "ru": "Оставшиеся игроки открывают карты. Лучшая комбинация из 5 карт побеждает.",
        "ar": "يكشف اللاعبون المتبقون عن أوراقهم. أفضل يد من 5 بطاقات تفوز.",
        "vi": "Người chơi còn lại lật bài. Bộ bài 5 lá tốt nhất thắng.",
        "th": "ผู้เล่นที่เหลือเปิดไพ่ บือมือที่ดีที่สุด 5 ใบชนะ",
        "id": "Pemain yang tersisa mengungkapkan kartu. Tangan 5 kartu terbaik menang.",
    },
}

# 读取文件
with open('client/src/lib/i18n.ts', 'r') as f:
    content = f.read()

# 语言区块结束位置（找到每个语言区块中最后一个键后面插入）
# 对每种语言，找到 tutorial.rank10 或 tutorial.flow5Title 后面插入缺失的键
langs = ['es', 'pt', 'ru', 'ar', 'vi', 'th', 'id']

for lang in langs:
    # 找到该语言区块中 tutorial.flow5Title 的位置，在其后插入缺失的键
    # 先找 tutorial.rank10 的位置
    
    # 构建要插入的文本
    missing_keys = []
    for key in [
        "tutorial.rank1Desc", "tutorial.rank2Desc", "tutorial.rank3Desc",
        "tutorial.rank4Desc", "tutorial.rank5Desc", "tutorial.rank6Desc",
        "tutorial.rank7Desc", "tutorial.rank8Desc", "tutorial.rank9Desc",
        "tutorial.rank10Desc", "tutorial.flow1Desc", "tutorial.flow2Desc",
        "tutorial.flow3Desc", "tutorial.flow4Desc", "tutorial.flow5Desc",
    ]:
        # 检查是否已存在
        if f'"{key}"' not in content[content.find(f'const {lang}'):content.find(f'const {lang}') + 50000]:
            val = translations[key][lang]
            missing_keys.append(f'  "{key}": "{val}",')
    
    if not missing_keys:
        print(f"{lang}: no missing keys")
        continue
    
    # 找到该语言区块中 tutorial.rank10 的行，在其后插入
    # 先找到 tutorial.flow5Title 在该语言区块中的位置
    lang_start = content.find(f'const {lang}')
    lang_end = content.find('\nconst ', lang_start + 1)
    if lang_end == -1:
        lang_end = len(content)
    
    lang_block = content[lang_start:lang_end]
    
    # 找到 tutorial.rank10 的位置（在该语言区块内）
    insert_after = '"tutorial.rank10"'
    pos_in_block = lang_block.find(insert_after)
    if pos_in_block == -1:
        # 尝试 tutorial.flow5Title
        insert_after = '"tutorial.flow5Title"'
        pos_in_block = lang_block.find(insert_after)
    
    if pos_in_block == -1:
        print(f"{lang}: could not find insertion point")
        continue
    
    # 找到该行的结束位置
    line_end = lang_block.find('\n', pos_in_block)
    if line_end == -1:
        line_end = len(lang_block)
    
    insert_pos = lang_start + line_end
    
    insert_text = '\n' + '\n'.join(missing_keys)
    content = content[:insert_pos] + insert_text + content[insert_pos:]
    print(f"{lang}: inserted {len(missing_keys)} keys after position {insert_pos}")

with open('client/src/lib/i18n.ts', 'w') as f:
    f.write(content)

print("\nDone!")
