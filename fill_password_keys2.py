"""
直接按行号在 profile.language 后插入备用密码相关的 4 个翻译键
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

# 各语言 profile.language 所在行号（已从 grep 获取）
lang_lines = {
    'en':   271,
    'zhCN': 766,
    'zhTW': 1231,
    'ja':   1699,
    'ko':   2114,
    'es':   2457,
    'pt':   2914,
    'ru':   3329,
    'ar':   3744,
    'vi':   4159,
    'th':   4574,
    'id':   4989,
}

with open('client/src/lib/i18n.ts', 'r') as f:
    lines = f.readlines()

# 检查是否已存在
if any('"profile.backupPasswordSetSuccess"' in l for l in lines):
    print("Already has password keys, skip")
else:
    # 倒序插入（从后往前，避免行号偏移）
    insertions = []
    for lang, lineno in sorted(lang_lines.items(), key=lambda x: x[1], reverse=True):
        if lang == 'en':
            continue  # en 已在 i18n.ts 中手动添加
        
        # 构建插入文本
        insert_lines = []
        for key in ["profile.backupPasswordSetSuccess", "profile.backupPasswordRemoved", 
                    "profile.passwordMinLength", "profile.passwordMismatch"]:
            val = translations[key][lang]
            insert_lines.append(f'  "{key}": "{val}",\n')
        
        insert_text = ''.join(insert_lines)
        lines.insert(lineno, insert_text)
        print(f"{lang}: inserted after line {lineno}")

with open('client/src/lib/i18n.ts', 'w') as f:
    f.writelines(lines)

print("\nDone!")
