"""
更精确的 tutorial.* 键审计，支持同行多键格式
"""
import re

with open('client/src/lib/i18n.ts', 'r') as f:
    content = f.read()

lang_starts = {
    'en': 37, 'zhCN': 524, 'zhTW': 1008, 'ja': 1491, 'ko': 1904,
    'es': 2317, 'pt': 2541, 'ru': 2954, 'ar': 3367, 'vi': 3780, 'th': 4193, 'id': 4606
}

lines = content.split('\n')

def extract_all_keys_from_block(start_line):
    """从指定行开始提取到该区块结束的所有键（支持同行多键）"""
    keys = {}
    depth = 0
    started = False
    for i, line in enumerate(lines[start_line-1:], start=start_line):
        if '{' in line:
            depth += line.count('{')
            started = True
        if '}' in line:
            depth -= line.count('}')
        if started and depth <= 0:
            break
        # 提取所有键值对（支持同行多个）
        for m in re.finditer(r'"([^"]+)"\s*:\s*"([^"]*)"', line):
            keys[m.group(1)] = m.group(2)
    return keys

# 提取所有语言的键
all_keys = {}
for lang, start in lang_starts.items():
    all_keys[lang] = extract_all_keys_from_block(start)

en_tutorial = {k: v for k, v in all_keys['en'].items() if k.startswith('tutorial.')}
print(f"EN has {len(en_tutorial)} tutorial.* keys")

print()
print("=" * 60)
print("Coverage per language:")
langs = ['zhCN', 'zhTW', 'ja', 'ko', 'es', 'pt', 'ru', 'ar', 'vi', 'th', 'id']
all_complete = True
for lang in langs:
    lang_keys = all_keys[lang]
    lang_tutorial = {k: v for k, v in lang_keys.items() if k.startswith('tutorial.')}
    missing = [k for k in en_tutorial if k not in lang_tutorial]
    status = "✓ Complete" if not missing else f"MISSING {len(missing)} keys"
    print(f"{lang}: {len(lang_tutorial)}/{len(en_tutorial)} - {status}")
    if missing:
        all_complete = False
        for k in missing:
            print(f"  - {k}")

print()
if all_complete:
    print("✓ ALL LANGUAGES HAVE COMPLETE tutorial.* COVERAGE!")
else:
    print("✗ Some languages have missing tutorial.* keys")
