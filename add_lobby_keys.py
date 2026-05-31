#!/usr/bin/env python3
"""Add lobby.playersOnline and lobby.findingTable to all language blocks."""

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []

# Translations per occurrence of "lobby.players" (0=en already done, 1=zhCN, 2=zhTW, etc.)
lang_translations = {
    1: [  # zhCN
        '  "lobby.playersOnline": "人在线",',
        '  "lobby.findingTable": "正在寻找桌子...",',
    ],
    2: [  # zhTW
        '  "lobby.playersOnline": "人在線",',
        '  "lobby.findingTable": "正在尋找桌子...",',
    ],
    3: [  # ja
        '  "lobby.playersOnline": "人オンライン",',
        '  "lobby.findingTable": "テーブルを探しています...",',
    ],
    4: [  # ko
        '  "lobby.playersOnline": "명 온라인",',
        '  "lobby.findingTable": "테이블을 찾는 중...",',
    ],
    5: [  # es
        '  "lobby.playersOnline": "en línea",',
        '  "lobby.findingTable": "Buscando mesa...",',
    ],
    6: [  # pt
        '  "lobby.playersOnline": "online",',
        '  "lobby.findingTable": "Procurando mesa...",',
    ],
    7: [  # ru
        '  "lobby.playersOnline": "онлайн",',
        '  "lobby.findingTable": "Поиск стола...",',
    ],
    8: [  # ar
        '  "lobby.playersOnline": "متصل",',
        '  "lobby.findingTable": "جاري البحث عن طاولة...",',
    ],
    9: [  # vi
        '  "lobby.playersOnline": "đang chơi",',
        '  "lobby.findingTable": "Đang tìm bàn...",',
    ],
    10: [  # th
        '  "lobby.playersOnline": "ออนไลน์",',
        '  "lobby.findingTable": "กำลังหาโต๊ะ...",',
    ],
    11: [  # id
        '  "lobby.playersOnline": "online",',
        '  "lobby.findingTable": "Mencari meja...",',
    ],
}

count = 0
for line in lines:
    new_lines.append(line)
    if '"lobby.players"' in line:
        count += 1
        if count - 1 in lang_translations:
            for trans_line in lang_translations[count - 1]:
                new_lines.append(trans_line)

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f"Done! Added lobby keys to {count - 1} language blocks.")
