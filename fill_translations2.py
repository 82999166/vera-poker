#!/usr/bin/env python3
"""
批量为 pt/ru/ar/vi/th/id 补充缺失的翻译键 - 第二批
"""
import re

MISSING_TRANSLATIONS = {
    "cs.error": {
        "pt": "Erro no suporte", "ru": "Ошибка поддержки", "ar": "خطأ في الدعم",
        "vi": "Lỗi hỗ trợ", "th": "ข้อผิดพลาดการสนับสนุน", "id": "Error dukungan"
    },
    "cs.goToHumanAgent": {
        "pt": "Ir para agente", "ru": "Перейти к агенту", "ar": "الذهاب إلى الوكيل",
        "vi": "Đến nhân viên", "th": "ไปยังเจ้าหน้าที่", "id": "Ke agen"
    },
    "cs.suggestTransfer": {
        "pt": "Transferir para agente humano?", "ru": "Перевести на живого агента?", "ar": "تحويل إلى وكيل بشري؟",
        "vi": "Chuyển sang nhân viên?", "th": "โอนไปยังเจ้าหน้าที่?", "id": "Transfer ke agen manusia?"
    },
    "cs.transferHuman": {
        "pt": "Transferir para humano", "ru": "Перевести на человека", "ar": "تحويل إلى إنسان",
        "vi": "Chuyển sang người thật", "th": "โอนไปยังคน", "id": "Transfer ke manusia"
    },
    "cs.transferPrompt": {
        "pt": "Conectando com um agente. Clique abaixo.", "ru": "Подключаюсь к агенту. Нажмите ниже.", "ar": "جارٍ التواصل مع وكيل. انقر أدناه.",
        "vi": "Đang kết nối với nhân viên. Nhấn bên dưới.", "th": "กำลังเชื่อมต่อกับเจ้าหน้าที่ คลิกด้านล่าง", "id": "Menghubungkan dengan agen. Klik di bawah."
    },
    "cs.welcome": {
        "pt": "Olá! Como posso ajudar?", "ru": "Привет! Чем могу помочь?", "ar": "مرحباً! كيف يمكنني مساعدتك؟",
        "vi": "Xin chào! Tôi có thể giúp gì?", "th": "สวัสดี! ฉันช่วยอะไรได้บ้าง?", "id": "Halo! Apa yang bisa saya bantu?"
    },
    "hand.draw.flushDraw": {
        "pt": "Flush Draw", "ru": "Флеш-дро", "ar": "فلاش دراو",
        "vi": "Flush Draw", "th": "ฟลัชดรอว์", "id": "Flush Draw"
    },
    "hand.draw.gutshot": {
        "pt": "Gutshot", "ru": "Гатшот", "ar": "جاتشوت",
        "vi": "Gutshot", "th": "กัทช็อต", "id": "Gutshot"
    },
    "hand.draw.oesd": {
        "pt": "Straight Draw Aberto", "ru": "Двусторонний стрит-дро", "ar": "سترايت دراو مفتوح",
        "vi": "Straight Draw 2 đầu", "th": "โอเพนเอนด์สตรเตตดรอว์", "id": "Open-Ended Straight Draw"
    },
    "hand.draw.sfDraw": {
        "pt": "Straight Flush Draw", "ru": "Стрит-флеш дро", "ar": "سترايت فلاش دراو",
        "vi": "Straight Flush Draw", "th": "สตรเตตฟลัชดรอว์", "id": "Straight Flush Draw"
    },
    "hand.flush": {
        "pt": "Flush", "ru": "Флеш", "ar": "فلاش",
        "vi": "Flush", "th": "ฟลัช", "id": "Flush"
    },
    "hand.fourOfAKind": {
        "pt": "Quadra", "ru": "Каре", "ar": "فور أوراق",
        "vi": "Tứ quý", "th": "สี่ใบ", "id": "Four of a Kind"
    },
    "hand.fullHouse": {
        "pt": "Full House", "ru": "Фулл Хаус", "ar": "فول هاوس",
        "vi": "Full House", "th": "ฟุลเฮาส์", "id": "Full House"
    },
    "hand.highCard": {
        "pt": "Carta Alta", "ru": "Старшая карта", "ar": "أعلى ورقة",
        "vi": "Bài cao", "th": "ไพ่สูง", "id": "High Card"
    },
    "hand.lastStanding": {
        "pt": "Último em pé", "ru": "Последний оставшийся", "ar": "آخر واقف",
        "vi": "Người cuối cùng", "th": "คนสุดท้าย", "id": "Terakhir berdiri"
    },
    "hand.onePair": {
        "pt": "Um Par", "ru": "Пара", "ar": "زوج",
        "vi": "Một đôi", "th": "หนึ่งคู่", "id": "One Pair"
    },
    "hand.royalFlush": {
        "pt": "Royal Flush", "ru": "Рояль Флеш", "ar": "رويال فلاش",
        "vi": "Royal Flush", "th": "รอยัลฟลัช", "id": "Royal Flush"
    },
    "hand.straight": {
        "pt": "Sequência", "ru": "Стрит", "ar": "سترايت",
        "vi": "Sảnh", "th": "สตรเตต", "id": "Straight"
    },
    "hand.straightFlush": {
        "pt": "Straight Flush", "ru": "Стрит-Флеш", "ar": "سترايت فلاش",
        "vi": "Straight Flush", "th": "สตรเตตฟลัช", "id": "Straight Flush"
    },
    "hand.threeOfAKind": {
        "pt": "Trinca", "ru": "Тройка", "ar": "ثلاثة أوراق",
        "vi": "Bộ ba", "th": "สามใบ", "id": "Three of a Kind"
    },
    "hand.twoPair": {
        "pt": "Dois Pares", "ru": "Две пары", "ar": "زوجان",
        "vi": "Hai đôi", "th": "สองคู่", "id": "Two Pair"
    },
    "leaderboard.hands": {
        "pt": "Mãos", "ru": "Раздач", "ar": "الأيدي",
        "vi": "Ván", "th": "มือ", "id": "Tangan"
    },
    "leaderboard.handsUnit": {
        "pt": "mãos", "ru": "раздач", "ar": "يد",
        "vi": "ván", "th": "มือ", "id": "tangan"
    },
    "leaderboard.minHandsHint": {
        "pt": "Mín. {n} mãos para entrar no ranking", "ru": "Мин. {n} раздач для рейтинга", "ar": "الحد الأدنى {n} يداً للترتيب",
        "vi": "Tối thiểu {n} ván để vào bảng xếp hạng", "th": "ขั้นต่ำ {n} มือเพื่อเข้าอันดับ", "id": "Min. {n} tangan untuk masuk peringkat"
    },
    "leaderboard.profit": {
        "pt": "Lucro", "ru": "Прибыль", "ar": "الربح",
        "vi": "Lợi nhuận", "th": "กำไร", "id": "Keuntungan"
    },
    "leaderboard.title": {
        "pt": "Placar", "ru": "Таблица лидеров", "ar": "لوحة المتصدرين",
        "vi": "Bảng xếp hạng", "th": "กระดานผู้นำ", "id": "Papan peringkat"
    },
    "leaderboard.winRate": {
        "pt": "Taxa de vitória", "ru": "Процент побед", "ar": "معدل الفوز",
        "vi": "Tỷ lệ thắng", "th": "อัตราชนะ", "id": "Tingkat kemenangan"
    },
    "leaderboard.you": {
        "pt": "Você", "ru": "Вы", "ar": "أنت",
        "vi": "Bạn", "th": "คุณ", "id": "Anda"
    },
    "lobby.enterRoomCode": {
        "pt": "Inserir código da sala", "ru": "Ввести код комнаты", "ar": "أدخل رمز الغرفة",
        "vi": "Nhập mã phòng", "th": "ใส่รหัสห้อง", "id": "Masukkan kode ruangan"
    },
    "lobby.fast": {
        "pt": "Rápido", "ru": "Быстро", "ar": "سريع",
        "vi": "Nhanh", "th": "เร็ว", "id": "Cepat"
    },
    "lobby.filter.all": {
        "pt": "Todos", "ru": "Все", "ar": "الكل",
        "vi": "Tất cả", "th": "ทั้งหมด", "id": "Semua"
    },
    "lobby.filter.high": {
        "pt": "Alto", "ru": "Высокий", "ar": "عالي",
        "vi": "Cao", "th": "สูง", "id": "Tinggi"
    },
    "lobby.filter.low": {
        "pt": "Baixo", "ru": "Низкий", "ar": "منخفض",
        "vi": "Thấp", "th": "ต่ำ", "id": "Rendah"
    },
    "lobby.filter.mid": {
        "pt": "Médio", "ru": "Средний", "ar": "متوسط",
        "vi": "Trung bình", "th": "กลาง", "id": "Menengah"
    },
    "lobby.filter.vip": {
        "pt": "VIP", "ru": "VIP", "ar": "VIP",
        "vi": "VIP", "th": "VIP", "id": "VIP"
    },
    "lobby.full": {
        "pt": "Cheio", "ru": "Полный", "ar": "ممتلئ",
        "vi": "Đầy", "th": "เต็ม", "id": "Penuh"
    },
    "lobby.invalidRoomCode": {
        "pt": "Código inválido", "ru": "Неверный код", "ar": "رمز غير صالح",
        "vi": "Mã không hợp lệ", "th": "รหัสไม่ถูกต้อง", "id": "Kode tidak valid"
    },
    "lobby.leaderboard": {
        "pt": "Placar", "ru": "Рейтинг", "ar": "المتصدرون",
        "vi": "Bảng xếp hạng", "th": "กระดานผู้นำ", "id": "Papan peringkat"
    },
    "lobby.live": {
        "pt": "Ao vivo", "ru": "В эфире", "ar": "مباشر",
        "vi": "Trực tiếp", "th": "สด", "id": "Langsung"
    },
    "lobby.onChain": {
        "pt": "On-chain", "ru": "Он-чейн", "ar": "على السلسلة",
        "vi": "Trên chuỗi", "th": "บนเชน", "id": "On-chain"
    },
    "lobby.onlineSuffix": {
        "pt": "online", "ru": "онлайн", "ar": "متصل",
        "vi": "trực tuyến", "th": "ออนไลน์", "id": "online"
    },
    "lobby.returnToTable": {
        "pt": "Voltar à mesa", "ru": "Вернуться к столу", "ar": "العودة إلى الطاولة",
        "vi": "Quay lại bàn", "th": "กลับไปโต๊ะ", "id": "Kembali ke meja"
    },
    "lobby.tables": {
        "pt": "Mesas", "ru": "Столы", "ar": "الطاولات",
        "vi": "Bàn", "th": "โต๊ะ", "id": "Meja"
    },
    "lobby.tourneysDesc": {
        "pt": "Torneios com prêmios garantidos", "ru": "Турниры с гарантированными призами", "ar": "بطولات بجوائز مضمونة",
        "vi": "Giải đấu với giải thưởng đảm bảo", "th": "ทัวร์นาเมนต์พร้อมรางวัลรับประกัน", "id": "Turnamen dengan hadiah terjamin"
    },
    "lobby.tourneysSoon": {
        "pt": "Em breve", "ru": "Скоро", "ar": "قريباً",
        "vi": "Sắp có", "th": "เร็วๆ นี้", "id": "Segera hadir"
    },
    "profile.accountInfo": {
        "pt": "Informações da conta", "ru": "Информация об аккаунте", "ar": "معلومات الحساب",
        "vi": "Thông tin tài khoản", "th": "ข้อมูลบัญชี", "id": "Informasi akun"
    },
    "profile.achievements": {
        "pt": "Conquistas", "ru": "Достижения", "ar": "الإنجازات",
        "vi": "Thành tích", "th": "ความสำเร็จ", "id": "Pencapaian"
    },
    "profile.agentEntry": {
        "pt": "Centro de agente", "ru": "Центр агента", "ar": "مركز الوكيل",
        "vi": "Trung tâm đại lý", "th": "ศูนย์ตัวแทน", "id": "Pusat agen"
    },
    "profile.agentEntryDesc": {
        "pt": "Convide amigos e ganhe comissão", "ru": "Приглашайте друзей и зарабатывайте", "ar": "ادعو أصدقاء واكسب عمولة",
        "vi": "Mời bạn bè và kiếm hoa hồng", "th": "เชิญเพื่อนและรับค่าคอมมิชชั่น", "id": "Undang teman dan dapatkan komisi"
    },
    "profile.agentLevel": {
        "pt": "Nível de agente", "ru": "Уровень агента", "ar": "مستوى الوكيل",
        "vi": "Cấp độ đại lý", "th": "ระดับตัวแทน", "id": "Level agen"
    },
    "profile.agentLevelAgent": {
        "pt": "Agente", "ru": "Агент", "ar": "وكيل",
        "vi": "Đại lý", "th": "ตัวแทน", "id": "Agen"
    },
    "profile.agentLevelUser": {
        "pt": "Usuário", "ru": "Пользователь", "ar": "مستخدم",
        "vi": "Người dùng", "th": "ผู้ใช้", "id": "Pengguna"
    },
    "profile.balance": {
        "pt": "Saldo", "ru": "Баланс", "ar": "الرصيد",
        "vi": "Số dư", "th": "ยอดคงเหลือ", "id": "Saldo"
    },
    "profile.gameStats": {
        "pt": "Estatísticas de jogo", "ru": "Игровая статистика", "ar": "إحصائيات اللعبة",
        "vi": "Thống kê game", "th": "สถิติเกม", "id": "Statistik permainan"
    },
    "profile.inviteCode": {
        "pt": "Código de convite", "ru": "Код приглашения", "ar": "رمز الدعوة",
        "vi": "Mã mời", "th": "รหัสเชิญ", "id": "Kode undangan"
    },
    "profile.inviteCodeNone": {
        "pt": "Sem código", "ru": "Нет кода", "ar": "لا يوجد رمز",
        "vi": "Không có mã", "th": "ไม่มีรหัส", "id": "Tidak ada kode"
    },
    "profile.language": {
        "pt": "Idioma", "ru": "Язык", "ar": "اللغة",
        "vi": "Ngôn ngữ", "th": "ภาษา", "id": "Bahasa"
    },
    "profile.lastLogin": {
        "pt": "Último acesso", "ru": "Последний вход", "ar": "آخر تسجيل دخول",
        "vi": "Đăng nhập lần cuối", "th": "เข้าสู่ระบบล่าสุด", "id": "Login terakhir"
    },
    "profile.newAchievements": {
        "pt": "Novas conquistas!", "ru": "Новые достижения!", "ar": "إنجازات جديدة!",
        "vi": "Thành tích mới!", "th": "ความสำเร็จใหม่!", "id": "Pencapaian baru!"
    },
    "profile.nicknamePlaceholder": {
        "pt": "Seu apelido", "ru": "Ваш псевдоним", "ar": "لقبك",
        "vi": "Biệt danh của bạn", "th": "ชื่อเล่นของคุณ", "id": "Nama panggilan Anda"
    },
    "profile.nicknameUpdated": {
        "pt": "Apelido atualizado!", "ru": "Псевдоним обновлён!", "ar": "تم تحديث اللقب!",
        "vi": "Đã cập nhật biệt danh!", "th": "อัปเดตชื่อเล่นแล้ว!", "id": "Nama panggilan diperbarui!"
    },
    "profile.noAchievements": {
        "pt": "Sem conquistas ainda", "ru": "Нет достижений", "ar": "لا توجد إنجازات بعد",
        "vi": "Chưa có thành tích", "th": "ยังไม่มีความสำเร็จ", "id": "Belum ada pencapaian"
    },
    "profile.registeredAt": {
        "pt": "Registrado em", "ru": "Зарегистрирован", "ar": "مسجل في",
        "vi": "Đăng ký lúc", "th": "ลงทะเบียนเมื่อ", "id": "Terdaftar pada"
    },
    "profile.tgBind": {
        "pt": "Vincular Telegram", "ru": "Привязать Telegram", "ar": "ربط Telegram",
        "vi": "Liên kết Telegram", "th": "เชื่อมต่อ Telegram", "id": "Hubungkan Telegram"
    },
    "profile.tgBindHint": {
        "pt": "Vincule para receber notificações", "ru": "Привяжите для уведомлений", "ar": "اربط لتلقي الإشعارات",
        "vi": "Liên kết để nhận thông báo", "th": "เชื่อมต่อเพื่อรับการแจ้งเตือน", "id": "Hubungkan untuk menerima notifikasi"
    },
    "profile.tgBinding": {
        "pt": "Vinculando...", "ru": "Привязка...", "ar": "جارٍ الربط...",
        "vi": "Đang liên kết...", "th": "กำลังเชื่อมต่อ...", "id": "Menghubungkan..."
    },
    "profile.tgBound": {
        "pt": "Telegram vinculado", "ru": "Telegram привязан", "ar": "Telegram مرتبط",
        "vi": "Đã liên kết Telegram", "th": "เชื่อมต่อ Telegram แล้ว", "id": "Telegram terhubung"
    },
    "profile.tgUnbind": {
        "pt": "Desvincular Telegram", "ru": "Отвязать Telegram", "ar": "فك ربط Telegram",
        "vi": "Hủy liên kết Telegram", "th": "ยกเลิกการเชื่อมต่อ Telegram", "id": "Putuskan Telegram"
    },
    "profile.tgUnbindConfirm": {
        "pt": "Desvincular Telegram?", "ru": "Отвязать Telegram?", "ar": "فك ربط Telegram؟",
        "vi": "Hủy liên kết Telegram?", "th": "ยกเลิกการเชื่อมต่อ Telegram?", "id": "Putuskan Telegram?"
    },
    "profile.tgUnbindSuccess": {
        "pt": "Telegram desvinculado", "ru": "Telegram отвязан", "ar": "تم فك ربط Telegram",
        "vi": "Đã hủy liên kết Telegram", "th": "ยกเลิกการเชื่อมต่อ Telegram แล้ว", "id": "Telegram diputuskan"
    },
    "profile.tgUnbound": {
        "pt": "Telegram não vinculado", "ru": "Telegram не привязан", "ar": "Telegram غير مرتبط",
        "vi": "Chưa liên kết Telegram", "th": "ยังไม่ได้เชื่อมต่อ Telegram", "id": "Telegram belum terhubung"
    },
    "profile.tgUnboundHint": {
        "pt": "Vincule para receber alertas de jogo", "ru": "Привяжите для игровых уведомлений", "ar": "اربط لتلقي تنبيهات اللعبة",
        "vi": "Liên kết để nhận cảnh báo game", "th": "เชื่อมต่อเพื่อรับการแจ้งเตือนเกม", "id": "Hubungkan untuk menerima notifikasi game"
    },
    "profile.totalGames": {
        "pt": "Total de jogos", "ru": "Всего игр", "ar": "إجمالي الألعاب",
        "vi": "Tổng số game", "th": "เกมทั้งหมด", "id": "Total permainan"
    },
    "profile.totalHands": {
        "pt": "Total de mãos", "ru": "Всего раздач", "ar": "إجمالي الأيدي",
        "vi": "Tổng số ván", "th": "มือทั้งหมด", "id": "Total tangan"
    },
    "profile.userId": {
        "pt": "ID do usuário", "ru": "ID пользователя", "ar": "معرف المستخدم",
        "vi": "ID người dùng", "th": "ID ผู้ใช้", "id": "ID pengguna"
    },
    "rebuy.amount": {
        "pt": "Valor de recarga", "ru": "Сумма рекупита", "ar": "مبلغ إعادة الشراء",
        "vi": "Số tiền rebuy", "th": "จำนวนรีบาย", "id": "Jumlah rebuy"
    },
    "rebuy.autoRebuy": {
        "pt": "Recarga automática", "ru": "Авто-рекупит", "ar": "إعادة شراء تلقائية",
        "vi": "Tự động rebuy", "th": "รีบายอัตโนมัติ", "id": "Rebuy otomatis"
    },
    "rebuy.disableAuto": {
        "pt": "Desativar auto", "ru": "Отключить авто", "ar": "تعطيل التلقائي",
        "vi": "Tắt tự động", "th": "ปิดอัตโนมัติ", "id": "Nonaktifkan otomatis"
    },
    "rebuy.enableAuto": {
        "pt": "Ativar auto", "ru": "Включить авто", "ar": "تفعيل التلقائي",
        "vi": "Bật tự động", "th": "เปิดอัตโนมัติ", "id": "Aktifkan otomatis"
    },
    "rebuy.invalidAmount": {
        "pt": "Valor inválido", "ru": "Неверная сумма", "ar": "مبلغ غير صالح",
        "vi": "Số tiền không hợp lệ", "th": "จำนวนไม่ถูกต้อง", "id": "Jumlah tidak valid"
    },
    "rebuy.targetAmount": {
        "pt": "Valor alvo", "ru": "Целевая сумма", "ar": "المبلغ المستهدف",
        "vi": "Số tiền mục tiêu", "th": "จำนวนเป้าหมาย", "id": "Jumlah target"
    },
    "rebuy.threshold": {
        "pt": "Limite de recarga", "ru": "Порог рекупита", "ar": "حد إعادة الشراء",
        "vi": "Ngưỡng rebuy", "th": "เกณฑ์รีบาย", "id": "Ambang rebuy"
    },
    "room.billing": {
        "pt": "Cobrança", "ru": "Биллинг", "ar": "الفوترة",
        "vi": "Thanh toán", "th": "การเรียกเก็บเงิน", "id": "Penagihan"
    },
    "room.billingFlatDesc": {
        "pt": "Taxa fixa por rodada", "ru": "Фиксированная плата за раунд", "ar": "رسوم ثابتة لكل جولة",
        "vi": "Phí cố định mỗi vòng", "th": "ค่าธรรมเนียมคงที่ต่อรอบ", "id": "Biaya tetap per ronde"
    },
    "room.billingRakeDesc": {
        "pt": "Porcentagem do pote", "ru": "Процент от банка", "ar": "نسبة من الوعاء",
        "vi": "Phần trăm pot", "th": "เปอร์เซ็นต์ของพ็อต", "id": "Persentase pot"
    },
    "room.blinds": {
        "pt": "Blinds", "ru": "Блайнды", "ar": "البلايند",
        "vi": "Blinds", "th": "บลายด์", "id": "Blinds"
    },
    "room.create": {
        "pt": "Criar", "ru": "Создать", "ar": "إنشاء",
        "vi": "Tạo", "th": "สร้าง", "id": "Buat"
    },
    "room.created": {
        "pt": "Sala criada", "ru": "Комната создана", "ar": "تم إنشاء الغرفة",
        "vi": "Phòng đã tạo", "th": "สร้างห้องแล้ว", "id": "Ruangan dibuat"
    },
    "room.createdHint": {
        "pt": "Compartilhe o código com amigos", "ru": "Поделитесь кодом с друзьями", "ar": "شارك الرمز مع الأصدقاء",
        "vi": "Chia sẻ mã với bạn bè", "th": "แชร์รหัสให้เพื่อน", "id": "Bagikan kode ke teman"
    },
    "room.createdSuccess": {
        "pt": "Sala criada com sucesso!", "ru": "Комната успешно создана!", "ar": "تم إنشاء الغرفة بنجاح!",
        "vi": "Tạo phòng thành công!", "th": "สร้างห้องสำเร็จ!", "id": "Ruangan berhasil dibuat!"
    },
    "room.enter": {
        "pt": "Entrar", "ru": "Войти", "ar": "دخول",
        "vi": "Vào", "th": "เข้า", "id": "Masuk"
    },
    "room.enterRoom": {
        "pt": "Entrar na sala", "ru": "Войти в комнату", "ar": "دخول الغرفة",
        "vi": "Vào phòng", "th": "เข้าห้อง", "id": "Masuk ruangan"
    },
    "room.invite": {
        "pt": "Convidar", "ru": "Пригласить", "ar": "دعوة",
        "vi": "Mời", "th": "เชิญ", "id": "Undang"
    },
    "room.inviteLink": {
        "pt": "Link de convite", "ru": "Ссылка приглашения", "ar": "رابط الدعوة",
        "vi": "Link mời", "th": "ลิงก์เชิญ", "id": "Link undangan"
    },
    "room.kick": {
        "pt": "Expulsar", "ru": "Выгнать", "ar": "طرد",
        "vi": "Đuổi", "th": "เตะออก", "id": "Keluarkan"
    },
    "room.manage": {
        "pt": "Gerenciar sala", "ru": "Управление комнатой", "ar": "إدارة الغرفة",
        "vi": "Quản lý phòng", "th": "จัดการห้อง", "id": "Kelola ruangan"
    },
    "room.nameRequired": {
        "pt": "Nome obrigatório", "ru": "Имя обязательно", "ar": "الاسم مطلوب",
        "vi": "Tên là bắt buộc", "th": "ต้องระบุชื่อ", "id": "Nama diperlukan"
    },
    "room.pause": {
        "pt": "Pausar", "ru": "Пауза", "ar": "إيقاف مؤقت",
        "vi": "Tạm dừng", "th": "หยุดชั่วคราว", "id": "Jeda"
    },
    "room.perRound": {
        "pt": "por rodada", "ru": "за раунд", "ar": "لكل جولة",
        "vi": "mỗi vòng", "th": "ต่อรอบ", "id": "per ronde"
    },
    "room.players": {
        "pt": "Jogadores", "ru": "Игроки", "ar": "اللاعبون",
        "vi": "Người chơi", "th": "ผู้เล่น", "id": "Pemain"
    },
    "room.resume": {
        "pt": "Retomar", "ru": "Возобновить", "ar": "استئناف",
        "vi": "Tiếp tục", "th": "ดำเนินต่อ", "id": "Lanjutkan"
    },
    "room.roundUnit": {
        "pt": "rodada", "ru": "раунд", "ar": "جولة",
        "vi": "vòng", "th": "รอบ", "id": "ronde"
    },
    "room.rounds": {
        "pt": "Rodadas", "ru": "Раунды", "ar": "الجولات",
        "vi": "Số vòng", "th": "รอบ", "id": "Ronde"
    },
    "room.roundsUnit": {
        "pt": "rodadas", "ru": "раундов", "ar": "جولات",
        "vi": "vòng", "th": "รอบ", "id": "ronde"
    },
    "room.share": {
        "pt": "Compartilhar", "ru": "Поделиться", "ar": "مشاركة",
        "vi": "Chia sẻ", "th": "แชร์", "id": "Bagikan"
    },
    "room.standardRake": {
        "pt": "Rake padrão", "ru": "Стандартный рейк", "ar": "الرسوم القياسية",
        "vi": "Rake tiêu chuẩn", "th": "Rake มาตรฐาน", "id": "Rake standar"
    },
    "sound.effects": {
        "pt": "Efeitos sonoros", "ru": "Звуковые эффекты", "ar": "المؤثرات الصوتية",
        "vi": "Hiệu ứng âm thanh", "th": "เอฟเฟกต์เสียง", "id": "Efek suara"
    },
    "sound.effectsDesc": {
        "pt": "Sons de cartas e fichas", "ru": "Звуки карт и фишек", "ar": "أصوات البطاقات والرقائق",
        "vi": "Âm thanh bài và chip", "th": "เสียงไพ่และชิป", "id": "Suara kartu dan chip"
    },
    "sound.title": {
        "pt": "Configurações de som", "ru": "Настройки звука", "ar": "إعدادات الصوت",
        "vi": "Cài đặt âm thanh", "th": "การตั้งค่าเสียง", "id": "Pengaturan suara"
    },
    "sound.voice": {
        "pt": "Voz", "ru": "Голос", "ar": "الصوت البشري",
        "vi": "Giọng nói", "th": "เสียงพูด", "id": "Suara"
    },
    "sound.voiceAll": {
        "pt": "Todas as vozes", "ru": "Все голoса", "ar": "كل الأصوات",
        "vi": "Tất cả giọng nói", "th": "เสียงทั้งหมด", "id": "Semua suara"
    },
    "sound.voiceDesc": {
        "pt": "Anúncios de ação do jogo", "ru": "Объявления игровых действий", "ar": "إعلانات إجراءات اللعبة",
        "vi": "Thông báo hành động game", "th": "ประกาศการกระทำในเกม", "id": "Pengumuman aksi permainan"
    },
}

