#!/usr/bin/env python3
"""
批量为 pt/ru/ar/vi/th/id 补充缺失的翻译键
策略：直接从 zhCN 区块提取对应翻译，然后用预定义的语言翻译映射表
"""
import re

# 所有缺失的键及其翻译（按语言）
# 这些是 pt/ru/ar/vi/th/id 共同缺失的 245 个键
# 格式: key -> {lang: translation}

MISSING_TRANSLATIONS = {
    "agent.commission": {
        "pt": "Registros de comissão", "ru": "Записи комиссий", "ar": "سجلات العمولة",
        "vi": "Hồ sơ hoa hồng", "th": "บันทึกค่าคอมมิชชั่น", "id": "Catatan komisi"
    },
    "agent.commissionRates": {
        "pt": "Taxas de comissão", "ru": "Ставки комиссий", "ar": "معدلات العمولة",
        "vi": "Tỷ lệ hoa hồng", "th": "อัตราค่าคอมมิชชั่น", "id": "Tarif komisi"
    },
    "agent.copied": {
        "pt": "Copiado!", "ru": "Скопировано!", "ar": "تم النسخ!",
        "vi": "Đã sao chép!", "th": "คัดลอกแล้ว!", "id": "Disalin!"
    },
    "agent.copy": {
        "pt": "Copiar", "ru": "Копировать", "ar": "نسخ",
        "vi": "Sao chép", "th": "คัดลอก", "id": "Salin"
    },
    "agent.earned": {
        "pt": "ganhou", "ru": "заработал", "ar": "ربح",
        "vi": "đã kiếm", "th": "ได้รับ", "id": "diperoleh"
    },
    "agent.generatePoster": {
        "pt": "Gerar pôster", "ru": "Создать постер", "ar": "إنشاء ملصق",
        "vi": "Tạo poster", "th": "สร้างโปสเตอร์", "id": "Buat poster"
    },
    "agent.hands": {
        "pt": "mãos", "ru": "раздач", "ar": "يد",
        "vi": "ván", "th": "มือ", "id": "tangan"
    },
    "agent.inviteLinkCopied": {
        "pt": "Link de convite copiado!", "ru": "Ссылка скопирована!", "ar": "تم نسخ رابط الدعوة!",
        "vi": "Đã sao chép link mời!", "th": "คัดลอกลิงก์เชิญแล้ว!", "id": "Link undangan disalin!"
    },
    "agent.level1": {
        "pt": "Nível 1", "ru": "Уровень 1", "ar": "المستوى 1",
        "vi": "Cấp 1", "th": "ระดับ 1", "id": "Level 1"
    },
    "agent.level2": {
        "pt": "Nível 2", "ru": "Уровень 2", "ar": "المستوى 2",
        "vi": "Cấp 2", "th": "ระดับ 2", "id": "Level 2"
    },
    "agent.levelDownline": {
        "pt": "Downline Nível {level}", "ru": "Даунлайн уровня {level}", "ar": "داونلاين المستوى {level}",
        "vi": "Tuyến dưới cấp {level}", "th": "ดาวนไลน์ระดับ {level}", "id": "Downline Level {level}"
    },
    "agent.noCommissions": {
        "pt": "Sem registros de comissão", "ru": "Нет записей комиссий", "ar": "لا توجد سجلات عمولة",
        "vi": "Chưa có hồ sơ hoa hồng", "th": "ยังไม่มีบันทึกค่าคอมมิชชั่น", "id": "Belum ada catatan komisi"
    },
    "agent.noDownlines": {
        "pt": "Sem downlines. Compartilhe seu link!", "ru": "Нет даунлайнов. Поделитесь ссылкой!", "ar": "لا يوجد داونلاين. شارك رابطك!",
        "vi": "Chưa có tuyến dưới. Chia sẻ link của bạn!", "th": "ยังไม่มีดาวนไลน์ แชร์ลิงก์ของคุณ!", "id": "Belum ada downline. Bagikan link Anda!"
    },
    "agent.pending": {
        "pt": "Desbloqueio pendente", "ru": "Ожидает разблокировки", "ar": "في انتظار الفتح",
        "vi": "Chờ mở khóa", "th": "รอการปลดล็อค", "id": "Menunggu buka kunci"
    },
    "agent.posterDownload": {
        "pt": "Salvar imagem", "ru": "Сохранить изображение", "ar": "حفظ الصورة",
        "vi": "Lưu ảnh", "th": "บันทึกรูปภาพ", "id": "Simpan gambar"
    },
    "agent.posterSaved": {
        "pt": "Pôster salvo!", "ru": "Постер сохранён!", "ar": "تم حفظ الملصق!",
        "vi": "Đã lưu poster!", "th": "บันทึกโปสเตอร์แล้ว!", "id": "Poster tersimpan!"
    },
    "agent.posterShare": {
        "pt": "Compartilhar no TG", "ru": "Поделиться в TG", "ar": "مشاركة في TG",
        "vi": "Chia sẻ lên TG", "th": "แชร์ไปยัง TG", "id": "Bagikan ke TG"
    },
    "agent.posterSlogan": {
        "pt": "Plataforma Texas Hold'em de Classe Mundial", "ru": "Мировая платформа Texas Hold'em", "ar": "منصة تكساس هولدم عالمية المستوى",
        "vi": "Nền tảng Texas Hold'em đẳng cấp thế giới", "th": "แพลตฟอร์ม Texas Hold'em ระดับโลก", "id": "Platform Texas Hold'em Kelas Dunia"
    },
    "agent.shareText": {
        "pt": "Junte-se a mim no Vera Poker! Use meu link de convite.", "ru": "Присоединяйтесь ко мне на Vera Poker! Используйте мою ссылку.", "ar": "انضم إليّ في Vera Poker! استخدم رابط دعوتي.",
        "vi": "Tham gia Vera Poker cùng tôi! Dùng link mời của tôi.", "th": "มาเล่น Vera Poker กับฉัน! ใช้ลิงก์เชิญของฉัน", "id": "Bergabunglah dengan saya di Vera Poker! Gunakan link undangan saya."
    },
    "agent.unlockReq1": {
        "pt": "Downline joga ≥ 20 mãos válidas", "ru": "Даунлайн сыграл ≥ 20 действительных раздач", "ar": "يلعب الداونلاين ≥ 20 يداً صالحة",
        "vi": "Tuyến dưới chơi ≥ 20 ván hợp lệ", "th": "ดาวนไลน์เล่น ≥ 20 มือที่ถูกต้อง", "id": "Downline bermain ≥ 20 tangan valid"
    },
    "agent.unlockReq2": {
        "pt": "Downline deposita ≥ $10", "ru": "Даунлайн внёс ≥ $10", "ar": "يودع الداونلاين ≥ $10",
        "vi": "Tuyến dưới nạp ≥ $10", "th": "ดาวนไลน์ฝาก ≥ $10", "id": "Downline deposit ≥ $10"
    },
    "agent.unlockReq3": {
        "pt": "Rake do downline ≥ $1", "ru": "Рейк даунлайна ≥ $1", "ar": "رسوم الداونلاين ≥ $1",
        "vi": "Rake tuyến dưới ≥ $1", "th": "Rake ดาวนไลน์ ≥ $1", "id": "Rake downline ≥ $1"
    },
    "agent.unlockReq4": {
        "pt": "Não todas as mãos na mesma mesa do agente", "ru": "Не все раздачи за одним столом с агентом", "ar": "ليست كل الأيدي في نفس طاولة الوكيل",
        "vi": "Không phải tất cả ván ở cùng bàn với đại lý", "th": "ไม่ใช่ทุกมือที่โต๊ะเดียวกับตัวแทน", "id": "Tidak semua tangan di meja yang sama dengan agen"
    },
    "agent.unlockRequirements": {
        "pt": "Requisitos de desbloqueio", "ru": "Требования для разблокировки", "ar": "متطلبات الفتح",
        "vi": "Yêu cầu mở khóa", "th": "เงื่อนไขการปลดล็อค", "id": "Persyaratan buka kunci"
    },
    "agent.unlocked": {
        "pt": "Desbloqueado", "ru": "Разблокировано", "ar": "مفتوح",
        "vi": "Đã mở khóa", "th": "ปลดล็อคแล้ว", "id": "Terbuka"
    },
    "common.login": {
        "pt": "Entrar no Jogo", "ru": "Войти в Игру", "ar": "دخول اللعبة",
        "vi": "Vào Game", "th": "เข้าเกม", "id": "Masuk Game"
    },
    "common.loginWithTelegram": {
        "pt": "Entrar com Telegram", "ru": "Войти через Telegram", "ar": "تسجيل الدخول بـ Telegram",
        "vi": "Đăng nhập bằng Telegram", "th": "เข้าสู่ระบบด้วย Telegram", "id": "Login dengan Telegram"
    },
    "common.optional": {
        "pt": "Opcional", "ru": "Необязательно", "ar": "اختياري",
        "vi": "Tùy chọn", "th": "ไม่บังคับ", "id": "Opsional"
    },
    "common.settings": {
        "pt": "Configurações", "ru": "Настройки", "ar": "الإعدادات",
        "vi": "Cài đặt", "th": "การตั้งค่า", "id": "Pengaturan"
    },
    "cs.clearHistory": {
        "pt": "Limpar histórico", "ru": "Очистить историю", "ar": "مسح سجل المحادثة",
        "vi": "Xóa lịch sử chat", "th": "ล้างประวัติแชท", "id": "Hapus riwayat chat"
    },
    "cs.contactSupport": {
        "pt": "Contatar suporte", "ru": "Связаться с поддержкой", "ar": "الاتصال بالدعم",
        "vi": "Liên hệ hỗ trợ", "th": "ติดต่อฝ่ายสนับสนุน", "id": "Hubungi dukungan"
    },
    "cs.faq": {
        "pt": "Perguntas frequentes", "ru": "Часто задаваемые вопросы", "ar": "الأسئلة الشائعة",
        "vi": "Câu hỏi thường gặp", "th": "คำถามที่พบบ่อย", "id": "FAQ"
    },
    "cs.humanAgent": {
        "pt": "Agente humano", "ru": "Живой агент", "ar": "وكيل بشري",
        "vi": "Nhân viên hỗ trợ", "th": "เจ้าหน้าที่", "id": "Agen manusia"
    },
    "cs.inputPlaceholder": {
        "pt": "Digite sua mensagem...", "ru": "Введите сообщение...", "ar": "اكتب رسالتك...",
        "vi": "Nhập tin nhắn...", "th": "พิมพ์ข้อความ...", "id": "Ketik pesan Anda..."
    },
    "cs.title": {
        "pt": "Suporte", "ru": "Поддержка", "ar": "الدعم",
        "vi": "Hỗ trợ", "th": "ช่วยเหลือ", "id": "Dukungan"
    },
    "cs.transferring": {
        "pt": "Transferindo para agente...", "ru": "Переключаю на агента...", "ar": "جارٍ التحويل إلى وكيل...",
        "vi": "Đang chuyển sang nhân viên...", "th": "กำลังโอนไปยังเจ้าหน้าที่...", "id": "Mentransfer ke agen..."
    },
    "home.ctaButton": {
        "pt": "Jogar Agora", "ru": "Играть Сейчас", "ar": "العب الآن",
        "vi": "Chơi Ngay", "th": "เล่นเลย", "id": "Main Sekarang"
    },
    "home.ctaSubtitle": {
        "pt": "Sem downloads. Sem taxas. Apenas poker.", "ru": "Без загрузок. Без комиссий. Просто покер.", "ar": "بدون تنزيل. بدون رسوم. فقط بوكر.",
        "vi": "Không cần tải. Không phí. Chỉ là poker.", "th": "ไม่ต้องดาวน์โหลด ไม่มีค่าธรรมเนียม แค่โป๊กเกอร์", "id": "Tanpa unduhan. Tanpa biaya. Hanya poker."
    },
    "home.ctaTitle": {
        "pt": "Pronto para jogar?", "ru": "Готов играть?", "ar": "هل أنت مستعد للعب؟",
        "vi": "Sẵn sàng chơi chưa?", "th": "พร้อมเล่นหรือยัง?", "id": "Siap bermain?"
    },
    "home.featuresTitle": {
        "pt": "Por que Vera Poker?", "ru": "Почему Vera Poker?", "ar": "لماذا Vera Poker؟",
        "vi": "Tại sao chọn Vera Poker?", "th": "ทำไมต้อง Vera Poker?", "id": "Mengapa Vera Poker?"
    },
    "home.heroSubtitle": {
        "pt": "Transparente. Descentralizado. Emocionante.", "ru": "Прозрачный. Децентрализованный. Захватывающий.", "ar": "شفاف. لامركزي. مثير.",
        "vi": "Minh bạch. Phi tập trung. Hấp dẫn.", "th": "โปร่งใส. กระจายอำนาจ. น่าตื่นเต้น.", "id": "Transparan. Terdesentralisasi. Mengasyikkan."
    },
    "home.heroTitle": {
        "pt": "Vera Poker", "ru": "Vera Poker", "ar": "Vera Poker",
        "vi": "Vera Poker", "th": "Vera Poker", "id": "Vera Poker"
    },
    "home.howToPlay": {
        "pt": "Como jogar", "ru": "Как играть", "ar": "كيف تلعب",
        "vi": "Cách chơi", "th": "วิธีเล่น", "id": "Cara bermain"
    },
    "home.loginToPlay": {
        "pt": "Entrar para jogar", "ru": "Войдите для игры", "ar": "سجل الدخول للعب",
        "vi": "Đăng nhập để chơi", "th": "เข้าสู่ระบบเพื่อเล่น", "id": "Login untuk bermain"
    },
    "home.playNow": {
        "pt": "Jogar Agora", "ru": "Играть Сейчас", "ar": "العب الآن",
        "vi": "Chơi Ngay", "th": "เล่นเลย", "id": "Main Sekarang"
    },
    "home.step1Desc": {
        "pt": "Faça login com Telegram, sem cadastro necessário", "ru": "Войдите через Telegram, регистрация не нужна", "ar": "سجل الدخول بـ Telegram، لا حاجة للتسجيل",
        "vi": "Đăng nhập bằng Telegram, không cần đăng ký", "th": "เข้าสู่ระบบด้วย Telegram ไม่ต้องสมัครสมาชิก", "id": "Login dengan Telegram, tidak perlu daftar"
    },
    "home.step1Title": {
        "pt": "Entrar", "ru": "Войти", "ar": "تسجيل الدخول",
        "vi": "Đăng nhập", "th": "เข้าสู่ระบบ", "id": "Masuk"
    },
    "home.step2Desc": {
        "pt": "Deposite USDT e comece a jogar imediatamente", "ru": "Внесите USDT и начните играть сразу", "ar": "أودع USDT وابدأ اللعب فوراً",
        "vi": "Nạp USDT và bắt đầu chơi ngay", "th": "ฝาก USDT แล้วเริ่มเล่นได้เลย", "id": "Deposit USDT dan mulai bermain"
    },
    "home.step2Title": {
        "pt": "Depositar", "ru": "Внести", "ar": "إيداع",
        "vi": "Nạp tiền", "th": "ฝากเงิน", "id": "Deposit"
    },
    "home.step3Desc": {
        "pt": "Escolha uma mesa e jogue Texas Hold'em", "ru": "Выберите стол и играйте в Texas Hold'em", "ar": "اختر طاولة والعب تكساس هولدم",
        "vi": "Chọn bàn và chơi Texas Hold'em", "th": "เลือกโต๊ะและเล่น Texas Hold'em", "id": "Pilih meja dan mainkan Texas Hold'em"
    },
    "home.step3Title": {
        "pt": "Jogar", "ru": "Играть", "ar": "اللعب",
        "vi": "Chơi", "th": "เล่น", "id": "Bermain"
    },
    "home.stepsTitle": {
        "pt": "Comece em 3 passos", "ru": "Начните за 3 шага", "ar": "ابدأ في 3 خطوات",
        "vi": "Bắt đầu trong 3 bước", "th": "เริ่มต้นใน 3 ขั้นตอน", "id": "Mulai dalam 3 langkah"
    },
    "lobby.blinds": {
        "pt": "Blinds", "ru": "Блайнды", "ar": "البلايند",
        "vi": "Blinds", "th": "บลายด์", "id": "Blinds"
    },
    "lobby.buyIn": {
        "pt": "Buy-in", "ru": "Бай-ин", "ar": "شراء الدخول",
        "vi": "Buy-in", "th": "บาย-อิน", "id": "Buy-in"
    },
    "lobby.createRoom": {
        "pt": "Criar Sala", "ru": "Создать Комнату", "ar": "إنشاء غرفة",
        "vi": "Tạo Phòng", "th": "สร้างห้อง", "id": "Buat Ruangan"
    },
    "lobby.enterCode": {
        "pt": "Entrar com código", "ru": "Войти по коду", "ar": "الدخول بالرمز",
        "vi": "Nhập mã", "th": "ใส่รหัส", "id": "Masukkan kode"
    },
    "lobby.enterCodePlaceholder": {
        "pt": "Código da sala", "ru": "Код комнаты", "ar": "رمز الغرفة",
        "vi": "Mã phòng", "th": "รหัสห้อง", "id": "Kode ruangan"
    },
    "lobby.joinRoom": {
        "pt": "Entrar na Sala", "ru": "Войти в Комнату", "ar": "الدخول للغرفة",
        "vi": "Vào Phòng", "th": "เข้าห้อง", "id": "Masuk Ruangan"
    },
    "lobby.maxPlayers": {
        "pt": "Máx. jogadores", "ru": "Макс. игроков", "ar": "أقصى عدد لاعبين",
        "vi": "Tối đa người chơi", "th": "ผู้เล่นสูงสุด", "id": "Maks. pemain"
    },
    "lobby.myRoom": {
        "pt": "Minha Sala", "ru": "Моя Комната", "ar": "غرفتي",
        "vi": "Phòng của tôi", "th": "ห้องของฉัน", "id": "Ruangan saya"
    },
    "lobby.noRooms": {
        "pt": "Nenhuma sala disponível", "ru": "Нет доступных комнат", "ar": "لا توجد غرف متاحة",
        "vi": "Không có phòng nào", "th": "ไม่มีห้องที่ใช้งานได้", "id": "Tidak ada ruangan tersedia"
    },
    "lobby.players": {
        "pt": "Jogadores", "ru": "Игроки", "ar": "اللاعبون",
        "vi": "Người chơi", "th": "ผู้เล่น", "id": "Pemain"
    },
    "lobby.quickJoin": {
        "pt": "Entrar Rápido", "ru": "Быстрый Вход", "ar": "دخول سريع",
        "vi": "Vào Nhanh", "th": "เข้าเร็ว", "id": "Masuk Cepat"
    },
    "lobby.roomCode": {
        "pt": "Código da sala", "ru": "Код комнаты", "ar": "رمز الغرفة",
        "vi": "Mã phòng", "th": "รหัสห้อง", "id": "Kode ruangan"
    },
    "lobby.title": {
        "pt": "Saguão", "ru": "Лобби", "ar": "اللوبي",
        "vi": "Sảnh", "th": "ล็อบบี้", "id": "Lobi"
    },
    "lobby.tournaments": {
        "pt": "Torneios", "ru": "Турниры", "ar": "البطولات",
        "vi": "Giải đấu", "th": "ทัวร์นาเมนต์", "id": "Turnamen"
    },
    "profile.avatar": {
        "pt": "Avatar", "ru": "Аватар", "ar": "الصورة الرمزية",
        "vi": "Ảnh đại diện", "th": "รูปโปรไฟล์", "id": "Avatar"
    },
    "profile.editName": {
        "pt": "Editar nome", "ru": "Изменить имя", "ar": "تعديل الاسم",
        "vi": "Sửa tên", "th": "แก้ไขชื่อ", "id": "Edit nama"
    },
    "profile.handsPlayed": {
        "pt": "Mãos jogadas", "ru": "Сыграно раздач", "ar": "الأيدي المُلعبة",
        "vi": "Ván đã chơi", "th": "มือที่เล่น", "id": "Tangan dimainkan"
    },
    "profile.namePlaceholder": {
        "pt": "Seu nome de exibição", "ru": "Ваше отображаемое имя", "ar": "اسمك المعروض",
        "vi": "Tên hiển thị của bạn", "th": "ชื่อที่แสดง", "id": "Nama tampilan Anda"
    },
    "profile.netProfit": {
        "pt": "Lucro líquido", "ru": "Чистая прибыль", "ar": "صافي الربح",
        "vi": "Lợi nhuận ròng", "th": "กำไรสุทธิ", "id": "Keuntungan bersih"
    },
    "profile.noStats": {
        "pt": "Sem estatísticas ainda", "ru": "Нет статистики", "ar": "لا توجد إحصائيات بعد",
        "vi": "Chưa có thống kê", "th": "ยังไม่มีสถิติ", "id": "Belum ada statistik"
    },
    "profile.title": {
        "pt": "Perfil", "ru": "Профиль", "ar": "الملف الشخصي",
        "vi": "Hồ sơ", "th": "โปรไฟล์", "id": "Profil"
    },
    "profile.totalProfit": {
        "pt": "Lucro total", "ru": "Общая прибыль", "ar": "إجمالي الربح",
        "vi": "Tổng lợi nhuận", "th": "กำไรรวม", "id": "Total keuntungan"
    },
    "profile.winRate": {
        "pt": "Taxa de vitória", "ru": "Процент побед", "ar": "معدل الفوز",
        "vi": "Tỷ lệ thắng", "th": "อัตราชนะ", "id": "Tingkat kemenangan"
    },
    "profile.wins": {
        "pt": "Vitórias", "ru": "Победы", "ar": "الانتصارات",
        "vi": "Số lần thắng", "th": "จำนวนชนะ", "id": "Kemenangan"
    },
    "rebuy.addChips": {
        "pt": "Adicionar fichas", "ru": "Добавить фишки", "ar": "إضافة رقائق",
        "vi": "Thêm chip", "th": "เพิ่มชิป", "id": "Tambah chip"
    },
    "rebuy.alreadyMax": {
        "pt": "Já no máximo", "ru": "Уже максимум", "ar": "بالحد الأقصى بالفعل",
        "vi": "Đã đạt tối đa", "th": "ถึงสูงสุดแล้ว", "id": "Sudah maksimal"
    },
    "rebuy.confirm": {
        "pt": "Confirmar recarga", "ru": "Подтвердить рекупить", "ar": "تأكيد إعادة الشراء",
        "vi": "Xác nhận rebuy", "th": "ยืนยันการรีบาย", "id": "Konfirmasi rebuy"
    },
    "rebuy.currentChips": {
        "pt": "Fichas atuais", "ru": "Текущие фишки", "ar": "الرقائق الحالية",
        "vi": "Chip hiện tại", "th": "ชิปปัจจุบัน", "id": "Chip saat ini"
    },
    "rebuy.insufficientBalance": {
        "pt": "Saldo insuficiente", "ru": "Недостаточно средств", "ar": "رصيد غير كافٍ",
        "vi": "Số dư không đủ", "th": "ยอดคงเหลือไม่เพียงพอ", "id": "Saldo tidak cukup"
    },
    "rebuy.lowChips": {
        "pt": "Fichas baixas! Recarregar?", "ru": "Мало фишек! Рекупить?", "ar": "رقائق منخفضة! إعادة الشراء؟",
        "vi": "Chip thấp! Rebuy?", "th": "ชิปน้อย! รีบาย?", "id": "Chip rendah! Rebuy?"
    },
    "rebuy.maxBuyIn": {
        "pt": "Buy-in máximo", "ru": "Максимальный бай-ин", "ar": "أقصى شراء",
        "vi": "Buy-in tối đa", "th": "บาย-อินสูงสุด", "id": "Buy-in maksimal"
    },
    "rebuy.success": {
        "pt": "Recarga bem-sucedida!", "ru": "Рекупит выполнен!", "ar": "تمت إعادة الشراء بنجاح!",
        "vi": "Rebuy thành công!", "th": "รีบายสำเร็จ!", "id": "Rebuy berhasil!"
    },
    "rebuy.title": {
        "pt": "Recarregar fichas", "ru": "Рекупить фишки", "ar": "إعادة شراء الرقائق",
        "vi": "Rebuy chip", "th": "รีบายชิป", "id": "Rebuy chip"
    },
    "room.bigBlind": {
        "pt": "Big Blind", "ru": "Большой блайнд", "ar": "البلايند الكبير",
        "vi": "Big Blind", "th": "บิ๊กบลายด์", "id": "Big Blind"
    },
    "room.close": {
        "pt": "Fechar sala", "ru": "Закрыть комнату", "ar": "إغلاق الغرفة",
        "vi": "Đóng phòng", "th": "ปิดห้อง", "id": "Tutup ruangan"
    },
    "room.closeConfirm": {
        "pt": "Fechar esta sala?", "ru": "Закрыть эту комнату?", "ar": "إغلاق هذه الغرفة؟",
        "vi": "Đóng phòng này?", "th": "ปิดห้องนี้?", "id": "Tutup ruangan ini?"
    },
    "room.copyCode": {
        "pt": "Copiar código", "ru": "Скопировать код", "ar": "نسخ الرمز",
        "vi": "Sao chép mã", "th": "คัดลอกรหัส", "id": "Salin kode"
    },
    "room.createSuccess": {
        "pt": "Sala criada com sucesso!", "ru": "Комната создана!", "ar": "تم إنشاء الغرفة بنجاح!",
        "vi": "Tạo phòng thành công!", "th": "สร้างห้องสำเร็จ!", "id": "Ruangan berhasil dibuat!"
    },
    "room.inviteCode": {
        "pt": "Código de convite", "ru": "Код приглашения", "ar": "رمز الدعوة",
        "vi": "Mã mời", "th": "รหัสเชิญ", "id": "Kode undangan"
    },
    "room.maxBuyIn": {
        "pt": "Buy-in máximo", "ru": "Максимальный бай-ин", "ar": "أقصى شراء",
        "vi": "Buy-in tối đa", "th": "บาย-อินสูงสุด", "id": "Buy-in maksimal"
    },
    "room.minBuyIn": {
        "pt": "Buy-in mínimo", "ru": "Минимальный бай-ин", "ar": "أدنى شراء",
        "vi": "Buy-in tối thiểu", "th": "บาย-อินขั้นต่ำ", "id": "Buy-in minimal"
    },
    "room.name": {
        "pt": "Nome da sala", "ru": "Название комнаты", "ar": "اسم الغرفة",
        "vi": "Tên phòng", "th": "ชื่อห้อง", "id": "Nama ruangan"
    },
    "room.namePlaceholder": {
        "pt": "Ex: Mesa do João", "ru": "Напр: Стол Ивана", "ar": "مثال: طاولة أحمد",
        "vi": "VD: Bàn của Minh", "th": "เช่น: โต๊ะของสมชาย", "id": "Mis: Meja Budi"
    },
    "room.rake": {
        "pt": "Rake", "ru": "Рейк", "ar": "الرسوم",
        "vi": "Rake", "th": "รัค", "id": "Rake"
    },
    "room.settings": {
        "pt": "Configurações da sala", "ru": "Настройки комнаты", "ar": "إعدادات الغرفة",
        "vi": "Cài đặt phòng", "th": "การตั้งค่าห้อง", "id": "Pengaturan ruangan"
    },
    "room.smallBlind": {
        "pt": "Small Blind", "ru": "Малый блайнд", "ar": "البلايند الصغير",
        "vi": "Small Blind", "th": "สมอลบลายด์", "id": "Small Blind"
    },
    "room.timeBank": {
        "pt": "Banco de tempo", "ru": "Банк времени", "ar": "بنك الوقت",
        "vi": "Ngân hàng thời gian", "th": "ธนาคารเวลา", "id": "Bank waktu"
    },
    "room.title": {
        "pt": "Criar sala", "ru": "Создать комнату", "ar": "إنشاء غرفة",
        "vi": "Tạo phòng", "th": "สร้างห้อง", "id": "Buat ruangan"
    },
    "room.turnTimeout": {
        "pt": "Tempo por turno", "ru": "Время на ход", "ar": "وقت الدور",
        "vi": "Thời gian mỗi lượt", "th": "เวลาต่อเทิร์น", "id": "Waktu per giliran"
    },
    "sound.off": {
        "pt": "Som desligado", "ru": "Звук выкл", "ar": "الصوت معطل",
        "vi": "Tắt âm thanh", "th": "ปิดเสียง", "id": "Suara mati"
    },
    "sound.on": {
        "pt": "Som ligado", "ru": "Звук вкл", "ar": "الصوت مفعل",
        "vi": "Bật âm thanh", "th": "เปิดเสียง", "id": "Suara hidup"
    },
    "sound.voiceOff": {
        "pt": "Voz desligada", "ru": "Голос выкл", "ar": "الصوت البشري معطل",
        "vi": "Tắt giọng nói", "th": "ปิดเสียงพูด", "id": "Suara mati"
    },
    "sound.voiceWinnerOnly": {
        "pt": "Voz apenas para vencedor", "ru": "Голос только для победителя", "ar": "الصوت للفائز فقط",
        "vi": "Giọng nói chỉ cho người thắng", "th": "เสียงพูดเฉพาะผู้ชนะ", "id": "Suara hanya untuk pemenang"
    },
    "table.alreadyInGame": {
        "pt": "Você já está em jogo", "ru": "Вы уже в игре", "ar": "أنت بالفعل في اللعبة",
        "vi": "Bạn đã trong game", "th": "คุณอยู่ในเกมแล้ว", "id": "Anda sudah dalam permainan"
    },
    "table.autoLeaveIn": {
        "pt": "Saída automática em {n}s", "ru": "Авто-выход через {n}с", "ar": "مغادرة تلقائية خلال {n}ث",
        "vi": "Tự rời sau {n}s", "th": "ออกอัตโนมัติใน {n}วินาที", "id": "Keluar otomatis dalam {n}d"
    },
    "table.backToLobby": {
        "pt": "Voltar ao saguão", "ru": "Вернуться в лобби", "ar": "العودة إلى اللوبي",
        "vi": "Về sảnh", "th": "กลับไปล็อบบี้", "id": "Kembali ke lobi"
    },
    "table.bet": {
        "pt": "Aposta", "ru": "Ставка", "ar": "الرهان",
        "vi": "Cược", "th": "เดิมพัน", "id": "Taruhan"
    },
    "table.buyIn": {
        "pt": "Compra de fichas", "ru": "Бай-ин", "ar": "شراء الدخول",
        "vi": "Mua chip", "th": "บาย-อิน", "id": "Beli chip"
    },
    "table.completed": {
        "pt": "Concluído", "ru": "Завершено", "ar": "مكتمل",
        "vi": "Hoàn thành", "th": "เสร็จสิ้น", "id": "Selesai"
    },
    "table.dealer": {
        "pt": "Dealer", "ru": "Дилер", "ar": "الموزع",
        "vi": "Dealer", "th": "ดีลเลอร์", "id": "Dealer"
    },
    "table.demo": {
        "pt": "Demo", "ru": "Демо", "ar": "تجريبي",
        "vi": "Demo", "th": "ทดลอง", "id": "Demo"
    },
    "table.demoMode": {
        "pt": "Modo demo — faça login para jogar de verdade", "ru": "Демо-режим — войдите для реальной игры", "ar": "وضع تجريبي — سجل الدخول للعب الحقيقي",
        "vi": "Chế độ demo — đăng nhập để chơi thật", "th": "โหมดทดลอง — เข้าสู่ระบบเพื่อเล่นจริง", "id": "Mode demo — login untuk bermain sungguhan"
    },
    "table.handHistory": {
        "pt": "Histórico de mãos", "ru": "История раздач", "ar": "سجل الأيدي",
        "vi": "Lịch sử ván", "th": "ประวัติมือ", "id": "Riwayat tangan"
    },
    "table.handId": {
        "pt": "ID da mão", "ru": "ID раздачи", "ar": "معرف اليد",
        "vi": "ID ván", "th": "ID มือ", "id": "ID tangan"
    },
    "table.inProgress": {
        "pt": "Em andamento", "ru": "В процессе", "ar": "جارٍ",
        "vi": "Đang diễn ra", "th": "กำลังดำเนินการ", "id": "Sedang berlangsung"
    },
    "table.kickedToLobby": {
        "pt": "Você foi removido para o saguão", "ru": "Вас переместили в лобби", "ar": "تم نقلك إلى اللوبي",
        "vi": "Bạn đã bị chuyển về sảnh", "th": "คุณถูกย้ายไปล็อบบี้", "id": "Anda dipindahkan ke lobi"
    },
    "table.leave": {
        "pt": "Sair da mesa", "ru": "Покинуть стол", "ar": "مغادرة الطاولة",
        "vi": "Rời bàn", "th": "ออกจากโต๊ะ", "id": "Tinggalkan meja"
    },
    "table.left": {
        "pt": "Saiu", "ru": "Ушёл", "ar": "غادر",
        "vi": "Đã rời", "th": "ออกแล้ว", "id": "Keluar"
    },
    "table.minPlayers": {
        "pt": "Mín. 2 jogadores", "ru": "Мин. 2 игрока", "ar": "2 لاعبين على الأقل",
        "vi": "Tối thiểu 2 người", "th": "ขั้นต่ำ 2 ผู้เล่น", "id": "Min. 2 pemain"
    },
    "table.noChips": {
        "pt": "Sem fichas", "ru": "Нет фишек", "ar": "لا رقائق",
        "vi": "Hết chip", "th": "ไม่มีชิป", "id": "Tidak ada chip"
    },
    "table.noHands": {
        "pt": "Sem mãos ainda", "ru": "Нет раздач", "ar": "لا توجد أيدي بعد",
        "vi": "Chưa có ván nào", "th": "ยังไม่มีมือ", "id": "Belum ada tangan"
    },
    "table.noMatchTimeout": {
        "pt": "Sem correspondência, tempo esgotado", "ru": "Нет совпадений, время вышло", "ar": "لا تطابق، انتهى الوقت",
        "vi": "Không tìm được bàn, hết thời gian", "th": "ไม่พบโต๊ะ หมดเวลา", "id": "Tidak ada kecocokan, waktu habis"
    },
    "table.phaseFlop": {
        "pt": "Flop", "ru": "Флоп", "ar": "الفلوب",
        "vi": "Flop", "th": "ฟล็อป", "id": "Flop"
    },
    "table.phasePreflop": {
        "pt": "Pré-flop", "ru": "Префлоп", "ar": "ما قبل الفلوب",
        "vi": "Preflop", "th": "พรีฟล็อป", "id": "Preflop"
    },
    "table.phaseRiver": {
        "pt": "River", "ru": "Ривер", "ar": "الريفير",
        "vi": "River", "th": "ริเวอร์", "id": "River"
    },
    "table.phaseShowdown": {
        "pt": "Showdown", "ru": "Шоудаун", "ar": "المواجهة",
        "vi": "Showdown", "th": "โชว์ดาวน์", "id": "Showdown"
    },
    "table.phaseTurn": {
        "pt": "Turn", "ru": "Тёрн", "ar": "التيرن",
        "vi": "Turn", "th": "เทิร์น", "id": "Turn"
    },
    "table.playersReady": {
        "pt": "{n} prontos", "ru": "{n} готовы", "ar": "{n} جاهزون",
        "vi": "{n} sẵn sàng", "th": "{n} พร้อม", "id": "{n} siap"
    },
    "table.potNumber": {
        "pt": "Pote #{n}", "ru": "Банк #{n}", "ar": "الوعاء #{n}",
        "vi": "Pot #{n}", "th": "พ็อต #{n}", "id": "Pot #{n}"
    },
    "table.potWon": {
        "pt": "ganhou o pote", "ru": "выиграл банк", "ar": "فاز بالوعاء",
        "vi": "thắng pot", "th": "ชนะพ็อต", "id": "memenangkan pot"
    },
    "table.readyWaiting": {
        "pt": "Aguardando outros jogadores...", "ru": "Ожидание других игроков...", "ar": "في انتظار اللاعبين الآخرين...",
        "vi": "Đang chờ người chơi khác...", "th": "รอผู้เล่นอื่น...", "id": "Menunggu pemain lain..."
    },
    "table.reconnecting": {
        "pt": "Reconectando...", "ru": "Переподключение...", "ar": "إعادة الاتصال...",
        "vi": "Đang kết nối lại...", "th": "กำลังเชื่อมต่อใหม่...", "id": "Menghubungkan kembali..."
    },
    "table.seatJoined": {
        "pt": "Você entrou na mesa!", "ru": "Вы сели за стол!", "ar": "لقد انضممت إلى الطاولة!",
        "vi": "Bạn đã vào bàn!", "th": "คุณเข้าร่วมโต๊ะแล้ว!", "id": "Anda bergabung ke meja!"
    },
    "table.sidePots": {
        "pt": "Potes laterais", "ru": "Боковые банки", "ar": "الأوعية الجانبية",
        "vi": "Pot phụ", "th": "ไซด์พ็อต", "id": "Side pot"
    },
    "table.sitDown": {
        "pt": "Sentar", "ru": "Сесть", "ar": "الجلوس",
        "vi": "Ngồi xuống", "th": "นั่ง", "id": "Duduk"
    },
    "table.startNextHand": {
        "pt": "Iniciar próxima mão", "ru": "Начать следующую раздачу", "ar": "بدء اليد التالية",
        "vi": "Bắt đầu ván tiếp theo", "th": "เริ่มมือถัดไป", "id": "Mulai tangan berikutnya"
    },
    "table.switchingTable": {
        "pt": "Trocando de mesa...", "ru": "Смена стола...", "ar": "تغيير الطاولة...",
        "vi": "Đang đổi bàn...", "th": "กำลังเปลี่ยนโต๊ะ...", "id": "Mengganti meja..."
    },
    "table.viewAll": {
        "pt": "Ver tudo", "ru": "Просмотреть всё", "ar": "عرض الكل",
        "vi": "Xem tất cả", "th": "ดูทั้งหมด", "id": "Lihat semua"
    },
    "table.winner": {
        "pt": "Vencedor", "ru": "Победитель", "ar": "الفائز",
        "vi": "Người thắng", "th": "ผู้ชนะ", "id": "Pemenang"
    },
    "table.won": {
        "pt": "ganhou", "ru": "выиграл", "ar": "فاز",
        "vi": "thắng", "th": "ชนะ", "id": "menang"
    },
    "table.you": {
        "pt": "Você", "ru": "Вы", "ar": "أنت",
        "vi": "Bạn", "th": "คุณ", "id": "Anda"
    },
    "tourney.blindLevel": {
        "pt": "Nível de blind", "ru": "Уровень блайнда", "ar": "مستوى البلايند",
        "vi": "Cấp blind", "th": "ระดับบลายด์", "id": "Level blind"
    },
    "tourney.cancelRegistration": {
        "pt": "Cancelar inscrição", "ru": "Отменить регистрацию", "ar": "إلغاء التسجيل",
        "vi": "Hủy đăng ký", "th": "ยกเลิกการลงทะเบียน", "id": "Batalkan pendaftaran"
    },
    "tourney.cancelSuccess": {
        "pt": "Inscrição cancelada", "ru": "Регистрация отменена", "ar": "تم إلغاء التسجيل",
        "vi": "Đã hủy đăng ký", "th": "ยกเลิกการลงทะเบียนแล้ว", "id": "Pendaftaran dibatalkan"
    },
    "tourney.cancelled": {
        "pt": "Cancelado", "ru": "Отменён", "ar": "ملغى",
        "vi": "Đã hủy", "th": "ยกเลิกแล้ว", "id": "Dibatalkan"
    },
    "tourney.ended": {
        "pt": "Encerrado", "ru": "Завершён", "ar": "انتهى",
        "vi": "Đã kết thúc", "th": "สิ้นสุดแล้ว", "id": "Berakhir"
    },
    "tourney.entryFee": {
        "pt": "Taxa de entrada", "ru": "Взнос", "ar": "رسوم الدخول",
        "vi": "Phí tham gia", "th": "ค่าเข้าร่วม", "id": "Biaya masuk"
    },
    "tourney.inProgress": {
        "pt": "Em andamento", "ru": "В процессе", "ar": "جارٍ",
        "vi": "Đang diễn ra", "th": "กำลังดำเนินการ", "id": "Sedang berlangsung"
    },
    "tourney.loginToRegister": {
        "pt": "Entre para se inscrever", "ru": "Войдите для регистрации", "ar": "سجل الدخول للتسجيل",
        "vi": "Đăng nhập để đăng ký", "th": "เข้าสู่ระบบเพื่อลงทะเบียน", "id": "Login untuk mendaftar"
    },
    "tourney.noTournaments": {
        "pt": "Sem torneios disponíveis", "ru": "Нет доступных турниров", "ar": "لا توجد بطولات متاحة",
        "vi": "Không có giải đấu nào", "th": "ไม่มีทัวร์นาเมนต์", "id": "Tidak ada turnamen"
    },
    "tourney.perTable": {
        "pt": "Por mesa", "ru": "За стол", "ar": "لكل طاولة",
        "vi": "Mỗi bàn", "th": "ต่อโต๊ะ", "id": "Per meja"
    },
    "tourney.platformRake": {
        "pt": "Rake da plataforma", "ru": "Рейк платформы", "ar": "رسوم المنصة",
        "vi": "Rake nền tảng", "th": "Rake แพลตฟอร์ม", "id": "Rake platform"
    },
    "tourney.players": {
        "pt": "Jogadores", "ru": "Игроки", "ar": "اللاعبون",
        "vi": "Người chơi", "th": "ผู้เล่น", "id": "Pemain"
    },
    "tourney.prizeDistribution": {
        "pt": "Distribuição de prêmios", "ru": "Распределение призов", "ar": "توزيع الجوائز",
        "vi": "Phân phối giải thưởng", "th": "การแจกรางวัล", "id": "Distribusi hadiah"
    },
    "tourney.prizePool": {
        "pt": "Prêmio total", "ru": "Призовой фонд", "ar": "مجموع الجوائز",
        "vi": "Tổng giải thưởng", "th": "รางวัลรวม", "id": "Total hadiah"
    },
    "tourney.rank": {
        "pt": "Posição", "ru": "Место", "ar": "المركز",
        "vi": "Hạng", "th": "อันดับ", "id": "Peringkat"
    },
    "tourney.register": {
        "pt": "Inscrever-se", "ru": "Зарегистрироваться", "ar": "التسجيل",
        "vi": "Đăng ký", "th": "ลงทะเบียน", "id": "Daftar"
    },
    "tourney.registerSuccess": {
        "pt": "Inscrição realizada!", "ru": "Регистрация выполнена!", "ar": "تم التسجيل بنجاح!",
        "vi": "Đăng ký thành công!", "th": "ลงทะเบียนสำเร็จ!", "id": "Pendaftaran berhasil!"
    },
    "tourney.registeredPlayers": {
        "pt": "Jogadores inscritos", "ru": "Зарегистрированные игроки", "ar": "اللاعبون المسجلون",
        "vi": "Người chơi đã đăng ký", "th": "ผู้เล่นที่ลงทะเบียน", "id": "Pemain terdaftar"
    },
    "tourney.startTime": {
        "pt": "Hora de início", "ru": "Время начала", "ar": "وقت البدء",
        "vi": "Thời gian bắt đầu", "th": "เวลาเริ่มต้น", "id": "Waktu mulai"
    },
    "tourney.starting": {
        "pt": "Iniciando...", "ru": "Начинается...", "ar": "جارٍ البدء...",
        "vi": "Đang bắt đầu...", "th": "กำลังเริ่ม...", "id": "Memulai..."
    },
    "tourney.startingChips": {
        "pt": "Fichas iniciais", "ru": "Начальные фишки", "ar": "الرقائق الابتدائية",
        "vi": "Chip ban đầu", "th": "ชิปเริ่มต้น", "id": "Chip awal"
    },
    "tourney.startsIn": {
        "pt": "Começa em", "ru": "Начнётся через", "ar": "يبدأ خلال",
        "vi": "Bắt đầu sau", "th": "เริ่มใน", "id": "Mulai dalam"
    },
    "tourney.statusCancelled": {
        "pt": "Cancelado", "ru": "Отменён", "ar": "ملغى",
        "vi": "Đã hủy", "th": "ยกเลิกแล้ว", "id": "Dibatalkan"
    },
    "tourney.statusDraft": {
        "pt": "Rascunho", "ru": "Черновик", "ar": "مسودة",
        "vi": "Nháp", "th": "ร่าง", "id": "Draf"
    },
    "tourney.statusFinished": {
        "pt": "Finalizado", "ru": "Завершён", "ar": "منتهٍ",
        "vi": "Đã kết thúc", "th": "สิ้นสุดแล้ว", "id": "Selesai"
    },
    "tourney.statusRegistration": {
        "pt": "Inscrições abertas", "ru": "Регистрация открыта", "ar": "التسجيل مفتوح",
        "vi": "Đang nhận đăng ký", "th": "เปิดรับสมัคร", "id": "Pendaftaran dibuka"
    },
    "tourney.statusRunning": {
        "pt": "Em andamento", "ru": "Идёт", "ar": "جارٍ",
        "vi": "Đang diễn ra", "th": "กำลังดำเนินการ", "id": "Sedang berjalan"
    },
    "tourney.totalRounds": {
        "pt": "Total de rodadas", "ru": "Всего раундов", "ar": "إجمالي الجولات",
        "vi": "Tổng số vòng", "th": "รอบทั้งหมด", "id": "Total ronde"
    },
    "tourney.youAreRegistered": {
        "pt": "Você está inscrito!", "ru": "Вы зарегистрированы!", "ar": "أنت مسجل!",
        "vi": "Bạn đã đăng ký!", "th": "คุณลงทะเบียนแล้ว!", "id": "Anda sudah terdaftar!"
    },
    "voice.all": {
        "pt": "Todas as vozes", "ru": "Все голоса", "ar": "كل الأصوات",
        "vi": "Tất cả giọng nói", "th": "เสียงทั้งหมด", "id": "Semua suara"
    },
    "voice.off": {
        "pt": "Voz desligada", "ru": "Голос выкл", "ar": "الصوت معطل",
        "vi": "Tắt giọng nói", "th": "ปิดเสียงพูด", "id": "Suara mati"
    },
    "voice.winnerOnly": {
        "pt": "Apenas vencedor", "ru": "Только победитель", "ar": "الفائز فقط",
        "vi": "Chỉ người thắng", "th": "เฉพาะผู้ชนะ", "id": "Hanya pemenang"
    },
    "wallet.address": {
        "pt": "Endereço da carteira", "ru": "Адрес кошелька", "ar": "عنوان المحفظة",
        "vi": "Địa chỉ ví", "th": "ที่อยู่กระเป๋า", "id": "Alamat dompet"
    },
    "wallet.addressPlaceholder": {
        "pt": "Insira seu endereço", "ru": "Введите ваш адрес", "ar": "أدخل عنوانك",
        "vi": "Nhập địa chỉ của bạn", "th": "ใส่ที่อยู่ของคุณ", "id": "Masukkan alamat Anda"
    },
    "wallet.autoDetectTip": {
        "pt": "O sistema detectará automaticamente em minutos", "ru": "Система обнаружит автоматически через несколько минут", "ar": "سيكتشف النظام تلقائياً في دقائق",
        "vi": "Hệ thống sẽ tự phát hiện trong vài phút", "th": "ระบบจะตรวจจับอัตโนมัติในไม่กี่นาที", "id": "Sistem akan mendeteksi otomatis dalam beberapa menit"
    },
    "wallet.buyIn": {
        "pt": "Compra de fichas", "ru": "Бай-ин", "ar": "شراء الدخول",
        "vi": "Mua chip", "th": "บาย-อิน", "id": "Beli chip"
    },
    "wallet.chain": {
        "pt": "Rede", "ru": "Сеть", "ar": "الشبكة",
        "vi": "Mạng", "th": "เครือข่าย", "id": "Jaringan"
    },
    "wallet.confirmed": {
        "pt": "Confirmado", "ru": "Подтверждено", "ar": "مؤكد",
        "vi": "Đã xác nhận", "th": "ยืนยันแล้ว", "id": "Dikonfirmasi"
    },
    "wallet.depositAddress": {
        "pt": "Endereço de depósito", "ru": "Адрес для депозита", "ar": "عنوان الإيداع",
        "vi": "Địa chỉ nạp tiền", "th": "ที่อยู่ฝากเงิน", "id": "Alamat deposit"
    },
    "wallet.depositSuccess": {
        "pt": "Depósito enviado", "ru": "Депозит отправлен", "ar": "تم إرسال الإيداع",
        "vi": "Đã gửi nạp tiền", "th": "ส่งการฝากแล้ว", "id": "Deposit terkirim"
    },
    "wallet.failed": {
        "pt": "Falhou", "ru": "Ошибка", "ar": "فشل",
        "vi": "Thất bại", "th": "ล้มเหลว", "id": "Gagal"
    },
    "wallet.fillAll": {
        "pt": "Preencha todos os campos", "ru": "Заполните все поля", "ar": "أكمل جميع الحقول",
        "vi": "Điền đầy đủ thông tin", "th": "กรอกข้อมูลให้ครบ", "id": "Isi semua kolom"
    },
    "wallet.frozen": {
        "pt": "Congelado", "ru": "Заморожено", "ar": "مجمد",
        "vi": "Đã đóng băng", "th": "ถูกระงับ", "id": "Dibekukan"
    },
    "wallet.gameFlow": {
        "pt": "Fluxo de jogo", "ru": "Игровой поток", "ar": "سجل اللعبة",
        "vi": "Lịch sử game", "th": "ประวัติเกม", "id": "Alur permainan"
    },
    "wallet.leaveTable": {
        "pt": "Sair da mesa (devolução)", "ru": "Покинуть стол (возврат)", "ar": "مغادرة الطاولة (استرداد)",
        "vi": "Rời bàn (hoàn trả)", "th": "ออกจากโต๊ะ (คืนเงิน)", "id": "Tinggalkan meja (pengembalian)"
    },
    "wallet.netPnl": {
        "pt": "P&G Líquido", "ru": "Чистый P&L", "ar": "صافي الربح والخسارة",
        "vi": "Lãi/lỗ ròng", "th": "กำไร/ขาดทุนสุทธิ", "id": "P&L bersih"
    },
    "wallet.noGameFlow": {
        "pt": "Sem registros de jogo", "ru": "Нет игровых записей", "ar": "لا توجد سجلات لعب",
        "vi": "Chưa có lịch sử game", "th": "ยังไม่มีประวัติเกม", "id": "Belum ada catatan permainan"
    },
    "wallet.noHistory": {
        "pt": "Sem histórico", "ru": "Нет истории", "ar": "لا يوجد سجل",
        "vi": "Không có lịch sử", "th": "ไม่มีประวัติ", "id": "Tidak ada riwayat"
    },
    "wallet.pending": {
        "pt": "Pendente", "ru": "Ожидание", "ar": "معلق",
        "vi": "Đang chờ", "th": "กำลังรอ", "id": "Menunggu"
    },
    "wallet.rebuy": {
        "pt": "Recompra", "ru": "Рекупит", "ar": "إعادة الشراء",
        "vi": "Rebuy", "th": "รีบาย", "id": "Rebuy"
    },
    "wallet.totalBuyIn": {
        "pt": "Compra total", "ru": "Общий бай-ин", "ar": "إجمالي الشراء",
        "vi": "Tổng mua chip", "th": "บาย-อินรวม", "id": "Total buy-in"
    },
    "wallet.totalReturn": {
        "pt": "Retorno total", "ru": "Общий возврат", "ar": "إجمالي العائد",
        "vi": "Tổng hoàn trả", "th": "ผลตอบแทนรวม", "id": "Total pengembalian"
    },
    "wallet.txHash": {
        "pt": "Hash TX", "ru": "Хэш TX", "ar": "هاش TX",
        "vi": "Hash TX", "th": "Hash TX", "id": "Hash TX"
    },
    "wallet.txHashPlaceholder": {
        "pt": "Insira o hash TX", "ru": "Введите хэш TX", "ar": "أدخل هاش TX",
        "vi": "Nhập hash TX", "th": "ใส่ Hash TX", "id": "Masukkan hash TX"
    },
    "wallet.withdrawSuccess": {
        "pt": "Retirada enviada", "ru": "Вывод отправлен", "ar": "تم إرسال السحب",
        "vi": "Đã gửi rút tiền", "th": "ส่งการถอนแล้ว", "id": "Penarikan terkirim"
    },
}

