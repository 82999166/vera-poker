#!/usr/bin/env python3
"""Generate 1000 internet-style nicknames for poker bots."""
import random
import json

# Internet-style nickname components
prefixes = [
    "Dark", "Shadow", "Lucky", "Crazy", "Cool", "Fire", "Ice", "Storm", "Night", "Star",
    "Wild", "Mega", "Ultra", "Neo", "Cyber", "Pixel", "Turbo", "Flash", "Thunder", "Blaze",
    "Ace", "King", "Royal", "Golden", "Silver", "Iron", "Steel", "Ninja", "Ghost", "Phantom",
    "Cosmic", "Atomic", "Rapid", "Swift", "Silent", "Mystic", "Magic", "Power", "Super", "Hyper",
    "Pro", "Elite", "Alpha", "Omega", "Delta", "Sigma", "Beta", "Gamma", "Zen", "Nova",
    "Crypto", "Degen", "Moon", "Rocket", "Diamond", "Whale", "Shark", "Wolf", "Eagle", "Tiger",
    "Dragon", "Phoenix", "Viper", "Cobra", "Hawk", "Fox", "Bear", "Lion", "Panther", "Jaguar",
    "Neon", "Volt", "Spark", "Flame", "Frost", "Blitz", "Fury", "Rage", "Chaos", "Doom",
]

suffixes = [
    "Player", "Gamer", "Master", "King", "Lord", "Boss", "Pro", "God", "Hero", "Legend",
    "Ace", "Star", "Killer", "Hunter", "Rider", "Runner", "Walker", "Fighter", "Warrior", "Knight",
    "X", "Z", "7", "99", "88", "66", "77", "007", "420", "69",
    "YT", "TV", "GG", "OP", "FTW", "MVP", "VIP", "OG", "XD", "LOL",
]

# Common internet nickname patterns
patterns_en = [
    # prefix + number
    lambda: random.choice(prefixes) + str(random.randint(1, 9999)),
    # prefix + suffix
    lambda: random.choice(prefixes) + random.choice(suffixes),
    # prefix + underscore + number
    lambda: random.choice(prefixes) + "_" + str(random.randint(1, 999)),
    # all lowercase with numbers
    lambda: random.choice(prefixes).lower() + str(random.randint(10, 9999)),
    # xXx style
    lambda: "x" + random.choice(prefixes) + "x",
    # prefix + random 2-3 letters
    lambda: random.choice(prefixes) + "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=random.randint(2, 3))),
]

# Chinese internet nickname components
cn_prefixes = [
    "小", "大", "老", "阿", "暴走的", "快乐的", "孤独的", "沉默的", "疯狂的", "佛系",
    "咸鱼", "摸鱼", "划水", "躺平", "内卷", "社恐", "社牛", "干饭", "摆烂", "卷王",
    "深夜", "凌晨", "午夜", "黎明", "黄昏", "清晨", "夜行", "追风", "逐梦", "破晓",
]

cn_suffixes = [
    "大佬", "菜鸡", "选手", "高手", "萌新", "老鸟", "大神", "小白", "达人", "玩家",
    "少年", "青年", "骑士", "勇者", "侠客", "浪子", "游侠", "行者", "隐士", "散人",
]

cn_nouns = [
    "德州", "扑克", "梭哈", "All-in", "加注", "跟注", "过牌", "诈唬", "坚果", "暗三",
    "同花", "顺子", "葫芦", "铁支", "皇家", "对子", "三条", "两对", "高牌", "底池",
    "筹码", "盲注", "翻牌", "转牌", "河牌", "起手", "位置", "按钮", "枪口", "大盲",
]

cn_animals = [
    "猫", "狗", "鱼", "鸟", "兔", "鹿", "狼", "虎", "龙", "凤",
    "鲨", "鲸", "鹰", "蛇", "狐", "熊", "豹", "马", "牛", "羊",
]

cn_patterns = [
    # prefix + animal + number
    lambda: random.choice(cn_prefixes) + random.choice(cn_animals) + str(random.randint(1, 99)),
    # prefix + noun
    lambda: random.choice(cn_prefixes) + random.choice(cn_nouns),
    # noun + suffix
    lambda: random.choice(cn_nouns) + random.choice(cn_suffixes),
    # prefix + suffix
    lambda: random.choice(cn_prefixes) + random.choice(cn_suffixes),
    # animal + number
    lambda: random.choice(cn_animals) + random.choice(cn_animals) + str(random.randint(1, 999)),
    # internet slang style
    lambda: random.choice(cn_prefixes) + random.choice(cn_animals),
]

# Mixed style (English + numbers, common in TG)
tg_words = [
    "poker", "hold", "texas", "chips", "allin", "bluff", "flush", "straight", "pair", "fold",
    "bet", "raise", "call", "check", "river", "flop", "turn", "nuts", "fish", "shark",
    "degen", "moon", "hodl", "ape", "whale", "bull", "bear", "pump", "dump", "gem",
    "chad", "based", "fomo", "yolo", "wagmi", "ngmi", "gm", "ser", "anon", "fren",
]

tg_patterns = [
    # word + numbers
    lambda: random.choice(tg_words) + str(random.randint(1, 9999)),
    # Word_Word
    lambda: random.choice(tg_words).capitalize() + "_" + random.choice(tg_words).capitalize(),
    # word + word (camelCase)
    lambda: random.choice(tg_words) + random.choice(tg_words).capitalize(),
    # @username style
    lambda: random.choice(tg_words) + random.choice(["_", "."]) + random.choice(tg_words) + str(random.randint(1, 99)),
]

# Generate 1000 unique nicknames
nicknames = set()
attempts = 0
max_attempts = 10000

while len(nicknames) < 1000 and attempts < max_attempts:
    attempts += 1
    r = random.random()
    if r < 0.35:
        # 35% English internet style
        name = random.choice(patterns_en)()
    elif r < 0.65:
        # 30% Chinese internet style
        name = random.choice(cn_patterns)()
    else:
        # 35% TG/crypto style
        name = random.choice(tg_patterns)()
    
    # Ensure reasonable length
    if 2 <= len(name) <= 16:
        nicknames.add(name)

nicknames = list(nicknames)[:1000]
random.shuffle(nicknames)

# Output as JSON
print(json.dumps(nicknames, ensure_ascii=False, indent=None))
