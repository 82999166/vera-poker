#!/usr/bin/env python3
"""Add table.waitingForNextHand, table.alreadySeatedOtherDevice, table.waitingBigBlind to all languages."""

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find all occurrences of "table.joining" and insert after them
translations = {
    'zhCN': ('"table.joining": "入座中...",', [
        '  "table.waitingForNextHand": "等待下一局开始，将自动参与",',
        '  "table.alreadySeatedOtherDevice": "该账号已在其他设备上游戏，请勿重复入座",',
        '  "table.waitingBigBlind": "等待大盲",',
    ]),
    'zhTW': ('"table.joining": "入座中...",', [
        '  "table.waitingForNextHand": "等待下一局開始，將自動參與",',
        '  "table.alreadySeatedOtherDevice": "該帳號已在其他裝置上遊戲，請勿重複入座",',
        '  "table.waitingBigBlind": "等待大盲",',
    ]),
}

# For ja/ko and compact languages, need different approach
# First let's handle zhCN and zhTW which have multi-line format

lines = content.split('\n')
new_lines = []
# Track which "table.joining" occurrence we're at
joining_count = 0

# We already added to en (occurrence 0), so skip it
# Occurrence 1 = zhCN (line ~605), Occurrence 2 = zhTW (line ~1447)
# For ja/ko/es/pt/ru/ar/vi/th/id we need to find their table.joining lines

lang_translations = {
    1: [  # zhCN
        '  "table.waitingForNextHand": "等待下一局开始，将自动参与",',
        '  "table.alreadySeatedOtherDevice": "该账号已在其他设备上游戏，请勿重复入座",',
        '  "table.waitingBigBlind": "等待大盲",',
    ],
    2: [  # zhTW
        '  "table.waitingForNextHand": "等待下一局開始，將自動參與",',
        '  "table.alreadySeatedOtherDevice": "該帳號已在其他裝置上遊戲，請勿重複入座",',
        '  "table.waitingBigBlind": "等待大盲",',
    ],
    3: [  # ja
        '  "table.waitingForNextHand": "次のハンドを待っています、自動参加します",',
        '  "table.alreadySeatedOtherDevice": "このアカウントは別のデバイスでプレイ中です",',
        '  "table.waitingBigBlind": "ビッグブラインド待ち",',
    ],
    4: [  # ko
        '  "table.waitingForNextHand": "다음 핸드를 기다리는 중, 자동 참여합니다",',
        '  "table.alreadySeatedOtherDevice": "이 계정은 다른 기기에서 이미 플레이 중입니다",',
        '  "table.waitingBigBlind": "빅 블라인드 대기 중",',
    ],
    5: [  # es
        '  "table.waitingForNextHand": "Esperando la próxima mano, se unirá automáticamente",',
        '  "table.alreadySeatedOtherDevice": "Esta cuenta ya está jugando en otro dispositivo",',
        '  "table.waitingBigBlind": "Esperando ciega grande",',
    ],
    6: [  # pt
        '  "table.waitingForNextHand": "Aguardando próxima mão, entrará automaticamente",',
        '  "table.alreadySeatedOtherDevice": "Esta conta já está jogando em outro dispositivo",',
        '  "table.waitingBigBlind": "Aguardando big blind",',
    ],
    7: [  # ru
        '  "table.waitingForNextHand": "Ожидание следующей раздачи, автоматическое присоединение",',
        '  "table.alreadySeatedOtherDevice": "Этот аккаунт уже играет на другом устройстве",',
        '  "table.waitingBigBlind": "Ожидание большого блайнда",',
    ],
    8: [  # ar
        '  "table.waitingForNextHand": "في انتظار الجولة التالية، سيتم الانضمام تلقائياً",',
        '  "table.alreadySeatedOtherDevice": "هذا الحساب يلعب بالفعل على جهاز آخر",',
        '  "table.waitingBigBlind": "في انتظار البلايند الكبير",',
    ],
    9: [  # vi
        '  "table.waitingForNextHand": "Đang chờ ván tiếp theo, sẽ tự động tham gia",',
        '  "table.alreadySeatedOtherDevice": "Tài khoản này đang chơi trên thiết bị khác",',
        '  "table.waitingBigBlind": "Đang chờ big blind",',
    ],
    10: [  # th
        '  "table.waitingForNextHand": "รอมือถัดไป จะเข้าร่วมอัตโนมัติ",',
        '  "table.alreadySeatedOtherDevice": "บัญชีนี้กำลังเล่นอยู่บนอุปกรณ์อื่น",',
        '  "table.waitingBigBlind": "รอบิ๊กไบลด์",',
    ],
    11: [  # id
        '  "table.waitingForNextHand": "Menunggu tangan berikutnya, akan bergabung otomatis",',
        '  "table.alreadySeatedOtherDevice": "Akun ini sudah bermain di perangkat lain",',
        '  "table.waitingBigBlind": "Menunggu big blind",',
    ],
}

for i, line in enumerate(lines):
    new_lines.append(line)
    if '"table.joining"' in line:
        joining_count += 1
        # Skip en (already added manually as occurrence 0 which is joining_count=1)
        if joining_count > 1 and joining_count - 1 in lang_translations:
            for trans_line in lang_translations[joining_count - 1]:
                new_lines.append(trans_line)

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f"Done! Added table keys to {joining_count - 1} language blocks.")
