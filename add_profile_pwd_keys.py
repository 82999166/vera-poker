#!/usr/bin/env python3
"""Add profile.backupPassword* keys to all language blocks after profile.language line."""

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Translations for each language (keyed by the line number of profile.language)
translations = {
    1247: [  # zhTW
        '  "profile.backupPasswordSetSuccess": "備用密碼設置成功",\n',
        '  "profile.backupPasswordRemoved": "備用密碼已移除",\n',
        '  "profile.passwordMinLength": "密碼至少6位",\n',
        '  "profile.passwordMismatch": "兩次密碼不一致",\n',
    ],
    1721: [  # ja
        '  "profile.backupPasswordSetSuccess": "バックアップパスワードが設定されました",\n',
        '  "profile.backupPasswordRemoved": "バックアップパスワードが削除されました",\n',
        '  "profile.passwordMinLength": "パスワードは6文字以上必要です",\n',
        '  "profile.passwordMismatch": "パスワードが一致しません",\n',
    ],
    2142: [  # ko
        '  "profile.backupPasswordSetSuccess": "백업 비밀번호가 설정되었습니다",\n',
        '  "profile.backupPasswordRemoved": "백업 비밀번호가 삭제되었습니다",\n',
        '  "profile.passwordMinLength": "비밀번호는 최소 6자 이상이어야 합니다",\n',
        '  "profile.passwordMismatch": "비밀번호가 일치하지 않습니다",\n',
    ],
    2489: [  # es
        '  "profile.backupPasswordSetSuccess": "Contraseña de respaldo establecida",\n',
        '  "profile.backupPasswordRemoved": "Contraseña de respaldo eliminada",\n',
        '  "profile.passwordMinLength": "La contraseña debe tener al menos 6 caracteres",\n',
        '  "profile.passwordMismatch": "Las contraseñas no coinciden",\n',
    ],
    2952: [  # pt
        '  "profile.backupPasswordSetSuccess": "Senha de backup definida com sucesso",\n',
        '  "profile.backupPasswordRemoved": "Senha de backup removida",\n',
        '  "profile.passwordMinLength": "A senha deve ter pelo menos 6 caracteres",\n',
        '  "profile.passwordMismatch": "As senhas não coincidem",\n',
    ],
    3373: [  # ru
        '  "profile.backupPasswordSetSuccess": "Резервный пароль установлен",\n',
        '  "profile.backupPasswordRemoved": "Резервный пароль удалён",\n',
        '  "profile.passwordMinLength": "Пароль должен быть не менее 6 символов",\n',
        '  "profile.passwordMismatch": "Пароли не совпадают",\n',
    ],
    3794: [  # ar
        '  "profile.backupPasswordSetSuccess": "تم تعيين كلمة المرور الاحتياطية بنجاح",\n',
        '  "profile.backupPasswordRemoved": "تم إزالة كلمة المرور الاحتياطية",\n',
        '  "profile.passwordMinLength": "يجب أن تكون كلمة المرور 6 أحرف على الأقل",\n',
        '  "profile.passwordMismatch": "كلمتا المرور غير متطابقتين",\n',
    ],
    4215: [  # vi
        '  "profile.backupPasswordSetSuccess": "Đặt mật khẩu dự phòng thành công",\n',
        '  "profile.backupPasswordRemoved": "Đã xóa mật khẩu dự phòng",\n',
        '  "profile.passwordMinLength": "Mật khẩu phải có ít nhất 6 ký tự",\n',
        '  "profile.passwordMismatch": "Mật khẩu không khớp",\n',
    ],
    4636: [  # th
        '  "profile.backupPasswordSetSuccess": "ตั้งรหัสผ่านสำรองสำเร็จ",\n',
        '  "profile.backupPasswordRemoved": "ลบรหัสผ่านสำรองแล้ว",\n',
        '  "profile.passwordMinLength": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",\n',
        '  "profile.passwordMismatch": "รหัสผ่านไม่ตรงกัน",\n',
    ],
    5057: [  # id
        '  "profile.backupPasswordSetSuccess": "Kata sandi cadangan berhasil diatur",\n',
        '  "profile.backupPasswordRemoved": "Kata sandi cadangan dihapus",\n',
        '  "profile.passwordMinLength": "Kata sandi minimal 6 karakter",\n',
        '  "profile.passwordMismatch": "Kata sandi tidak cocok",\n',
    ],
}

# Process from bottom to top to preserve line numbers
for line_num in sorted(translations.keys(), reverse=True):
    # Insert after the profile.language line (line_num is 1-indexed)
    idx = line_num  # insert after this line (0-indexed: line_num - 1 is the line, so insert at line_num)
    lines = lines[:idx] + translations[line_num] + lines[idx:]

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done! profile.backupPassword* keys added to all languages.")