# Language code mapping
LANG_CODES = {
    "pt": "const pt",
    "ru": "const ru",
    "ar": "const ar",
    "vi": "const vi",
    "th": "const th",
    "id": "const id",
}

def get_lang_block(content, lang_const):
    """Extract language block"""
    pattern = rf'{re.escape(lang_const)}: Record<string, string> = \{{(.*?)\n\}};'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1)
    return None

def get_existing_keys(block_text):
    """Get all existing keys in a block"""
    pairs = re.findall(r'"([^"]+)": "([^"]*(?:\\.[^"]*)*?)"', block_text)
    return {k for k, v in pairs}

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for lang_key, lang_const in LANG_CODES.items():
    block = get_lang_block(content, lang_const)
    if not block:
        print(f"WARNING: Could not find {lang_const} block")
        continue
    
    existing = get_existing_keys(block)
    missing_for_lang = {k: v[lang_key] for k, v in MISSING_TRANSLATIONS.items() if k not in existing and lang_key in v}
    
    if not missing_for_lang:
        print(f"{lang_key}: already complete")
        continue
    
    print(f"{lang_key}: adding {len(missing_for_lang)} keys")
    
    # Build the insertion string
    lines = []
    for k, v in missing_for_lang.items():
        # Escape double quotes in value
        v_escaped = v.replace('\\', '\\\\').replace('"', '\\"')
        lines.append(f'  "{k}": "{v_escaped}"')
    
    insertion = ',\n'.join(lines)
    
    # Find the closing }; of this language block and insert before it
    # We need to find the exact closing of this block
    block_start = content.find(f'{lang_const}: Record<string, string> = {{')
    if block_start == -1:
        print(f"WARNING: Could not find start of {lang_const}")
        continue
    
    # Find the matching closing brace
    brace_count = 0
    i = block_start
    while i < len(content):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                break
        i += 1
    
    # Insert before the closing brace
    content = content[:i] + ',\n' + insertion + '\n' + content[i:]

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
