#!/usr/bin/env python3
"""
i18n.ts 全面审计脚本
- 提取所有语言区块的键
- 对比 en 区块，找出每种语言缺失的键
"""
import re

with open("client/src/lib/i18n.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split("\n")

# 语言区块标识（匹配 "const xx: Record<string, string> = {" 格式）
lang_markers = {
    "en": "const en: Record<string, string>",
    "zhCN": "const zhCN: Record<string, string>",
    "zhTW": "const zhTW: Record<string, string>",
    "ja": "const ja: Record<string, string>",
    "ko": "const ko: Record<string, string>",
    "es": "const es: Record<string, string>",
    "pt": "const pt: Record<string, string>",
    "ru": "const ru: Record<string, string>",
    "ar": "const ar: Record<string, string>",
    "vi": "const vi: Record<string, string>",
    "th": "const th: Record<string, string>",
    "id": "const id: Record<string, string>",
}

# 找到每个语言区块的起始行号
lang_ranges = {}
for lang, marker in lang_markers.items():
    for i, line in enumerate(lines):
        if marker in line:
            lang_ranges[lang] = {"start": i}
            break

# 按起始行排序，确定结束行
sorted_langs = sorted(lang_ranges.items(), key=lambda x: x[1]["start"])
for i, (lang, info) in enumerate(sorted_langs):
    if i + 1 < len(sorted_langs):
        info["end"] = sorted_langs[i + 1][1]["start"] - 1
    else:
        info["end"] = len(lines) - 1

print("语言区块范围:")
for lang, info in sorted_langs:
    print(f"  {lang}: 行 {info['start']+1} - {info['end']+1}")

# 提取每个语言区块的所有键
def extract_keys(lines, start, end):
    block_text = "\n".join(lines[start:end+1])
    # 匹配 "key": 模式（键名含字母、数字、点、下划线）
    pattern = r'"([a-zA-Z][a-zA-Z0-9._]*)"\s*:'
    matches = re.findall(pattern, block_text)
    return matches

lang_keys = {}
for lang, info in lang_ranges.items():
    keys = extract_keys(lines, info["start"], info["end"])
    lang_keys[lang] = set(keys)
    print(f"  {lang}: {len(keys)} 个键")

# 以 en 为基准，找出其他语言缺失的键
en_keys = lang_keys.get("en", set())
print(f"\n=== 以 en 为基准 ({len(en_keys)} 个键) ===\n")

missing_summary = {}
all_langs = ["zhCN", "zhTW", "ja", "ko", "es", "pt", "ru", "ar", "vi", "th", "id"]
for lang in all_langs:
    if lang not in lang_keys:
        print(f"{lang}: 未找到区块!")
        continue
    missing = en_keys - lang_keys[lang]
    extra = lang_keys[lang] - en_keys
    missing_summary[lang] = sorted(missing)
    if missing:
        print(f"{lang} 缺失 {len(missing)} 个键:")
        for k in sorted(missing):
            print(f"  - {k}")
    else:
        print(f"{lang}: 完整 ✓")
    if extra:
        print(f"  (额外有 {len(extra)} 个键不在 en 中)")

# 汇总
print("\n\n=== 缺失键汇总（按键名） ===")
all_missing_keys = set()
for lang, keys in missing_summary.items():
    all_missing_keys.update(keys)

print(f"共有 {len(all_missing_keys)} 个键在至少一种语言中缺失:")
for key in sorted(all_missing_keys):
    missing_in = [lang for lang, keys in missing_summary.items() if key in keys]
    print(f"  {key}: 缺失于 {', '.join(missing_in)}")
