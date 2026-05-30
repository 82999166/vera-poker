"""
为 ja/ko/es/ru/ar/vi/th/id 在 table.joining 同行后插入两个新键
"""

# 各语言 table.joining 所在行号（已从 grep 获取）
lang_lines = {
    'ja':  (1826, "等待下一手，将自动参与", "该账号已在其他设备上游戏"),
    'ko':  (2239, "다음 핸드를 기다리는 중입니다. 자동으로 참여합니다", "이 계정은 다른 기기에서 이미 게임 중입니다"),
    'es':  (2391, "Esperando la siguiente mano, te unirás automáticamente", "Esta cuenta ya está jugando en otro dispositivo"),
    'ru':  (3027, "Ожидание следующей раздачи, вы присоединитесь автоматически", "Этот аккаунт уже играет на другом устройстве"),
    'ar':  (3440, "في انتظار اليد التالية، ستنضم تلقائياً", "هذا الحساب يلعب بالفعل على جهاز آخر"),
    'vi':  (3853, "Đang chờ ván tiếp theo, bạn sẽ tự động tham gia", "Tài khoản này đang chơi trên thiết bị khác"),
    'th':  (4266, "รอมือถัดไป คุณจะเข้าร่วมโดยอัตโนมัติ", "บัญชีนี้กำลังเล่นอยู่บนอุปกรณ์อื่น"),
    'id':  (4679, "Menunggu tangan berikutnya, Anda akan bergabung secara otomatis", "Akun ini sudah bermain di perangkat lain"),
}

# ja/ko 用正常多行格式
lang_lines_normal = {
    'ja':  (1826, "次のハンドを待っています。自動的に参加します", "このアカウントは別のデバイスでプレイ中です"),
    'ko':  (2239, "다음 핸드를 기다리는 중입니다. 자동으로 참여합니다", "이 계정은 다른 기기에서 이미 게임 중입니다"),
}

with open('client/src/lib/i18n.ts', 'r') as f:
    lines = f.readlines()

# 检查是否已存在
def already_exists(lines, key):
    return any(f'"{key}"' in l for l in lines)

if already_exists(lines, "table.waitingForNextHand"):
    # 只处理还没有的语言
    pass

# 对于 ja（行 1826），在该行后面插入新行
insertions = []  # (line_index_0based, text_to_insert_after)

all_langs = {
    'ja':  (1826, "次のハンドを待っています。自動的に参加します", "このアカウントは別のデバイスでプレイ中です"),
    'ko':  (2239, "다음 핸드를 기다리는 중입니다. 자동으로 참여합니다", "이 계정은 다른 기기에서 이미 게임 중입니다"),
    'es':  (2391, "Esperando la siguiente mano, te unirás automáticamente", "Esta cuenta ya está jugando en otro dispositivo"),
    'ru':  (3027, "Ожидание следующей раздачи, вы присоединитесь автоматически", "Этот аккаунт уже играет на другом устройстве"),
    'ar':  (3440, "في انتظار اليد التالية، ستنضم تلقائياً", "هذا الحساب يلعب بالفعل على جهاز آخر"),
    'vi':  (3853, "Đang chờ ván tiếp theo, bạn sẽ tự động tham gia", "Tài khoản này đang chơi trên thiết bị khác"),
    'th':  (4266, "รอมือถัดไป คุณจะเข้าร่วมโดยอัตโนมัติ", "บัญชีนี้กำลังเล่นอยู่บนอุปกรณ์อื่น"),
    'id':  (4679, "Menunggu tangan berikutnya, Anda akan bergabung secara otomatis", "Akun ini sudah bermain di perangkat lain"),
}

# 收集需要插入的位置（倒序处理避免行号偏移）
insertions = []
for lang, (lineno, w_val, a_val) in all_langs.items():
    # 检查该语言是否已有这个键
    # 找到该语言区块中是否已存在
    line_content = lines[lineno - 1]
    if '"table.waitingForNextHand"' in line_content:
        print(f"{lang}: already has waitingForNextHand in same line, skip")
        continue
    
    # 检查附近 5 行是否已有
    nearby = ''.join(lines[max(0,lineno-3):lineno+3])
    if '"table.waitingForNextHand"' in nearby:
        print(f"{lang}: already has waitingForNextHand nearby, skip")
        continue
    
    insert_line = f'  "table.waitingForNextHand": "{w_val}",\n  "table.alreadySeatedOtherDevice": "{a_val}",\n'
    insertions.append((lineno, insert_line, lang))

# 倒序插入（从后往前，避免行号偏移）
insertions.sort(key=lambda x: x[0], reverse=True)

for lineno, insert_text, lang in insertions:
    lines.insert(lineno, insert_text)
    print(f"{lang}: inserted after line {lineno}")

with open('client/src/lib/i18n.ts', 'w') as f:
    f.writelines(lines)

print("\nDone!")
