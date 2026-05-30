"""
为所有语言添加备用密码相关的 4 个翻译键
"""

translations = {
    "profile.backupPasswordSetSuccess": {
        "zhCN": "备用密码设置成功",
        "zhTW": "備用密碼設置成功",
        "ja": "バックアップパスワードが正常に設定されました",
        "ko": "백업 비밀번호가 성공적으로 설정되었습니다",
        "es": "Contraseña de respaldo establecida correctamente",
        "pt": "Senha de backup definida com sucesso",
        "ru": "Резервный пароль успешно установлен",
        "ar": "تم تعيين كلمة المرور الاحتياطية بنجاح",
        "vi": "Mật khẩu sao lưu đã được đặt thành công",
        "th": "ตั้งค่ารหัสผ่านสำรองสำเร็จ",
        "id": "Kata sandi cadangan berhasil ditetapkan",
    },
    "profile.backupPasswordRemoved": {
        "zhCN": "备用密码已移除",
        "zhTW": "備用密碼已移除",
        "ja": "バックアップパスワードが削除されました",
        "ko": "백업 비밀번호가 제거되었습니다",
        "es": "Contraseña de respaldo eliminada",
        "pt": "Senha de backup removida",
        "ru": "Резервный пароль удален",
        "ar": "تم حذف كلمة المرور الاحتياطية",
        "vi": "Mật khẩu sao lưu đã bị xóa",
        "th": "ลบรหัสผ่านสำรองแล้ว",
        "id": "Kata sandi cadangan telah dihapus",
    },
    "profile.passwordMinLength": {
        "zhCN": "密码至少6位",
        "zhTW": "密碼至少6位",
        "ja": "パスワードは最低6文字である必要があります",
        "ko": "비밀번호는 최소 6자 이상이어야 합니다",
        "es": "La contraseña debe tener al menos 6 caracteres",
        "pt": "A senha deve ter pelo menos 6 caracteres",
        "ru": "Пароль должен содержать минимум 6 символов",
        "ar": "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
        "vi": "Mật khẩu phải có ít nhất 6 ký tự",
        "th": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        "id": "Kata sandi harus memiliki minimal 6 karakter",
    },
    "profile.passwordMismatch": {
        "zhCN": "两次密码不一致",
        "zhTW": "兩次密碼不一致",
        "ja": "パスワードが一致しません",
        "ko": "비밀번호가 일치하지 않습니다",
        "es": "Las contraseñas no coinciden",
        "pt": "As senhas não correspondem",
        "ru": "Пароли не совпадают",
        "ar": "كلمات المرور غير متطابقة",
        "vi": "Mật khẩu không khớp",
        "th": "รหัสผ่านไม่ตรงกัน",
        "id": "Kata sandi tidak cocok",
    },
}

# 语言区块的起始行号
lang_starts = {
    'zhCN': 526, 'zhTW': 1012, 'ja': 1495, 'ko': 1908,
    'es': 2321, 'pt': 2547, 'ru': 2960, 'ar': 3373, 'vi': 3786, 'th': 4199, 'id': 4612
}

with open('client/src/lib/i18n.ts', 'r') as f:
    lines = f.readlines()

# 找到 profile.language 在各语言中的行号
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

# 收集需要插入的位置（倒序处理避免行号偏移）
insertions = []
for lang, start in lang_starts.items():
    # 找到 profile.language 的行
    lang_line = find_key_line(start, "profile.language")
    if lang_line == -1:
        print(f"{lang}: could not find profile.language")
        continue
    
    # 检查是否已有这些键
    nearby = ''.join(lines[max(0,lang_line-2):lang_line+5])
    if '"profile.backupPasswordSetSuccess"' in nearby:
        print(f"{lang}: already has password keys, skip")
        continue
    
    # 构建插入文本
    insert_lines = []
    for key in ["profile.backupPasswordSetSuccess", "profile.backupPasswordRemoved", 
                "profile.passwordMinLength", "profile.passwordMismatch"]:
        val = translations[key][lang]
        insert_lines.append(f'  "{key}": "{val}",\n')
    
    insert_text = ''.join(insert_lines)
    insertions.append((lang_line, insert_text, lang))

# 倒序插入（从后往前，避免行号偏移）
insertions.sort(key=lambda x: x[0], reverse=True)

for lineno, insert_text, lang in insertions:
    # 在该行之后插入
    lines.insert(lineno, insert_text)
    print(f"{lang}: inserted after line {lineno}")

with open('client/src/lib/i18n.ts', 'w') as f:
    f.writelines(lines)

print("\nDone!")
