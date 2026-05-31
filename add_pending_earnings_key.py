import re

translations = {
    "en": "Pending Commission",
    "zhCN": "待解锁佣金",
    "zhTW": "待解鎖佣金",
    "ja": "保留中の報酬",
    "ko": "대기 중 수수료",
    "es": "Comisión pendiente",
    "pt": "Comissão pendente",
    "ru": "Ожидающая комиссия",
    "ar": "عمولة معلقة",
    "vi": "Hoa hồng chờ",
    "th": "ค่าคอมมิชชั่นรอดำเนินการ",
    "id": "Komisi tertunda",
}

with open("client/src/lib/i18n.ts", "r") as f:
    content = f.read()

for lang, trans in translations.items():
    # Find "agent.pending": "..." and add new key after it
    pattern = r'("agent\.pending": "[^"]*")'
    matches = list(re.finditer(pattern, content))
    
    # We need to find the right occurrence for each language
    # Use the language block markers to identify
    if lang == "en":
        marker = "const en:"
    elif lang == "zhCN":
        marker = "const zhCN:"
    elif lang == "zhTW":
        marker = "const zhTW:"
    elif lang == "ja":
        marker = "const ja:"
    elif lang == "ko":
        marker = "const ko:"
    elif lang == "es":
        marker = "const es:"
    elif lang == "pt":
        marker = "const pt:"
    elif lang == "ru":
        marker = "const ru:"
    elif lang == "ar":
        marker = "const ar:"
    elif lang == "vi":
        marker = "const vi:"
    elif lang == "th":
        marker = "const th:"
    elif lang == "id":
        marker = "const id_:"
    
    # Find the marker position
    marker_pos = content.find(marker)
    if marker_pos == -1:
        print(f"Warning: marker '{marker}' not found for {lang}")
        continue
    
    # Find "agent.pending" after this marker
    search_start = marker_pos
    match = re.search(r'"agent\.pending": "[^"]*"', content[search_start:])
    if match:
        insert_pos = search_start + match.end()
        new_key = f',\n  "agent.pendingEarnings": "{trans}"'
        content = content[:insert_pos] + new_key + content[insert_pos:]
        print(f"Added agent.pendingEarnings for {lang}")
    else:
        print(f"Warning: agent.pending not found for {lang}")

with open("client/src/lib/i18n.ts", "w") as f:
    f.write(content)

print("Done!")
