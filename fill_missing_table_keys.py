"""
为所有语言添加 table.waitingForNextHand 和 table.alreadySeatedOtherDevice 键
插入到 table.joining 键的后面
"""

translations = {
    "table.waitingForNextHand": {
        "zhCN": "等待下一局开始，将自动参与",
        "zhTW": "等待下一局開始，將自動參與",
        "ja": "次のハンドを待っています。自動的に参加します",
        "ko": "다음 핸드를 기다리는 중입니다. 자동으로 참여합니다",
        "es": "Esperando la siguiente mano, te unirás automáticamente",
        "pt": "Aguardando a próxima mão, você entrará automaticamente",
        "ru": "Ожидание следующей раздачи, вы присоединитесь автоматически",
        "ar": "في انتظار اليد التالية، ستنضم تلقائياً",
        "vi": "Đang chờ ván tiếp theo, bạn sẽ tự động tham gia",
        "th": "รอมือถัดไป คุณจะเข้าร่วมโดยอัตโนมัติ",
        "id": "Menunggu tangan berikutnya, Anda akan bergabung secara otomatis",
    },
    "table.alreadySeatedOtherDevice": {
        "zhCN": "该账号已在其他设备上游戏，请勿重复入座",
        "zhTW": "該帳號已在其他裝置上遊戲，請勿重複入座",
        "ja": "このアカウントは別のデバイスでプレイ中です",
        "ko": "이 계정은 다른 기기에서 이미 게임 중입니다",
        "es": "Esta cuenta ya está jugando en otro dispositivo",
        "pt": "Esta conta já está jogando em outro dispositivo",
        "ru": "Этот аккаунт уже играет на другом устройстве",
        "ar": "هذا الحساب يلعب بالفعل على جهاز آخر",
        "vi": "Tài khoản này đang chơi trên thiết bị khác",
        "th": "บัญชีนี้กำลังเล่นอยู่บนอุปกรณ์อื่น",
        "id": "Akun ini sudah bermain di perangkat lain",
    },
}

# 语言区块的起始行号
lang_starts = {
    'zhCN': 526, 'zhTW': 1012, 'ja': 1495, 'ko': 1908,
    'es': 2321, 'pt': 2547, 'ru': 2960, 'ar': 3373, 'vi': 3786, 'th': 4199, 'id': 4612
}

with open('client/src/lib/i18n.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')

def find_key_line(lang_start, key):
    """在语言区块中找到指定键的行号（1-indexed）"""
    depth = 0
    started = False
    for i, line in enumerate(lines[lang_start-1:], start=lang_start):
        if '{' in line:
            depth += line.count('{')
            started = True
        if '}' in line:
            depth -= line.count('}')
        if started and depth <= 0:
            break
        if f'"{key}"' in line:
            return i
    return -1

import re

for lang, start in lang_starts.items():
    # 找到 table.joining 的行
    joining_line = find_key_line(start, "table.joining")
    if joining_line == -1:
        print(f"{lang}: could not find table.joining")
        continue
    
    # 检查 table.waitingForNextHand 是否已存在
    waiting_line = find_key_line(start, "table.waitingForNextHand")
    if waiting_line != -1:
        print(f"{lang}: table.waitingForNextHand already exists at line {waiting_line}")
        continue
    
    # 找到 table.joining 行的结束位置
    joining_content = lines[joining_line - 1]
    
    # 构建插入文本
    w_val = translations["table.waitingForNextHand"][lang]
    a_val = translations["table.alreadySeatedOtherDevice"][lang]
    insert_text = f'\n  "table.waitingForNextHand": "{w_val}",\n  "table.alreadySeatedOtherDevice": "{a_val}",'
    
    # 找到该行在 content 中的位置
    # 通过行号精确定位
    line_start_pos = sum(len(l) + 1 for l in lines[:joining_line-1])
    line_end_pos = line_start_pos + len(lines[joining_line-1])
    
    content = content[:line_end_pos] + insert_text + content[line_end_pos:]
    # 重新分割（因为 content 已改变）
    lines = content.split('\n')
    
    print(f"{lang}: inserted after line {joining_line}")

with open('client/src/lib/i18n.ts', 'w') as f:
    f.write(content)

print("\nDone!")