LANG_CODES = {
    "pt": "const pt",
    "ru": "const ru",
    "ar": "const ar",
    "vi": "const vi",
    "th": "const th",
    "id": "const id",
}

def get_existing_keys(content, lang_const):
    pattern = rf'{re.escape(lang_const)}: Record<string, string> = \{{(.*?)\n\}};'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return set()
    block_text = match.group(1)
    pairs = re.findall(r'"([^"]+)": "([^"]*(?:\\.[^"]*)*?)"', block_text)
    return {k for k, v in pairs}

with open('client/src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for lang_key, lang_const in LANG_CODES.items():
    existing = get_existing_keys(content, lang_const)
    missing_for_lang = {k: v[lang_key] for k, v in MISSING_TRANSLATIONS.items() if k not in existing and lang_key in v}
    
    if not missing_for_lang:
        print(f"{lang_key}: already complete")
        continue
    
    print(f"{lang_key}: adding {len(missing_for_lang)} keys")
    
    lines = []
    for k, v in missing_for_lang.items():
        v_escaped = v.replace('\\', '\\\\').replace('"', '\\"')
        lines.append(f'  "{k}": "{v_escaped}"')
    
    insertion = ',\n'.join(lines)
    
    block_start = content.find(f'{lang_const}: Record<string, string> = {{')
    if block_start == -1:
        print(f"WARNING: Could not find start of {lang_const}")
        continue
    
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
    
    content = content[:i] + ',\n' + insertion + '\n' + content[i:]

with open('client/src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
