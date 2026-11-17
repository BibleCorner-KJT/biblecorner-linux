"""2.8 · The app's menus in the nine languages of the website: the sidebar, the menu, what to do with chosen verses,
the tabs and headings of the pages. _('English words') gives them in the language chosen in Downloads (or the computer's).
Biblical and church words follow each language's own Bible and Church usage."""
from .core import lang

# en: ar, el, es, fr, hi, ru, tl, zh
_T = {
    'Today with God': ('اليوم مع الله', 'Σήμερα με τον Θεό', 'Hoy con Dios', 'Aujourd’hui avec Dieu', 'आज परमेश्वर के साथ', 'Сегодня с Богом', 'Ngayon kasama ang Diyos', '今日与神同在'),
    'The Holy Bible': ('الكتاب المقدس', 'Η Αγία Γραφή', 'La Santa Biblia', 'La Sainte Bible', 'पवित्र बाइबल', 'Священное Писание', 'Ang Banal na Bibliya', '圣经'),
    'The Holy Fathers': ('الآباء القديسون', 'Οι Άγιοι Πατέρες', 'Los Santos Padres', 'Les Saints Pères', 'पवित्र पिता', 'Святые Отцы', 'Ang mga Banal na Ama', '圣教父'),
    'Bible Dictionary': ('قاموس الكتاب المقدس', 'Λεξικό της Αγίας Γραφής', 'Diccionario bíblico', 'Dictionnaire biblique', 'बाइबल शब्दकोश', 'Библейский словарь', 'Diksiyonaryo ng Bibliya', '圣经词典'),
    'Bible Maps': ('خرائط الكتاب المقدس', 'Χάρτες της Αγίας Γραφής', 'Mapas bíblicos', 'Cartes bibliques', 'बाइबल के नक्शे', 'Библейские карты', 'Mga Mapa ng Bibliya', '圣经地图'),
    'Library': ('المكتبة', 'Βιβλιοθήκη', 'Biblioteca', 'Bibliothèque', 'पुस्तकालय', 'Библиотека', 'Aklatan', '书库'),
    'My Study': ('دراستي', 'Η μελέτη μου', 'Mi estudio', 'Mon étude', 'मेरा अध्ययन', 'Моё изучение', 'Aking Pag-aaral', '我的学习'),
    'Downloads': ('التنزيلات', 'Λήψεις', 'Descargas', 'Téléchargements', 'डाउनलोड', 'Загрузки', 'Mga Download', '下载'),
    'Downloads and language': ('التنزيلات واللغة', 'Λήψεις και γλώσσα', 'Descargas e idioma', 'Téléchargements et langue', 'डाउनलोड और भाषा', 'Загрузки и язык', 'Mga Download at wika', '下载与语言'),
    'Menu': ('القائمة', 'Μενού', 'Menú', 'Menu', 'मेनू', 'Меню', 'Menu', '菜单'),
    'Talk to us on SimpleX': ('تواصل معنا على SimpleX', 'Μίλησε μαζί μας στο SimpleX', 'Háblanos en SimpleX', 'Écris-nous sur SimpleX', 'SimpleX पर हमसे बात करें', 'Напишите нам в SimpleX', 'Kausapin kami sa SimpleX', '在 SimpleX 上联系我们'),
    'The Android app (Bible Corner)': ('تطبيق أندرويد (ركن الكتاب المقدس)', 'Η εφαρμογή Android (Bible Corner)', 'La app de Android (Bible Corner)', 'L’appli Android (Bible Corner)', 'Android ऐप (Bible Corner)', 'Приложение для Android (Bible Corner)', 'Ang Android app (Bible Corner)', '安卓应用（Bible Corner）'),
    'Daily verse post (administrators)': ('منشور آية اليوم (للمشرفين)', 'Ανάρτηση εδαφίου της ημέρας (διαχειριστές)', 'Publicación del versículo del día (administradores)', 'Publication du verset du jour (administrateurs)', 'आज के वचन की पोस्ट (प्रशासक)', 'Публикация стиха дня (администраторы)', 'Post ng talata ng araw (mga admin)', '每日经文发布（管理员）'),
    'Keyboard shortcuts': ('اختصارات لوحة المفاتيح', 'Συντομεύσεις πληκτρολογίου', 'Atajos de teclado', 'Raccourcis clavier', 'कीबोर्ड शॉर्टकट', 'Сочетания клавиш', 'Mga shortcut sa keyboard', '键盘快捷键'),
    'About Knowing Jesus Today': ('حول «معرفة يسوع اليوم»', 'Σχετικά με το Knowing Jesus Today', 'Acerca de Knowing Jesus Today', 'À propos de Knowing Jesus Today', 'Knowing Jesus Today के बारे में', 'О Knowing Jesus Today', 'Tungkol sa Knowing Jesus Today', '关于 Knowing Jesus Today'),
    # chosen verses
    'Cross-references': ('الشواهد', 'Παραπομπές', 'Referencias cruzadas', 'Références croisées', 'संदर्भ', 'Параллельные места', 'Mga kaugnay na talata', '串珠经文'),
    'Greek and Hebrew words': ('الكلمات اليونانية والعبرية', 'Ελληνικές και εβραϊκές λέξεις', 'Palabras griegas y hebreas', 'Mots grecs et hébreux', 'यूनानी और इब्रानी शब्द', 'Греческие и еврейские слова', 'Mga salitang Griyego at Hebreo', '希腊文与希伯来文'),
    'Copy': ('نسخ', 'Αντιγραφή', 'Copiar', 'Copier', 'कॉपी करें', 'Копировать', 'Kopyahin', '复制'),
    'Share as picture': ('شارك كصورة', 'Κοινοποίηση ως εικόνα', 'Compartir como imagen', 'Partager en image', 'चित्र के रूप में साझा करें', 'Поделиться картинкой', 'Ibahagi bilang larawan', '分享为图片'),
    'Bookmark': ('علامة', 'Σελιδοδείκτης', 'Marcador', 'Signet', 'बुकमार्क', 'Закладка', 'Bookmark', '书签'),
    'Remove bookmark': ('إزالة العلامة', 'Αφαίρεση σελιδοδείκτη', 'Quitar marcador', 'Retirer le signet', 'बुकमार्क हटाएँ', 'Убрать закладку', 'Alisin ang bookmark', '删除书签'),
    'Edit': ('تعديل', 'Επεξεργασία', 'Editar', 'Modifier', 'संपादित करें', 'Изменить', 'I-edit', '编辑'),
    'Note': ('ملاحظة', 'Σημείωση', 'Nota', 'Note', 'नोट', 'Заметка', 'Tala', '笔记'),
    'Study Pads': ('دفاتر الدراسة', 'Τετράδια μελέτης', 'Cuadernos de estudio', 'Carnets d’étude', 'स्टडी पैड', 'Тетради', 'Mga Study Pad', '学习本'),
    'Clear the choice': ('إلغاء التحديد', 'Καθαρισμός επιλογής', 'Quitar la selección', 'Effacer le choix', 'चुनाव हटाएँ', 'Снять выбор', 'Alisin ang pinili', '取消选择'),
    '− One less': ('− آية أقل', '− Ένα λιγότερο', '− Uno menos', '− Un de moins', '− एक कम', '− На один меньше', '− Isang bawas', '− 少一节'),
    '+ Next verse': ('+ الآية التالية', '+ Επόμενο εδάφιο', '+ Siguiente versículo', '+ Verset suivant', '+ अगला पद', '+ Следующий стих', '+ Susunod na talata', '+ 下一节'),
    'Write a note': ('اكتب ملاحظة', 'Γράψε μια σημείωση', 'Escribir una nota', 'Écrire une note', 'नोट लिखें', 'Написать заметку', 'Sumulat ng tala', '写笔记'),
    'Put in a Study Pad': ('ضع في دفتر دراسة', 'Βάλε σε τετράδιο μελέτης', 'Poner en un cuaderno', 'Mettre dans un carnet', 'स्टडी पैड में रखें', 'Положить в тетрадь', 'Ilagay sa Study Pad', '放入学习本'),
    'Listen to this chapter': ('استمع إلى هذا الأصحاح', 'Άκουσε αυτό το κεφάλαιο', 'Escuchar este capítulo', 'Écouter ce chapitre', 'यह अध्याय सुनें', 'Слушать эту главу', 'Pakinggan ang kabanatang ito', '收听本章'),
    'Places on the map': ('الأماكن على الخريطة', 'Τόποι στον χάρτη', 'Lugares en el mapa', 'Lieux sur la carte', 'नक्शे पर स्थान', 'Места на карте', 'Mga lugar sa mapa', '地图上的地点'),
    'The Holy Fathers on it': ('الآباء القديسون عنها', 'Οι Άγιοι Πατέρες γι’ αυτό', 'Los Santos Padres sobre esto', 'Les Saints Pères à ce sujet', 'इस पर पवित्र पिता', 'Святые Отцы об этом', 'Ang mga Banal na Ama tungkol dito', '圣教父论此'),
    'Compare with another Bible': ('قارن بترجمة أخرى', 'Σύγκριση με άλλη Γραφή', 'Comparar con otra Biblia', 'Comparer avec une autre Bible', 'दूसरी बाइबल से तुलना करें', 'Сравнить с другим переводом', 'Ihambing sa ibang Bibliya', '与其他译本对照'),
    # the reader's tools
    'Search the Bible (Ctrl+F)': ('ابحث في الكتاب المقدس (Ctrl+F)', 'Αναζήτηση στη Γραφή (Ctrl+F)', 'Buscar en la Biblia (Ctrl+F)', 'Chercher dans la Bible (Ctrl+F)', 'बाइबल में खोजें (Ctrl+F)', 'Поиск по Писанию (Ctrl+F)', 'Hanapin sa Bibliya (Ctrl+F)', '搜索圣经（Ctrl+F）'),
    'The Holy Fathers on this chapter': ('الآباء القديسون عن هذا الأصحاح', 'Οι Άγιοι Πατέρες για αυτό το κεφάλαιο', 'Los Santos Padres sobre este capítulo', 'Les Saints Pères sur ce chapitre', 'इस अध्याय पर पवित्र पिता', 'Святые Отцы об этой главе', 'Ang mga Banal na Ama sa kabanatang ito', '圣教父论本章'),
    'Listen': ('استمع', 'Άκουσε', 'Escuchar', 'Écouter', 'सुनें', 'Слушать', 'Makinig', '收听'),
    'Map of this chapter': ('خريطة هذا الأصحاح', 'Χάρτης αυτού του κεφαλαίου', 'Mapa de este capítulo', 'Carte de ce chapitre', 'इस अध्याय का नक्शा', 'Карта этой главы', 'Mapa ng kabanatang ito', '本章地图'),
    'Choose the Bible': ('اختر الترجمة', 'Επίλεξε Γραφή', 'Elegir la Biblia', 'Choisir la Bible', 'बाइबल चुनें', 'Выбрать перевод', 'Piliin ang Bibliya', '选择圣经'),
    'Previous chapter (←)': ('الأصحاح السابق (←)', 'Προηγούμενο κεφάλαιο (←)', 'Capítulo anterior (←)', 'Chapitre précédent (←)', 'पिछला अध्याय (←)', 'Предыдущая глава (←)', 'Nakaraang kabanata (←)', '上一章（←）'),
    'Next chapter (→)': ('الأصحاح التالي (→)', 'Επόμενο κεφάλαιο (→)', 'Capítulo siguiente (→)', 'Chapitre suivant (→)', 'अगला अध्याय (→)', 'Следующая глава (→)', 'Susunod na kabanata (→)', '下一章（→）'),
    'Choose a book and chapter': ('اختر سفرًا وأصحاحًا', 'Επίλεξε βιβλίο και κεφάλαιο', 'Elegir libro y capítulo', 'Choisir un livre et un chapitre', 'पुस्तक और अध्याय चुनें', 'Выбрать книгу и главу', 'Pumili ng aklat at kabanata', '选择书卷和章'),
    # pages
    'Bookmarks and notes': ('العلامات والملاحظات', 'Σελιδοδείκτες και σημειώσεις', 'Marcadores y notas', 'Signets et notes', 'बुकमार्क और नोट्स', 'Закладки и заметки', 'Mga bookmark at tala', '书签与笔记'),
    'New Study Pad': ('دفتر دراسة جديد', 'Νέο τετράδιο μελέτης', 'Nuevo cuaderno', 'Nouveau carnet', 'नया स्टडी पैड', 'Новая тетрадь', 'Bagong Study Pad', '新学习本'),
    'My KJT account': ('حسابي في KJT', 'Ο λογαριασμός μου KJT', 'Mi cuenta KJT', 'Mon compte KJT', 'मेरा KJT खाता', 'Мой аккаунт KJT', 'Aking KJT account', '我的 KJT 账户'),
    'Search your notes': ('ابحث في ملاحظاتك', 'Αναζήτηση στις σημειώσεις σου', 'Buscar en tus notas', 'Chercher dans tes notes', 'अपने नोट्स में खोजें', 'Поиск в заметках', 'Hanapin sa iyong mga tala', '搜索笔记'),
    'Passage and note': ('المقطع والملاحظة', 'Χωρίο και σημείωση', 'Pasaje y nota', 'Passage et note', 'अंश और नोट', 'Отрывок и заметка', 'Talata at tala', '经文与笔记'),
    'Bible': ('الترجمة', 'Γραφή', 'Biblia', 'Bible', 'बाइबल', 'Перевод', 'Bibliya', '圣经'),
    'Made': ('أُنشئ', 'Δημιουργία', 'Creado', 'Créé', 'बनाया', 'Создано', 'Ginawa', '创建'),
    'Changed': ('عُدّل', 'Αλλαγή', 'Cambiado', 'Modifié', 'बदला', 'Изменено', 'Binago', '修改'),
    'Bible order': ('ترتيب الكتاب', 'Σειρά της Γραφής', 'Orden bíblico', 'Ordre biblique', 'बाइबल क्रम', 'По порядку книг', 'Ayos ng Bibliya', '按圣经顺序'),
    'Newest first': ('الأحدث أولًا', 'Νεότερα πρώτα', 'Más recientes primero', 'Plus récents d’abord', 'नए पहले', 'Сначала новые', 'Pinakabago muna', '最新优先'),
    'Oldest first': ('الأقدم أولًا', 'Παλαιότερα πρώτα', 'Más antiguos primero', 'Plus anciens d’abord', 'पुराने पहले', 'Сначала старые', 'Pinakaluma muna', '最早优先'),
    'Last changed': ('آخر تعديل', 'Τελευταία αλλαγή', 'Último cambio', 'Dernière modification', 'हाल में बदले', 'Недавно изменённые', 'Huling binago', '最近修改'),
    'By colour': ('حسب اللون', 'Κατά χρώμα', 'Por color', 'Par couleur', 'रंग के अनुसार', 'По цвету', 'Ayon sa kulay', '按颜色'),
    'By Study Pad': ('حسب دفتر الدراسة', 'Κατά τετράδιο', 'Por cuaderno', 'Par carnet', 'स्टडी पैड के अनुसार', 'По тетради', 'Ayon sa Study Pad', '按学习本'),
    'By Bible': ('حسب الترجمة', 'Κατά Γραφή', 'Por Biblia', 'Par Bible', 'बाइबल के अनुसार', 'По переводу', 'Ayon sa Bibliya', '按译本'),
    'On this computer': ('على هذا الحاسوب', 'Σε αυτόν τον υπολογιστή', 'En este ordenador', 'Sur cet ordinateur', 'इस कंप्यूटर पर', 'На этом компьютере', 'Sa computer na ito', '本机'),
    'Get more': ('احصل على المزيد', 'Περισσότερα', 'Conseguir más', 'En obtenir plus', 'और पाएँ', 'Добавить', 'Kumuha pa', '获取更多'),
    'Search the whole of it': ('ابحث فيه كله', 'Αναζήτηση σε όλο', 'Buscar en todo', 'Chercher dans tout', 'पूरे में खोजें', 'Искать во всём', 'Hanapin sa kabuuan', '全文搜索'),
    'Read by topic': ('اقرأ حسب الموضوع', 'Διάβασε κατά θέμα', 'Leer por tema', 'Lire par thème', 'विषय के अनुसार पढ़ें', 'Читать по темам', 'Basahin ayon sa paksa', '按主题阅读'),
    '🕰 By era': ('🕰 حسب العصر', '🕰 Κατά εποχή', '🕰 Por época', '🕰 Par époque', '🕰 युग के अनुसार', '🕰 По эпохам', '🕰 Ayon sa panahon', '🕰 按时代'),
    '🔤 By author (A–Z)': ('🔤 حسب الكاتب (أ–ي)', '🔤 Κατά συγγραφέα (Α–Ω)', '🔤 Por autor (A–Z)', '🔤 Par auteur (A–Z)', '🔤 लेखक के अनुसार (A–Z)', '🔤 По авторам (А–Я)', '🔤 Ayon sa may-akda (A–Z)', '🔤 按作者（A–Z）'),
    'Find a Father or a writing': ('ابحث عن أب أو كتاب', 'Βρες Πατέρα ή έργο', 'Buscar un Padre o una obra', 'Chercher un Père ou un écrit', 'कोई पिता या लेख खोजें', 'Найти Отца или творение', 'Hanapin ang Ama o akda', '查找教父或著作'),
    'Find a place…': ('ابحث عن مكان…', 'Βρες έναν τόπο…', 'Buscar un lugar…', 'Chercher un lieu…', 'कोई स्थान खोजें…', 'Найти место…', 'Maghanap ng lugar…', '查找地点……'),
    'Some words change when the app is opened again.': ('تتغير بعض الكلمات عند فتح التطبيق مجددًا.', 'Κάποιες λέξεις αλλάζουν όταν ξανανοίξει η εφαρμογή.', 'Algunas palabras cambian al volver a abrir la app.', 'Certains mots changent à la prochaine ouverture de l’appli.', 'कुछ शब्द ऐप दोबारा खोलने पर बदलेंगे।', 'Некоторые слова изменятся при следующем запуске.', 'Magbabago ang ilang salita kapag binuksan muli ang app.', '部分文字将在重新打开应用后更改。'),
    'Bookmarked': ('عليها علامة', 'Με σελιδοδείκτη', 'Con marcador', 'Avec signet', 'बुकमार्क किया', 'В закладках', 'Naka-bookmark', '已加书签'),
    'highlighted': ('مظلّلة', 'επισημασμένο', 'resaltado', 'surligné', 'हाइलाइट', 'выделено', 'naka-highlight', '已标记'),
    'Highlight': ('تظليل', 'Επισήμανση', 'Resaltar', 'Surligner', 'हाइलाइट', 'Выделить', 'I-highlight', '标记'),
    'note': ('ملاحظة', 'σημείωση', 'nota', 'note', 'नोट', 'заметка', 'tala', '笔记'),
    'yellow': ('أصفر', 'κίτρινο', 'amarillo', 'jaune', 'पीला', 'жёлтым', 'dilaw', '黄色'),
    'green': ('أخضر', 'πράσινο', 'verde', 'vert', 'हरा', 'зелёным', 'berde', '绿色'),
    'blue': ('أزرق', 'μπλε', 'azul', 'bleu', 'नीला', 'синим', 'asul', '蓝色'),
    'pink': ('وردي', 'ροζ', 'rosa', 'rose', 'गुलाबी', 'розовым', 'rosas', '粉色'),
    'purple': ('بنفسجي', 'μωβ', 'morado', 'violet', 'बैंगनी', 'фиолетовым', 'lila', '紫色'),
    'Not bookmarked yet': ('بلا علامة بعد', 'Χωρίς σελιδοδείκτη ακόμη', 'Aún sin marcador', 'Pas encore de signet', 'अभी बुकमार्क नहीं', 'Ещё не в закладках', 'Wala pang bookmark', '尚未加书签'),
    'for more verses, click the last one': ('لآيات أكثر انقر على الأخيرة', 'για περισσότερα εδάφια, κάνε κλικ στο τελευταίο', 'para más versículos, haz clic en el último', 'pour plus de versets, clique sur le dernier', 'और पदों के लिए आखिरी पर क्लिक करें', 'чтобы выбрать больше стихов, нажмите на последний', 'para sa higit pang talata, i-click ang huli', '要选多节，请点击最后一节'),
    'Edit note': ('عدّل الملاحظة', 'Επεξεργασία σημείωσης', 'Editar nota', 'Modifier la note', 'नोट संपादित करें', 'Изменить заметку', 'I-edit ang tala', '编辑笔记'),
    'Your notes and bookmarks in this chapter: %d': ('ملاحظاتك وعلاماتك في هذا الأصحاح: %d', 'Οι σημειώσεις και οι σελιδοδείκτες σου σε αυτό το κεφάλαιο: %d', 'Tus notas y marcadores en este capítulo: %d', 'Tes notes et signets dans ce chapitre : %d', 'इस अध्याय में आपके नोट्स और बुकमार्क: %d', 'Ваши заметки и закладки в этой главе: %d', 'Ang iyong mga tala at bookmark sa kabanatang ito: %d', '本章中你的笔记与书签：%d'),
    'Next ↓': ('التالي ↓', 'Επόμενο ↓', 'Siguiente ↓', 'Suivant ↓', 'अगला ↓', 'Далее ↓', 'Susunod ↓', '下一个 ↓'),
    'Go to the next one': ('اذهب إلى التالية', 'Πήγαινε στο επόμενο', 'Ir al siguiente', 'Aller au suivant', 'अगले पर जाएँ', 'К следующему', 'Pumunta sa susunod', '转到下一个'),
    'People and places in this chapter': ('الأشخاص والأماكن في هذا الأصحاح', 'Πρόσωπα και τόποι σε αυτό το κεφάλαιο', 'Personas y lugares en este capítulo', 'Personnes et lieux de ce chapitre', 'इस अध्याय के लोग और स्थान', 'Люди и места в этой главе', 'Mga tao at lugar sa kabanatang ito', '本章的人物与地点'),
    'The Holy Fathers on this chapter: %d': ('الآباء القديسون عن هذا الأصحاح: %d', 'Οι Άγιοι Πατέρες για αυτό το κεφάλαιο: %d', 'Los Santos Padres sobre este capítulo: %d', 'Les Saints Pères sur ce chapitre : %d', 'इस अध्याय पर पवित्र पिता: %d', 'Святые Отцы об этой главе: %d', 'Ang mga Banal na Ama sa kabanatang ito: %d', '圣教父论本章：%d'),
}
_ORDER = ('ar', 'el', 'es', 'fr', 'hi', 'ru', 'tl', 'zh')


def _(s, l=None):
    l = l or lang()
    if l == 'en' or l not in _ORDER:
        return s
    t = _T.get(s)
    return t[_ORDER.index(l)] if t else s


def rtl():
    return lang() == 'ar'
