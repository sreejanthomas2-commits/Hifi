/* ╔══════════════════════════════════════════════════════════════════╗
   ║  INTERFACE STRINGS                                               ║
   ║                                                                  ║
   ║  One entry per translated language. Anything missing falls back  ║
   ║  to English key by key, so a half-finished language still reads. ║
   ║                                                                  ║
   ║  Trending, Cryptoverse and Shorty are product names and stay as  ║
   ║  they are in every language — the same way apps keep their own   ║
   ║  names. Everything else here is translated.                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const BRAND = { explore: 'Cryptoverse', reels: 'Shorty' };

window.I18N = {
  'en': { ...BRAND, feeds: 'Home', shop: 'Shop', gaming: 'Gaming', messages: 'Chat', community: 'Community', profile: 'Profile',
    composer_placeholder: "What's trending with you today?", search_placeholder: 'Search Trending...', post_btn: 'Post',
    publish_success: 'Published successfully! ✨ Check your Home Feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'en-GB': { ...BRAND, feeds: 'Home', shop: 'Shop', gaming: 'Gaming', messages: 'Chat', community: 'Community', profile: 'Profile',
    composer_placeholder: "What's trending with you today?", search_placeholder: 'Search Trending...', post_btn: 'Post',
    publish_success: 'Published successfully! ✨ Check your Home Feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'en-IN': { ...BRAND, feeds: 'Home', shop: 'Shop', gaming: 'Gaming', messages: 'Chat', community: 'Community', profile: 'Profile',
    composer_placeholder: "What's trending with you today?", search_placeholder: 'Search Trending...', post_btn: 'Post',
    publish_success: 'Published successfully! ✨ Check your Home Feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'hi': { ...BRAND, feeds: 'मुख्य', shop: 'दुकान', gaming: 'गेमिंग', messages: 'चैट', community: 'समुदाय', profile: 'प्रोफ़ाइल',
    composer_placeholder: 'आज आपके साथ क्या ट्रेंड कर रहा है?', search_placeholder: 'ट्रेंडिंग पर खोजें...', post_btn: 'पोस्ट',
    publish_success: 'सफलतापूर्वक प्रकाशित हुआ! अपना फ़ीड देखें।', word_feed: 'फ़ीड', word_hub: 'हब' },

  'bn': { ...BRAND, feeds: 'হোম', shop: 'দোকান', gaming: 'গেমিং', messages: 'চ্যাট', community: 'কমিউনিটি', profile: 'প্রোফাইল',
    composer_placeholder: 'আজ আপনার সাথে কী ট্রেন্ড করছে?', search_placeholder: 'Trending-এ খুঁজুন...', post_btn: 'পোস্ট',
    publish_success: 'সফলভাবে প্রকাশিত! আপনার ফিড দেখুন।', word_feed: 'ফিড', word_hub: 'হাব' },

  'pa': { ...BRAND, feeds: 'ਹੋਮ', shop: 'ਦੁਕਾਨ', gaming: 'ਗੇਮਿੰਗ', messages: 'ਚੈਟ', community: 'ਕਮਿਊਨਿਟੀ', profile: 'ਪ੍ਰੋਫਾਈਲ',
    composer_placeholder: 'ਅੱਜ ਤੁਹਾਡੇ ਨਾਲ ਕੀ ਟ੍ਰੈਂਡ ਕਰ ਰਿਹਾ ਹੈ?', search_placeholder: 'Trending ਵਿੱਚ ਖੋਜੋ...', post_btn: 'ਪੋਸਟ',
    publish_success: 'ਸਫਲਤਾਪੂਰਵਕ ਪ੍ਰਕਾਸ਼ਿਤ! ਆਪਣੀ ਫੀਡ ਵੇਖੋ।', word_feed: 'ਫੀਡ', word_hub: 'ਹੱਬ' },

  'mr': { ...BRAND, feeds: 'होम', shop: 'दुकान', gaming: 'गेमिंग', messages: 'चॅट', community: 'समुदाय', profile: 'प्रोफाइल',
    composer_placeholder: 'आज तुमच्यासोबत काय ट्रेंड करत आहे?', search_placeholder: 'Trending मध्ये शोधा...', post_btn: 'पोस्ट',
    publish_success: 'यशस्वीरित्या प्रकाशित! तुमचा फीड पहा.', word_feed: 'फीड', word_hub: 'हब' },

  'gu': { ...BRAND, feeds: 'હોમ', shop: 'દુકાન', gaming: 'ગેમિંગ', messages: 'ચેટ', community: 'સમુદાય', profile: 'પ્રોફાઇલ',
    composer_placeholder: 'આજે તમારી સાથે શું ટ્રેન્ડ કરી રહ્યું છે?', search_placeholder: 'Trending માં શોધો...', post_btn: 'પોસ્ટ',
    publish_success: 'સફળતાપૂર્વક પ્રકાશિત! તમારી ફીડ જુઓ.', word_feed: 'ફીડ', word_hub: 'હબ' },

  'ta': { ...BRAND, feeds: 'முகப்பு', shop: 'கடை', gaming: 'கேமிங்', messages: 'அரட்டை', community: 'சமூகம்', profile: 'சுயவிவரம்',
    composer_placeholder: 'இன்று உங்களுடன் என்ன டிரெண்ட் ஆகிறது?', search_placeholder: 'Trending இல் தேடு...', post_btn: 'இடுகை',
    publish_success: 'வெற்றிகரமாக வெளியிடப்பட்டது! உங்கள் ஊட்டத்தைப் பாருங்கள்.', word_feed: 'ஊட்டம்', word_hub: 'மையம்' },

  'te': { ...BRAND, feeds: 'హోమ్', shop: 'దుకాణం', gaming: 'గేమింగ్', messages: 'చాట్', community: 'సంఘం', profile: 'ప్రొఫైల్',
    composer_placeholder: 'ఈరోజు మీతో ఏమి ట్రెండ్ అవుతోంది?', search_placeholder: 'Trending లో వెతకండి...', post_btn: 'పోస్ట్',
    publish_success: 'విజయవంతంగా ప్రచురించబడింది! మీ ఫీడ్ చూడండి.', word_feed: 'ఫీడ్', word_hub: 'హబ్' },

  'ur': { ...BRAND, feeds: 'ہوم', shop: 'اسٹور', gaming: 'گیمنگ', messages: 'چیٹ', community: 'کمیونٹی', profile: 'پروفائل',
    composer_placeholder: 'آج آپ کے ساتھ کیا ٹرینڈ کر رہا ہے؟', search_placeholder: 'Trending میں تلاش کریں...', post_btn: 'پوسٹ',
    publish_success: 'کامیابی سے شائع ہو گیا! اپنی فیڈ دیکھیں۔', word_feed: 'فیڈ', word_hub: 'حب' },

  'ar': { ...BRAND, feeds: 'الرئيسية', shop: 'المتجر', gaming: 'الألعاب', messages: 'الدردشة', community: 'المجتمع', profile: 'الملف الشخصي',
    composer_placeholder: 'ما الرائج لديك اليوم؟', search_placeholder: 'ابحث في Trending...', post_btn: 'نشر',
    publish_success: 'تم النشر بنجاح! تحقق من موجزك.', word_feed: 'الموجز', word_hub: 'المركز' },

  'he': { ...BRAND, feeds: 'בית', shop: 'חנות', gaming: 'גיימינג', messages: 'צ׳אט', community: 'קהילה', profile: 'פרופיל',
    composer_placeholder: 'מה חם אצלך היום?', search_placeholder: 'חיפוש ב-Trending...', post_btn: 'פרסם',
    publish_success: 'פורסם בהצלחה! בדוק את הפיד שלך.', word_feed: 'פיד', word_hub: 'מרכז' },

  'fa': { ...BRAND, feeds: 'خانه', shop: 'فروشگاه', gaming: 'بازی', messages: 'گفتگو', community: 'انجمن', profile: 'نمایه',
    composer_placeholder: 'امروز چه چیزی برای شما پرطرفدار است؟', search_placeholder: 'جستجو در Trending...', post_btn: 'ارسال',
    publish_success: 'با موفقیت منتشر شد! فید خود را ببینید.', word_feed: 'فید', word_hub: 'مرکز' },

  'es': { ...BRAND, feeds: 'Inicio', shop: 'Tienda', gaming: 'Juegos', messages: 'Chat', community: 'Comunidad', profile: 'Perfil',
    composer_placeholder: '¿Qué es tendencia contigo hoy?', search_placeholder: 'Buscar en Trending...', post_btn: 'Publicar',
    publish_success: '¡Publicado con éxito! Revisa tu feed de inicio.', word_feed: 'Feed', word_hub: 'Centro' },

  'pt': { ...BRAND, feeds: 'Início', shop: 'Loja', gaming: 'Jogos', messages: 'Chat', community: 'Comunidade', profile: 'Perfil',
    composer_placeholder: 'O que está em alta com você hoje?', search_placeholder: 'Pesquisar no Trending...', post_btn: 'Publicar',
    publish_success: 'Publicado com sucesso! Confira seu feed.', word_feed: 'Feed', word_hub: 'Central' },

  'pt-PT': { ...BRAND, feeds: 'Início', shop: 'Loja', gaming: 'Jogos', messages: 'Chat', community: 'Comunidade', profile: 'Perfil',
    composer_placeholder: 'O que está em destaque consigo hoje?', search_placeholder: 'Pesquisar no Trending...', post_btn: 'Publicar',
    publish_success: 'Publicado com sucesso! Veja o seu feed.', word_feed: 'Feed', word_hub: 'Central' },

  'fr': { ...BRAND, feeds: 'Accueil', shop: 'Boutique', gaming: 'Jeux', messages: 'Chat', community: 'Communauté', profile: 'Profil',
    composer_placeholder: "Quoi de neuf pour vous aujourd'hui ?", search_placeholder: 'Rechercher sur Trending...', post_btn: 'Publier',
    publish_success: "Publié avec succès ! Consultez votre fil d'accueil.", word_feed: 'Fil', word_hub: 'Hub' },

  'de': { ...BRAND, feeds: 'Startseite', shop: 'Shop', gaming: 'Gaming', messages: 'Chat', community: 'Community', profile: 'Profil',
    composer_placeholder: 'Was ist heute bei dir angesagt?', search_placeholder: 'Trending durchsuchen...', post_btn: 'Posten',
    publish_success: 'Erfolgreich veröffentlicht! Sieh in deinem Feed nach.', word_feed: 'Feed', word_hub: 'Hub' },

  'it': { ...BRAND, feeds: 'Home', shop: 'Negozio', gaming: 'Giochi', messages: 'Chat', community: 'Community', profile: 'Profilo',
    composer_placeholder: "Cosa c'è di nuovo per te oggi?", search_placeholder: 'Cerca su Trending...', post_btn: 'Pubblica',
    publish_success: 'Pubblicato con successo! Controlla il tuo feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'nl': { ...BRAND, feeds: 'Home', shop: 'Winkel', gaming: 'Gaming', messages: 'Chat', community: 'Community', profile: 'Profiel',
    composer_placeholder: 'Wat is er vandaag trending bij jou?', search_placeholder: 'Zoeken in Trending...', post_btn: 'Plaatsen',
    publish_success: 'Succesvol geplaatst! Bekijk je feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'ru': { ...BRAND, feeds: 'Главная', shop: 'Магазин', gaming: 'Игры', messages: 'Чат', community: 'Сообщество', profile: 'Профиль',
    composer_placeholder: 'Что у вас в тренде сегодня?', search_placeholder: 'Поиск в Trending...', post_btn: 'Опубликовать',
    publish_success: 'Успешно опубликовано! Посмотрите свою ленту.', word_feed: 'Лента', word_hub: 'Центр' },

  'uk': { ...BRAND, feeds: 'Головна', shop: 'Магазин', gaming: 'Ігри', messages: 'Чат', community: 'Спільнота', profile: 'Профіль',
    composer_placeholder: 'Що у вас у тренді сьогодні?', search_placeholder: 'Пошук у Trending...', post_btn: 'Опублікувати',
    publish_success: 'Успішно опубліковано! Перегляньте свою стрічку.', word_feed: 'Стрічка', word_hub: 'Центр' },

  'pl': { ...BRAND, feeds: 'Główna', shop: 'Sklep', gaming: 'Gry', messages: 'Czat', community: 'Społeczność', profile: 'Profil',
    composer_placeholder: 'Co jest dziś u Ciebie na topie?', search_placeholder: 'Szukaj w Trending...', post_btn: 'Opublikuj',
    publish_success: 'Opublikowano! Sprawdź swój kanał.', word_feed: 'Kanał', word_hub: 'Centrum' },

  'tr': { ...BRAND, feeds: 'Ana Sayfa', shop: 'Mağaza', gaming: 'Oyun', messages: 'Sohbet', community: 'Topluluk', profile: 'Profil',
    composer_placeholder: 'Bugün senden ne trend oluyor?', search_placeholder: "Trending'de ara...", post_btn: 'Paylaş',
    publish_success: 'Başarıyla paylaşıldı! Akışını kontrol et.', word_feed: 'Akış', word_hub: 'Merkez' },

  'ja': { ...BRAND, feeds: 'ホーム', shop: 'ショップ', gaming: 'ゲーム', messages: 'チャット', community: 'コミュニティ', profile: 'プロフィール',
    composer_placeholder: '今日のあなたのトレンドは何ですか？', search_placeholder: 'トレンドで検索...', post_btn: '投稿',
    publish_success: '正常に投稿されました！フィードを確認してください。', word_feed: 'フィード', word_hub: 'ハブ' },

  'ko': { ...BRAND, feeds: '홈', shop: '쇼핑', gaming: '게임', messages: '채팅', community: '커뮤니티', profile: '프로필',
    composer_placeholder: '오늘 당신의 트렌드는 무엇인가요?', search_placeholder: 'Trending 검색...', post_btn: '게시',
    publish_success: '성공적으로 게시되었습니다! 피드를 확인하세요.', word_feed: '피드', word_hub: '허브' },

  'zh-CN': { ...BRAND, feeds: '首页', shop: '商店', gaming: '游戏', messages: '聊天', community: '社区', profile: '个人资料',
    composer_placeholder: '今天你有什么新鲜事？', search_placeholder: '搜索 Trending...', post_btn: '发布',
    publish_success: '发布成功！查看你的动态。', word_feed: '动态', word_hub: '中心' },

  'zh-TW': { ...BRAND, feeds: '首頁', shop: '商店', gaming: '遊戲', messages: '聊天', community: '社群', profile: '個人檔案',
    composer_placeholder: '今天你有什麼新鮮事？', search_placeholder: '搜尋 Trending...', post_btn: '發布',
    publish_success: '發布成功！查看你的動態。', word_feed: '動態', word_hub: '中心' },

  'id': { ...BRAND, feeds: 'Beranda', shop: 'Toko', gaming: 'Game', messages: 'Obrolan', community: 'Komunitas', profile: 'Profil',
    composer_placeholder: 'Apa yang sedang tren denganmu hari ini?', search_placeholder: 'Cari di Trending...', post_btn: 'Posting',
    publish_success: 'Berhasil diposting! Lihat beranda Anda.', word_feed: 'Beranda', word_hub: 'Pusat' },

  'ms': { ...BRAND, feeds: 'Utama', shop: 'Kedai', gaming: 'Permainan', messages: 'Sembang', community: 'Komuniti', profile: 'Profil',
    composer_placeholder: 'Apa yang sedang tren dengan anda hari ini?', search_placeholder: 'Cari di Trending...', post_btn: 'Hantar',
    publish_success: 'Berjaya dihantar! Lihat suapan anda.', word_feed: 'Suapan', word_hub: 'Hab' },

  'th': { ...BRAND, feeds: 'หน้าแรก', shop: 'ร้านค้า', gaming: 'เกม', messages: 'แชท', community: 'ชุมชน', profile: 'โปรไฟล์',
    composer_placeholder: 'วันนี้มีอะไรกำลังมาแรงกับคุณ?', search_placeholder: 'ค้นหาใน Trending...', post_btn: 'โพสต์',
    publish_success: 'โพสต์สำเร็จ! ดูฟีดของคุณ', word_feed: 'ฟีด', word_hub: 'ศูนย์รวม' },

  'vi': { ...BRAND, feeds: 'Trang chủ', shop: 'Cửa hàng', gaming: 'Trò chơi', messages: 'Trò chuyện', community: 'Cộng đồng', profile: 'Hồ sơ',
    composer_placeholder: 'Hôm nay bạn có gì thịnh hành?', search_placeholder: 'Tìm kiếm trên Trending...', post_btn: 'Đăng',
    publish_success: 'Đã đăng thành công! Xem bảng tin của bạn.', word_feed: 'Bảng tin', word_hub: 'Trung tâm' },

  'fil': { ...BRAND, feeds: 'Home', shop: 'Tindahan', gaming: 'Laro', messages: 'Chat', community: 'Komunidad', profile: 'Profile',
    composer_placeholder: 'Ano ang uso sa iyo ngayon?', search_placeholder: 'Maghanap sa Trending...', post_btn: 'I-post',
    publish_success: 'Matagumpay na na-post! Tingnan ang iyong feed.', word_feed: 'Feed', word_hub: 'Hub' },

  'sw': { ...BRAND, feeds: 'Mwanzo', shop: 'Duka', gaming: 'Michezo', messages: 'Gumzo', community: 'Jumuiya', profile: 'Wasifu',
    composer_placeholder: 'Nini kinachovuma kwako leo?', search_placeholder: 'Tafuta kwenye Trending...', post_btn: 'Chapisha',
    publish_success: 'Imechapishwa kikamilifu! Angalia mlisho wako.', word_feed: 'Mlisho', word_hub: 'Kitovu' }
};

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('data/i18n.js', {
  BRAND: () => BRAND
});
