#!/usr/bin/env python3
"""
Add admin.banner* translation keys to all language blocks in i18n.ts.
Strategy: Insert before the }; that closes each language block.
"""

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Language block closing }; line numbers (0-indexed):
# en: 520, zhCN: 1005, zhTW: 1488, ja: 1901, ko: 2314
# es: 2538, pt: 2951, ru: 3364, ar: 3777, vi: 4190, th: 4603, id: 5016
# (from grep output, these are 1-indexed, so subtract 1 for 0-indexed)

block_ends = {
    'en': 520,    # line 521 (1-indexed)
    'zhCN': 1005, # line 1006
    'zhTW': 1488, # line 1489
    'ja': 1901,   # line 1902
    'ko': 2314,   # line 2315
    'es': 2538,   # line 2539
    'pt': 2951,   # line 2952
    'ru': 3364,   # line 3365
    'ar': 3777,   # line 3778
    'vi': 4190,   # line 4191
    'th': 4603,   # line 4604
    'id': 5016,   # line 5017
}

translations = {
    'en': [
        ('admin.bannerUploading', 'Image is uploading, please wait...'),
        ('admin.bannerTitleRequired', 'Please enter a title'),
        ('admin.bannerImageRequired', 'Please upload an image or enter image URL'),
        ('admin.bannerSizeExceeded', 'Image cannot exceed 5MB'),
        ('admin.bannerUploadSuccess', 'Image uploaded successfully'),
        ('admin.bannerUploadFailed', 'Image upload failed'),
        ('admin.bannerCopied', 'Copied'),
        ('admin.bannerDeleteConfirm', 'Are you sure you want to delete this banner?'),
    ],
    'zhCN': [
        ('admin.bannerUploading', '图片正在上传中，请稍候...'),
        ('admin.bannerTitleRequired', '请填写标题'),
        ('admin.bannerImageRequired', '请上传图片或输入图片 URL'),
        ('admin.bannerSizeExceeded', '图片不能超过 5MB'),
        ('admin.bannerUploadSuccess', '图片上传成功，可点击创建'),
        ('admin.bannerUploadFailed', '图片上传失败'),
        ('admin.bannerCopied', '已复制'),
        ('admin.bannerDeleteConfirm', '确定删除该 Banner?'),
    ],
    'zhTW': [
        ('admin.bannerUploading', '圖片正在上傳中，請稍候...'),
        ('admin.bannerTitleRequired', '請填寫標題'),
        ('admin.bannerImageRequired', '請上傳圖片或輸入圖片 URL'),
        ('admin.bannerSizeExceeded', '圖片不能超過 5MB'),
        ('admin.bannerUploadSuccess', '圖片上傳成功，可點擊建立'),
        ('admin.bannerUploadFailed', '圖片上傳失敗'),
        ('admin.bannerCopied', '已複製'),
        ('admin.bannerDeleteConfirm', '確定刪除該 Banner?'),
    ],
    'ja': [
        ('admin.bannerUploading', '画像をアップロード中です。お待ちください...'),
        ('admin.bannerTitleRequired', 'タイトルを入力してください'),
        ('admin.bannerImageRequired', '画像をアップロードするか、画像URLを入力してください'),
        ('admin.bannerSizeExceeded', '画像は5MBを超えることはできません'),
        ('admin.bannerUploadSuccess', '画像のアップロードに成功しました'),
        ('admin.bannerUploadFailed', '画像のアップロードに失敗しました'),
        ('admin.bannerCopied', 'コピーしました'),
        ('admin.bannerDeleteConfirm', 'このバナーを削除してもよろしいですか?'),
    ],
    'ko': [
        ('admin.bannerUploading', '이미지 업로드 중입니다. 잠시만 기다려주세요...'),
        ('admin.bannerTitleRequired', '제목을 입력해주세요'),
        ('admin.bannerImageRequired', '이미지를 업로드하거나 이미지 URL을 입력해주세요'),
        ('admin.bannerSizeExceeded', '이미지는 5MB를 초과할 수 없습니다'),
        ('admin.bannerUploadSuccess', '이미지 업로드 성공'),
        ('admin.bannerUploadFailed', '이미지 업로드 실패'),
        ('admin.bannerCopied', '복사됨'),
        ('admin.bannerDeleteConfirm', '이 배너를 삭제하시겠습니까?'),
    ],
    'es': [
        ('admin.bannerUploading', 'La imagen se está cargando, por favor espere...'),
        ('admin.bannerTitleRequired', 'Por favor ingrese un título'),
        ('admin.bannerImageRequired', 'Por favor cargue una imagen o ingrese una URL'),
        ('admin.bannerSizeExceeded', 'La imagen no puede exceder 5MB'),
        ('admin.bannerUploadSuccess', 'Imagen cargada con éxito'),
        ('admin.bannerUploadFailed', 'Error al cargar la imagen'),
        ('admin.bannerCopied', 'Copiado'),
        ('admin.bannerDeleteConfirm', '¿Está seguro de eliminar este banner?'),
    ],
    'pt': [
        ('admin.bannerUploading', 'A imagem está sendo enviada, por favor aguarde...'),
        ('admin.bannerTitleRequired', 'Por favor insira um título'),
        ('admin.bannerImageRequired', 'Por favor envie uma imagem ou insira uma URL'),
        ('admin.bannerSizeExceeded', 'A imagem não pode exceder 5MB'),
        ('admin.bannerUploadSuccess', 'Imagem enviada com sucesso'),
        ('admin.bannerUploadFailed', 'Falha ao enviar imagem'),
        ('admin.bannerCopied', 'Copiado'),
        ('admin.bannerDeleteConfirm', 'Tem certeza de que deseja excluir este banner?'),
    ],
    'ru': [
        ('admin.bannerUploading', 'Изображение загружается, подождите...'),
        ('admin.bannerTitleRequired', 'Введите заголовок'),
        ('admin.bannerImageRequired', 'Загрузите изображение или введите URL'),
        ('admin.bannerSizeExceeded', 'Размер изображения не может превышать 5МБ'),
        ('admin.bannerUploadSuccess', 'Изображение успешно загружено'),
        ('admin.bannerUploadFailed', 'Ошибка загрузки изображения'),
        ('admin.bannerCopied', 'Скопировано'),
        ('admin.bannerDeleteConfirm', 'Вы уверены, что хотите удалить этот баннер?'),
    ],
    'ar': [
        ('admin.bannerUploading', 'جاري تحميل الصورة، يرجى الانتظار...'),
        ('admin.bannerTitleRequired', 'يرجى إدخال العنوان'),
        ('admin.bannerImageRequired', 'يرجى تحميل صورة أو إدخال عنوان URL'),
        ('admin.bannerSizeExceeded', 'لا يمكن أن تتجاوز الصورة 5MB'),
        ('admin.bannerUploadSuccess', 'تم تحميل الصورة بنجاح'),
        ('admin.bannerUploadFailed', 'فشل تحميل الصورة'),
        ('admin.bannerCopied', 'تم النسخ'),
        ('admin.bannerDeleteConfirm', 'هل تريد حذف هذا الشعار؟'),
    ],
    'vi': [
        ('admin.bannerUploading', 'Hình ảnh đang được tải lên, vui lòng chờ...'),
        ('admin.bannerTitleRequired', 'Vui lòng nhập tiêu đề'),
        ('admin.bannerImageRequired', 'Vui lòng tải lên hình ảnh hoặc nhập URL'),
        ('admin.bannerSizeExceeded', 'Hình ảnh không thể vượt quá 5MB'),
        ('admin.bannerUploadSuccess', 'Tải lên hình ảnh thành công'),
        ('admin.bannerUploadFailed', 'Tải lên hình ảnh thất bại'),
        ('admin.bannerCopied', 'Đã sao chép'),
        ('admin.bannerDeleteConfirm', 'Bạn có chắc chắn muốn xóa banner này?'),
    ],
    'th': [
        ('admin.bannerUploading', 'กำลังอัปโหลดรูปภาพ โปรดรอ...'),
        ('admin.bannerTitleRequired', 'กรุณาป้อนชื่อเรื่อง'),
        ('admin.bannerImageRequired', 'กรุณาอัปโหลดรูปภาพหรือป้อน URL'),
        ('admin.bannerSizeExceeded', 'รูปภาพไม่สามารถเกิน 5MB'),
        ('admin.bannerUploadSuccess', 'อัปโหลดรูปภาพสำเร็จ'),
        ('admin.bannerUploadFailed', 'อัปโหลดรูปภาพล้มเหลว'),
        ('admin.bannerCopied', 'คัดลอกแล้ว'),
        ('admin.bannerDeleteConfirm', 'คุณแน่ใจหรือว่าต้องการลบแบนเนอร์นี้?'),
    ],
    'id': [
        ('admin.bannerUploading', 'Gambar sedang diunggah, silakan tunggu...'),
        ('admin.bannerTitleRequired', 'Silakan masukkan judul'),
        ('admin.bannerImageRequired', 'Silakan unggah gambar atau masukkan URL'),
        ('admin.bannerSizeExceeded', 'Gambar tidak boleh melebihi 5MB'),
        ('admin.bannerUploadSuccess', 'Gambar berhasil diunggah'),
        ('admin.bannerUploadFailed', 'Gagal mengunggah gambar'),
        ('admin.bannerCopied', 'Disalin'),
        ('admin.bannerDeleteConfirm', 'Apakah Anda yakin ingin menghapus banner ini?'),
    ],
}

# Process from bottom to top to preserve line numbers
sorted_langs = sorted(block_ends.items(), key=lambda x: x[1], reverse=True)

for lang, end_idx in sorted_langs:
    trans = translations[lang]
    # Build new lines to insert before the }; line
    new_lines = []
    for key, value in trans:
        new_lines.append(f'  "{key}": "{value}",\n')
    
    # Ensure the line before }; ends with a comma
    prev_line_idx = end_idx - 1
    prev_line = lines[prev_line_idx].rstrip('\n')
    if prev_line.rstrip() and not prev_line.rstrip().endswith(','):
        lines[prev_line_idx] = prev_line.rstrip() + ',\n'
    
    # Insert new lines before };
    lines = lines[:end_idx] + new_lines + lines[end_idx:]

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done! admin.banner* keys added to all 12 languages.")
