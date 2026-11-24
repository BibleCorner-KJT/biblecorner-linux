/* KJT Local Bible - Today's readings (4.7.0)
   The Epistle and Gospel of the day from the Orthodox lectionary (the calendar
   is chosen in KJT > Church Readings). Each reading opens in the reader, in the
   visitor's own language and translation. Previous / next day, the other
   readings of the services, the fast of the day, and "Mark as read" (counts as
   a reading day in My Reading Journey). The last days fetched are kept on the
   device, so the card also works without internet. */
(function () {
  'use strict';
  var C = window.KJTB_LECT; if (!C) return;
  var LANG = (window.KJTB_UI_LANG || (document.documentElement.lang || 'en').slice(0, 2)).toLowerCase();
  if (['en', 'ar', 'fr', 'es', 'zh', 'hi', 'tl', 'ru', 'el'].indexOf(LANG) < 0) LANG = 'en';

  /* ---------- words ---------- */
  var W = {
    ar: { tick: '\u0639\u0644\u0651\u0645 \u0647\u0630\u0647 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0643\u0645\u0642\u0631\u0648\u0621\u0629', title: '\u0642\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u064A\u0648\u0645', of: '\u0642\u0631\u0627\u0621\u0627\u062A \u064A\u0648\u0645', Epistle: '\u0627\u0644\u0631\u0633\u0627\u0644\u0629', Gospel: '\u0627\u0644\u0625\u0646\u062C\u064A\u0644', more: '\u0642\u0631\u0627\u0621\u0627\u062A \u0623\u062E\u0631\u0649 \u0644\u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645', read: '\u0627\u0642\u0631\u0623', mark: '\u0642\u0631\u0623\u062A\u064F \u0642\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u064A\u0648\u0645', marked: '\u2713 \u0642\u0631\u0623\u062A\u064E \u0642\u0631\u0627\u0621\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645', prev: '\u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0633\u0627\u0628\u0642', next: '\u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u062A\u0627\u0644\u064A', today: '\u0627\u0644\u064A\u0648\u0645', none: '\u0644\u0627 \u062A\u0648\u062C\u062F \u0642\u0631\u0627\u0621\u0627\u062A \u0644\u0644\u0642\u062F\u0627\u0633 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645.', missing: '\u0627\u0644\u0642\u0631\u0627\u0621\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u062A\u0627\u0631\u064A\u062E.', offline: '\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0642\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627.', loading: '\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644\u2026', fast: '\u0627\u0644\u0635\u0648\u0645', corrected: '\u062D\u062F\u0651\u062F\u062A\u0647\u0627 \u0627\u0644\u0631\u0639\u064A\u0629' },
    fr: { tick: 'Marquer cette lecture comme lue', title: 'Lectures du jour', of: 'Lectures du', Epistle: '\u00C9p\u00EEtre', Gospel: '\u00C9vangile', more: 'Autres lectures du jour', read: 'Lire', mark: 'J\u2019ai lu les lectures du jour', marked: '\u2713 Lectures de ce jour lues', prev: 'Jour pr\u00E9c\u00E9dent', next: 'Jour suivant', today: 'Aujourd\u2019hui', none: 'Pas de lectures de la Liturgie ce jour.', missing: 'Lectures non disponibles pour cette date.', offline: 'Impossible de charger les lectures pour le moment.', loading: 'Chargement\u2026', fast: 'Je\u00FBne', corrected: 'fix\u00E9 par la paroisse' },
    es: { tick: 'Marcar esta lectura como le\u00EDda', title: 'Lecturas del d\u00EDa', of: 'Lecturas del', Epistle: 'Ep\u00EDstola', Gospel: 'Evangelio', more: 'Otras lecturas del d\u00EDa', read: 'Leer', mark: 'He le\u00EDdo las lecturas del d\u00EDa', marked: '\u2713 Lecturas de este d\u00EDa le\u00EDdas', prev: 'D\u00EDa anterior', next: 'D\u00EDa siguiente', today: 'Hoy', none: 'No hay lecturas de la Liturgia este d\u00EDa.', missing: 'Lecturas no disponibles para esta fecha.', offline: 'No se pueden cargar las lecturas ahora.', loading: 'Cargando\u2026', fast: 'Ayuno', corrected: 'fijado por la parroquia' },
    zh: { tick: '\u5C06\u6B64\u7ECF\u8BFE\u6807\u8BB0\u4E3A\u5DF2\u8BFB', title: '\u4ECA\u65E5\u7ECF\u8BFE', of: '\u7ECF\u8BFE\uFF1A', Epistle: '\u4F7F\u5F92\u4E66', Gospel: '\u798F\u97F3', more: '\u4ECA\u65E5\u5176\u4ED6\u7ECF\u8BFE', read: '\u9605\u8BFB', mark: '\u6211\u5DF2\u8BFB\u5B8C\u4ECA\u65E5\u7ECF\u8BFE', marked: '\u2713 \u5DF2\u8BFB\u5B8C\u672C\u65E5\u7ECF\u8BFE', prev: '\u524D\u4E00\u5929', next: '\u540E\u4E00\u5929', today: '\u4ECA\u5929', none: '\u672C\u65E5\u6CA1\u6709\u5723\u793C\u4EEA\u7ECF\u8BFE\u3002', missing: '\u6B64\u65E5\u671F\u6682\u65E0\u7ECF\u8BFE\u3002', offline: '\u76EE\u524D\u65E0\u6CD5\u52A0\u8F7D\u7ECF\u8BFE\u3002', loading: '\u52A0\u8F7D\u4E2D\u2026', fast: '\u658B\u6212', corrected: '\u5802\u533A\u6307\u5B9A' },
    hi: { tick: '\u0907\u0938 \u092A\u093E\u0920 \u0915\u094B \u092A\u0922\u093C\u093E \u0939\u0941\u0906 \u091A\u093F\u0939\u094D\u0928\u093F\u0924 \u0915\u0930\u0947\u0902', title: '\u0906\u091C \u0915\u0947 \u092A\u093E\u0920', of: '\u092A\u093E\u0920:', Epistle: '\u092A\u0924\u094D\u0930\u0940', Gospel: '\u0938\u0941\u0938\u092E\u093E\u091A\u093E\u0930', more: '\u0906\u091C \u0915\u0947 \u0905\u0928\u094D\u092F \u092A\u093E\u0920', read: '\u092A\u0922\u093C\u0947\u0902', mark: '\u092E\u0948\u0902\u0928\u0947 \u0906\u091C \u0915\u0947 \u092A\u093E\u0920 \u092A\u0922\u093C \u0932\u093F\u090F', marked: '\u2713 \u0907\u0938 \u0926\u093F\u0928 \u0915\u0947 \u092A\u093E\u0920 \u092A\u0922\u093C \u0932\u093F\u090F', prev: '\u092A\u093F\u091B\u0932\u093E \u0926\u093F\u0928', next: '\u0905\u0917\u0932\u093E \u0926\u093F\u0928', today: '\u0906\u091C', none: '\u0907\u0938 \u0926\u093F\u0928 \u0927\u0930\u094D\u092E\u0935\u093F\u0927\u093F \u0915\u0947 \u092A\u093E\u0920 \u0928\u0939\u0940\u0902 \u0939\u0948\u0902\u0964', missing: '\u0907\u0938 \u0924\u093F\u0925\u093F \u0915\u0947 \u092A\u093E\u0920 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0902\u0964', offline: '\u0905\u092D\u0940 \u092A\u093E\u0920 \u0932\u094B\u0921 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0947\u0964', loading: '\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u2026', fast: '\u0909\u092A\u0935\u093E\u0938', corrected: '\u092A\u0932\u094D\u0932\u0940 \u0926\u094D\u0935\u093E\u0930\u093E \u0928\u093F\u0930\u094D\u0927\u093E\u0930\u093F\u0924' },
    tl: { tick: 'Markahang nabasa ang pagbasang ito', title: 'Mga pagbasa ngayon', of: 'Mga pagbasa para sa', Epistle: 'Sulat', Gospel: 'Ebanghelyo', more: 'Iba pang pagbasa sa araw na ito', read: 'Basahin', mark: 'Nabasa ko na ang mga pagbasa ngayon', marked: '\u2713 Nabasa na ang mga pagbasa sa araw na ito', prev: 'Nakaraang araw', next: 'Susunod na araw', today: 'Ngayon', none: 'Walang pagbasa ng Liturhiya sa araw na ito.', missing: 'Walang available na pagbasa para sa petsang ito.', offline: 'Hindi ma-load ang mga pagbasa sa ngayon.', loading: 'Naglo-load\u2026', fast: 'Pag-aayuno', corrected: 'itinakda ng parokya' },
    en: { tick: 'Mark this reading as read', title: 'Today\u2019s readings', of: 'Readings for', Epistle: 'Epistle', Gospel: 'Gospel', more: 'Other readings of the day', read: 'Read', mark: 'I have read today\u2019s readings', marked: '\u2713 Readings of this day read', prev: 'Previous day', next: 'Next day', today: 'Today', none: 'No Liturgy readings on this day.', missing: 'Readings are not available for this date.', offline: 'The readings cannot be loaded right now.', loading: 'Loading\u2026', fast: 'Fast', corrected: 'set by the parish' },
    ru: {"tick": "Отметить это чтение как прочитанное", "title": "Чтения дня", "of": "Чтения на", "Epistle": "Апостол", "Gospel": "Евангелие", "more": "Другие чтения дня", "read": "Читать", "mark": "Сегодняшние чтения прочитаны", "marked": "✓ Чтения этого дня прочитаны", "prev": "Предыдущий день", "next": "Следующий день", "today": "Сегодня", "none": "В этот день нет литургийных чтений.", "missing": "Чтения на эту дату недоступны.", "offline": "Сейчас не удаётся загрузить чтения.", "loading": "Загрузка…", "fast": "Пост", "corrected": "по указанию прихода"},
    el: {"tick": "Σημειώστε ότι διαβάσατε αυτό το ανάγνωσμα", "title": "Τα σημερινά αναγνώσματα", "of": "Αναγνώσματα για", "Epistle": "Απόστολος", "Gospel": "Ευαγγέλιο", "more": "Άλλα αναγνώσματα της ημέρας", "read": "Ανάγνωση", "mark": "Διάβασα τα σημερινά αναγνώσματα", "marked": "✓ Τα αναγνώσματα της ημέρας διαβάστηκαν", "prev": "Προηγούμενη ημέρα", "next": "Επόμενη ημέρα", "today": "Σήμερα", "none": "Δεν υπάρχουν αναγνώσματα Θείας Λειτουργίας αυτήν την ημέρα.", "missing": "Τα αναγνώσματα δεν είναι διαθέσιμα για αυτήν την ημερομηνία.", "offline": "Δεν είναι δυνατή η φόρτωση των αναγνωσμάτων αυτή τη στιγμή.", "loading": "Φόρτωση…", "fast": "Νηστεία", "corrected": "κατά την ενορία"}
  };
  var L = W[LANG];
  var MODES = {
    en: { label: 'Calendar', old: 'Old calendar (Julian)', 'new': 'New calendar', greek: 'New calendar (Greek and Antiochian usage)' },
    ar: { label: '\u0627\u0644\u062A\u0642\u0648\u064A\u0645', old: '\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u0642\u062F\u064A\u0645 (\u0627\u0644\u064A\u0648\u0644\u064A\u0627\u0646\u064A)', 'new': '\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062C\u062F\u064A\u062F', greek: '\u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062C\u062F\u064A\u062F (\u0627\u0644\u0627\u0633\u062A\u0639\u0645\u0627\u0644 \u0627\u0644\u064A\u0648\u0646\u0627\u0646\u064A \u0648\u0627\u0644\u0623\u0646\u0637\u0627\u0643\u064A)' },
    fr: { label: 'Calendrier', old: 'Ancien calendrier (julien)', 'new': 'Nouveau calendrier', greek: 'Nouveau calendrier (usage grec et antiochien)' },
    es: { label: 'Calendario', old: 'Calendario antiguo (juliano)', 'new': 'Calendario nuevo', greek: 'Calendario nuevo (uso griego y antioqueno)' },
    zh: { label: '\u5386\u6CD5', old: '\u65E7\u5386\uFF08\u5112\u7565\u5386\uFF09', 'new': '\u65B0\u5386', greek: '\u65B0\u5386\uFF08\u5E0C\u814A\u548C\u5B89\u63D0\u963F\u7528\u6CD5\uFF09' },
    hi: { label: '\u092A\u0902\u091A\u093E\u0902\u0917', old: '\u092A\u0941\u0930\u093E\u0928\u093E \u092A\u0902\u091A\u093E\u0902\u0917 (\u091C\u0942\u0932\u093F\u092F\u0928)', 'new': '\u0928\u092F\u093E \u092A\u0902\u091A\u093E\u0902\u0917', greek: '\u0928\u092F\u093E \u092A\u0902\u091A\u093E\u0902\u0917 (\u092F\u0942\u0928\u093E\u0928\u0940 \u0914\u0930 \u0905\u0902\u0924\u093E\u0915\u093F\u092F\u093E \u092A\u0930\u0902\u092A\u0930\u093E)' },
    tl: { label: 'Kalendaryo', old: 'Lumang kalendaryo (Julian)', 'new': 'Bagong kalendaryo', greek: 'Bagong kalendaryo (gamit ng Griego at Antioque\u00F1o)' },
    ru: {"label": "Календарь", "old": "Старый стиль (юлианский)", "new": "Новый стиль", "greek": "Новый стиль (греческая и антиохийская практика)"},
    el: {"label": "Ημερολόγιο", "old": "Παλαιό ημερολόγιο (Ιουλιανό)", "new": "Νέο ημερολόγιο", "greek": "Νέο ημερολόγιο (ελληνική και αντιοχειανή πράξη)"}
  }[LANG];

  var FEASTS = {
    en: { lg_lord: 'Feast of the Lord', lg_theotokos: 'Feast of the Theotokos', lg_pascha: 'Pascha, the Feast of Feasts', lg_fast: 'Fasting season', fast_nativity: 'Nativity Fast', fast_lent: 'Great Lent', fast_apostles: 'Apostles\u2019 Fast', fast_dormition: 'Dormition Fast', now: 'now', ends: 'ends in {n} days', endsToday: 'last day', title2: 'Coming feasts and fasts', title: 'Coming feasts', days: 'in {n} days', tomorrow: 'tomorrow', today: 'today', nativity: 'Nativity of Christ', theophany: 'Theophany (Baptism of Christ)', meeting: 'Meeting of the Lord in the Temple', lent: 'Beginning of Great Lent', annunciation: 'Annunciation', palm: 'Palm Sunday', pascha: 'Great and Holy Pascha', ascension: 'Ascension of Christ', pentecost: 'Pentecost', transfiguration: 'Transfiguration', dormition: 'Dormition of the Theotokos', nativity_theotokos: 'Nativity of the Theotokos', elevation: 'Elevation of the Holy Cross', entry: 'Entry of the Theotokos into the Temple' },
    ar: { lg_lord: '\u0639\u064A\u062F \u0633\u064A\u062F\u064A', lg_theotokos: '\u0639\u064A\u062F \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647', lg_pascha: '\u0627\u0644\u0641\u0635\u062D\u060C \u0639\u064A\u062F \u0627\u0644\u0623\u0639\u064A\u0627\u062F', lg_fast: '\u0641\u062A\u0631\u0629 \u0635\u0648\u0645', fast_nativity: '\u0635\u0648\u0645 \u0627\u0644\u0645\u064A\u0644\u0627\u062F', fast_lent: '\u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', fast_apostles: '\u0635\u0648\u0645 \u0627\u0644\u0631\u0633\u0644', fast_dormition: '\u0635\u0648\u0645 \u0627\u0644\u0633\u064A\u062F\u0629', now: '\u0627\u0644\u0622\u0646', ends: '\u064A\u0646\u062A\u0647\u064A \u0628\u0639\u062F {n} \u064A\u0648\u0645\u064B\u0627', endsToday: '\u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0623\u062E\u064A\u0631', title2: '\u0627\u0644\u0623\u0639\u064A\u0627\u062F \u0648\u0627\u0644\u0623\u0635\u0648\u0627\u0645 \u0627\u0644\u0642\u0627\u062F\u0645\u0629', title: '\u0627\u0644\u0623\u0639\u064A\u0627\u062F \u0627\u0644\u0642\u0627\u062F\u0645\u0629', days: '\u0628\u0639\u062F {n} \u064A\u0648\u0645\u064B\u0627', tomorrow: '\u063A\u062F\u064B\u0627', today: '\u0627\u0644\u064A\u0648\u0645', nativity: '\u0645\u064A\u0644\u0627\u062F \u0627\u0644\u0645\u0633\u064A\u062D', theophany: '\u0627\u0644\u0638\u0647\u0648\u0631 \u0627\u0644\u0625\u0644\u0647\u064A (\u0627\u0644\u063A\u0637\u0627\u0633)', meeting: '\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u064A\u062F \u0625\u0644\u0649 \u0627\u0644\u0647\u064A\u0643\u0644', lent: '\u0628\u062F\u0621 \u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', annunciation: '\u0627\u0644\u0628\u0634\u0627\u0631\u0629', palm: '\u0623\u062D\u062F \u0627\u0644\u0634\u0639\u0627\u0646\u064A\u0646', pascha: '\u0627\u0644\u0641\u0635\u062D \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', ascension: '\u0635\u0639\u0648\u062F \u0627\u0644\u0645\u0633\u064A\u062D', pentecost: '\u0627\u0644\u0639\u0646\u0635\u0631\u0629', transfiguration: '\u0627\u0644\u062A\u062C\u0644\u064A', dormition: '\u0631\u0642\u0627\u062F \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647', nativity_theotokos: '\u0645\u064A\u0644\u0627\u062F \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647', elevation: '\u0631\u0641\u0639 \u0627\u0644\u0635\u0644\u064A\u0628 \u0627\u0644\u0643\u0631\u064A\u0645', entry: '\u062F\u062E\u0648\u0644 \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647 \u0625\u0644\u0649 \u0627\u0644\u0647\u064A\u0643\u0644' },
    fr: { lg_lord: 'F\u00EAte du Seigneur', lg_theotokos: 'F\u00EAte de la M\u00E8re de Dieu', lg_pascha: 'P\u00E2que, la F\u00EAte des f\u00EAtes', lg_fast: 'P\u00E9riode de je\u00FBne', fast_nativity: 'Je\u00FBne de la Nativit\u00E9', fast_lent: 'Grand Car\u00EAme', fast_apostles: 'Je\u00FBne des Ap\u00F4tres', fast_dormition: 'Je\u00FBne de la Dormition', now: 'en cours', ends: 'finit dans {n} jours', endsToday: 'dernier jour', title2: 'F\u00EAtes et je\u00FBnes \u00E0 venir', title: 'F\u00EAtes \u00E0 venir', days: 'dans {n} jours', tomorrow: 'demain', today: 'aujourd\u2019hui', nativity: 'Nativit\u00E9 du Christ', theophany: 'Th\u00E9ophanie (Bapt\u00EAme du Christ)', meeting: 'Rencontre du Seigneur au Temple', lent: 'D\u00E9but du Grand Car\u00EAme', annunciation: 'Annonciation', palm: 'Dimanche des Rameaux', pascha: 'Sainte et Grande P\u00E2que', ascension: 'Ascension du Christ', pentecost: 'Pentec\u00F4te', transfiguration: 'Transfiguration', dormition: 'Dormition de la M\u00E8re de Dieu', nativity_theotokos: 'Nativit\u00E9 de la M\u00E8re de Dieu', elevation: 'Exaltation de la Sainte Croix', entry: 'Entr\u00E9e de la M\u00E8re de Dieu au Temple' },
    es: { lg_lord: 'Fiesta del Se\u00F1or', lg_theotokos: 'Fiesta de la Madre de Dios', lg_pascha: 'Pascua, la Fiesta de las fiestas', lg_fast: 'Tiempo de ayuno', fast_nativity: 'Ayuno de la Natividad', fast_lent: 'Gran Cuaresma', fast_apostles: 'Ayuno de los Ap\u00F3stoles', fast_dormition: 'Ayuno de la Dormici\u00F3n', now: 'ahora', ends: 'termina en {n} d\u00EDas', endsToday: '\u00FAltimo d\u00EDa', title2: 'Pr\u00F3ximas fiestas y ayunos', title: 'Pr\u00F3ximas fiestas', days: 'en {n} d\u00EDas', tomorrow: 'ma\u00F1ana', today: 'hoy', nativity: 'Natividad de Cristo', theophany: 'Teofan\u00EDa (Bautismo de Cristo)', meeting: 'Encuentro del Se\u00F1or en el Templo', lent: 'Comienzo de la Gran Cuaresma', annunciation: 'Anunciaci\u00F3n', palm: 'Domingo de Ramos', pascha: 'Santa y Gran Pascua', ascension: 'Ascensi\u00F3n de Cristo', pentecost: 'Pentecost\u00E9s', transfiguration: 'Transfiguraci\u00F3n', dormition: 'Dormici\u00F3n de la Madre de Dios', nativity_theotokos: 'Natividad de la Madre de Dios', elevation: 'Exaltaci\u00F3n de la Santa Cruz', entry: 'Entrada de la Madre de Dios en el Templo' },
    zh: { lg_lord: '\u4E3B\u7684\u8282\u65E5', lg_theotokos: '\u5723\u6BCD\u8282\u65E5', lg_pascha: '\u590D\u6D3B\u8282\u2014\u2014\u8282\u4E2D\u4E4B\u8282', lg_fast: '\u658B\u671F', fast_nativity: '\u5723\u8BDE\u658B\u671F', fast_lent: '\u5927\u658B\u671F', fast_apostles: '\u4F7F\u5F92\u658B\u671F', fast_dormition: '\u5723\u6BCD\u5B89\u606F\u658B\u671F', now: '\u8FDB\u884C\u4E2D', ends: '{n}\u5929\u540E\u7ED3\u675F', endsToday: '\u6700\u540E\u4E00\u5929', title2: '\u5373\u5C06\u5230\u6765\u7684\u8282\u65E5\u548C\u658B\u671F', title: '\u5373\u5C06\u5230\u6765\u7684\u8282\u65E5', days: '{n}\u5929\u540E', tomorrow: '\u660E\u5929', today: '\u4ECA\u5929', nativity: '\u57FA\u7763\u5723\u8BDE', theophany: '\u4E3B\u9886\u6D17\u8282\uFF08\u795E\u663E\u8282\uFF09', meeting: '\u4E3B\u8FDB\u5802\u8282', lent: '\u5927\u658B\u671F\u5F00\u59CB', annunciation: '\u5723\u6BCD\u9886\u62A5\u8282', palm: '\u5723\u679D\u4E3B\u65E5', pascha: '\u5723\u5927\u590D\u6D3B\u8282', ascension: '\u4E3B\u5347\u5929\u8282', pentecost: '\u4E94\u65EC\u8282', transfiguration: '\u4E3B\u663E\u5723\u5BB9\u8282', dormition: '\u5723\u6BCD\u5B89\u606F\u8282', nativity_theotokos: '\u5723\u6BCD\u8BDE\u8FB0\u8282', elevation: '\u4E3E\u8363\u5723\u67B6\u8282', entry: '\u5723\u6BCD\u8FDB\u5802\u8282' },
    hi: { lg_lord: '\u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u092A\u0930\u094D\u0935', lg_theotokos: '\u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u092A\u0930\u094D\u0935', lg_pascha: '\u092A\u093E\u0938\u094D\u0915\u093E, \u092A\u0930\u094D\u0935\u094B\u0902 \u0915\u093E \u092A\u0930\u094D\u0935', lg_fast: '\u0909\u092A\u0935\u093E\u0938 \u0915\u093E \u0938\u092E\u092F', fast_nativity: '\u091C\u0928\u094D\u092E \u0915\u093E \u0909\u092A\u0935\u093E\u0938', fast_lent: '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938', fast_apostles: '\u092A\u094D\u0930\u0947\u0930\u093F\u0924\u094B\u0902 \u0915\u093E \u0909\u092A\u0935\u093E\u0938', fast_dormition: '\u0935\u093F\u0936\u094D\u0930\u093E\u092E \u0915\u093E \u0909\u092A\u0935\u093E\u0938', now: '\u0905\u092D\u0940', ends: '{n} \u0926\u093F\u0928 \u092E\u0947\u0902 \u0938\u092E\u093E\u092A\u094D\u0924', endsToday: '\u0905\u0902\u0924\u093F\u092E \u0926\u093F\u0928', title2: '\u0906\u0928\u0947 \u0935\u093E\u0932\u0947 \u092A\u0930\u094D\u0935 \u0914\u0930 \u0909\u092A\u0935\u093E\u0938', title: '\u0906\u0928\u0947 \u0935\u093E\u0932\u0947 \u092A\u0930\u094D\u0935', days: '{n} \u0926\u093F\u0928 \u092C\u093E\u0926', tomorrow: '\u0915\u0932', today: '\u0906\u091C', nativity: '\u092E\u0938\u0940\u0939 \u0915\u093E \u091C\u0928\u094D\u092E', theophany: '\u0908\u0936-\u092A\u094D\u0930\u0915\u091F\u0928 (\u092E\u0938\u0940\u0939 \u0915\u093E \u092C\u092A\u0924\u093F\u0938\u094D\u092E\u093E)', meeting: '\u092E\u0902\u0926\u093F\u0930 \u092E\u0947\u0902 \u092A\u094D\u0930\u092D\u0941 \u0915\u0940 \u092D\u0947\u0902\u091F', lent: '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938 \u0915\u093E \u0906\u0930\u0902\u092D', annunciation: '\u0936\u0941\u092D \u0938\u0902\u0926\u0947\u0936', palm: '\u0916\u091C\u0942\u0930 \u0930\u0935\u093F\u0935\u093E\u0930', pascha: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u092A\u093E\u0938\u094D\u0915\u093E', ascension: '\u092E\u0938\u0940\u0939 \u0915\u093E \u0938\u094D\u0935\u0930\u094D\u0917\u093E\u0930\u094B\u0939\u0923', pentecost: '\u092A\u093F\u0928\u094D\u0924\u0947\u0915\u0941\u0938\u094D\u0924', transfiguration: '\u0930\u0942\u092A\u093E\u0902\u0924\u0930\u0923', dormition: '\u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u0935\u093F\u0936\u094D\u0930\u093E\u092E', nativity_theotokos: '\u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u091C\u0928\u094D\u092E', elevation: '\u092A\u0935\u093F\u0924\u094D\u0930 \u0915\u094D\u0930\u0942\u0938 \u0915\u093E \u0909\u0924\u094D\u0915\u0930\u094D\u0937', entry: '\u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u092E\u0902\u0926\u093F\u0930 \u092E\u0947\u0902 \u092A\u094D\u0930\u0935\u0947\u0936' },
    tl: { lg_lord: 'Kapistahan ng Panginoon', lg_theotokos: 'Kapistahan ng Theotokos', lg_pascha: 'Pascha, ang Kapistahan ng mga Kapistahan', lg_fast: 'Panahon ng pag-aayuno', fast_nativity: 'Pag-aayuno ng Kapanganakan', fast_lent: 'Dakilang Kuwaresma', fast_apostles: 'Pag-aayuno ng mga Apostol', fast_dormition: 'Pag-aayuno ng Paghimlay', now: 'ngayon', ends: 'matatapos sa loob ng {n} araw', endsToday: 'huling araw', title2: 'Mga darating na kapistahan at pag-aayuno', title: 'Mga darating na kapistahan', days: 'sa loob ng {n} araw', tomorrow: 'bukas', today: 'ngayon', nativity: 'Kapanganakan ni Cristo', theophany: 'Teopaniya (Binyag ni Cristo)', meeting: 'Pagsalubong sa Panginoon sa Templo', lent: 'Simula ng Dakilang Kuwaresma', annunciation: 'Pagbabalita', palm: 'Linggo ng Palaspas', pascha: 'Dakila at Banal na Pascha', ascension: 'Pag-akyat ni Cristo', pentecost: 'Pentecostes', transfiguration: 'Pagbabagong-anyo', dormition: 'Paghimlay ng Theotokos', nativity_theotokos: 'Kapanganakan ng Theotokos', elevation: 'Pagtataas ng Banal na Krus', entry: 'Pagpasok ng Theotokos sa Templo' },
    ru: {"lg_lord": "Господский праздник", "lg_theotokos": "Богородичный праздник", "lg_pascha": "Пасха — праздников праздник", "lg_fast": "Время поста", "fast_nativity": "Рождественский пост", "fast_lent": "Великий пост", "fast_apostles": "Петров (Апостольский) пост", "fast_dormition": "Успенский пост", "now": "сейчас", "ends": "окончится через {n} дн.", "endsToday": "последний день", "title2": "Ближайшие праздники и посты", "title": "Ближайшие праздники", "days": "через {n} дн.", "tomorrow": "завтра", "today": "сегодня", "nativity": "Рождество Христово", "theophany": "Богоявление (Крещение Господне)", "meeting": "Сретение Господне", "lent": "Начало Великого поста", "annunciation": "Благовещение", "palm": "Вход Господень в Иерусалим", "pascha": "Светлое Христово Воскресение — Пасха", "ascension": "Вознесение Господне", "pentecost": "День Святой Троицы (Пятидесятница)", "transfiguration": "Преображение Господне", "dormition": "Успение Пресвятой Богородицы", "nativity_theotokos": "Рождество Пресвятой Богородицы", "elevation": "Воздвижение Креста Господня", "entry": "Введение во храм Пресвятой Богородицы"},
    el: {"lg_lord": "Δεσποτική εορτή", "lg_theotokos": "Θεομητορική εορτή", "lg_pascha": "Πάσχα, η εορτή των εορτών", "lg_fast": "Περίοδος νηστείας", "fast_nativity": "Νηστεία των Χριστουγέννων", "fast_lent": "Μεγάλη Τεσσαρακοστή", "fast_apostles": "Νηστεία των Αγίων Αποστόλων", "fast_dormition": "Νηστεία του Δεκαπενταυγούστου", "now": "τώρα", "ends": "λήγει σε {n} ημέρες", "endsToday": "τελευταία ημέρα", "title2": "Προσεχείς εορτές και νηστείες", "title": "Προσεχείς εορτές", "days": "σε {n} ημέρες", "tomorrow": "αύριο", "today": "σήμερα", "nativity": "Η Γέννηση του Χριστού", "theophany": "Τα Θεοφάνεια (η Βάπτιση του Χριστού)", "meeting": "Η Υπαπαντή του Κυρίου", "lent": "Αρχή της Μεγάλης Τεσσαρακοστής", "annunciation": "Ο Ευαγγελισμός", "palm": "Κυριακή των Βαΐων", "pascha": "Το Άγιο Πάσχα", "ascension": "Η Ανάληψη του Κυρίου", "pentecost": "Η Πεντηκοστή", "transfiguration": "Η Μεταμόρφωση του Σωτήρος", "dormition": "Η Κοίμηση της Θεοτόκου", "nativity_theotokos": "Το Γενέσιον της Θεοτόκου", "elevation": "Η Ύψωση του Τιμίου Σταυρού", "entry": "Τα Εισόδια της Θεοτόκου"}
  }[LANG];
  var LOCALE = { en: 'en', ar: 'ar-LB-u-nu-latn', fr: 'fr', es: 'es', zh: 'zh-CN', hi: 'hi-IN-u-nu-latn', tl: 'fil-PH', ru: 'ru', el: 'el' }[LANG];

  /* services, fasts and the names of the days, in the nine languages */
  var X = {
    ar: { Vespers: '\u0635\u0644\u0627\u0629 \u0627\u0644\u063A\u0631\u0648\u0628', 'Matins Gospel': '\u0625\u0646\u062C\u064A\u0644 \u0627\u0644\u0633\u062D\u0631', 'Matins': '\u0627\u0644\u0633\u062D\u0631', 'Matins Epistle': '\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0633\u062D\u0631', 'Vespers Gospel': '\u0625\u0646\u062C\u064A\u0644 \u0627\u0644\u063A\u0631\u0648\u0628', '1st Hour': '\u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649', '3rd Hour': '\u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u062B\u0627\u0644\u062B\u0629', '6th Hour': '\u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u0633\u0627\u062F\u0633\u0629', '9th Hour': '\u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u062A\u0627\u0633\u0639\u0629', 'Great Blessing of Waters': '\u062A\u0642\u062F\u064A\u0633 \u0627\u0644\u0645\u0627\u0621 \u0627\u0644\u0643\u0628\u064A\u0631', 'Cross Procession': '\u0632\u064A\u0627\u062D \u0627\u0644\u0635\u0644\u064A\u0628', 'Passion Gospel': '\u0625\u0646\u062C\u064A\u0644 \u0627\u0644\u0622\u0644\u0627\u0645', Prophecy: '\u0627\u0644\u0646\u0628\u0648\u0621\u0629',
      'No Fast': '', Fast: '\u0635\u0648\u0645', 'Lenten Fast': '\u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', 'Apostles Fast': '\u0635\u0648\u0645 \u0627\u0644\u0631\u0633\u0644', 'Dormition Fast': '\u0635\u0648\u0645 \u0627\u0644\u0633\u064A\u062F\u0629', 'Nativity Fast': '\u0635\u0648\u0645 \u0627\u0644\u0645\u064A\u0644\u0627\u062F',
      'Wine and Oil are Allowed': '\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u062E\u0645\u0631 \u0648\u0627\u0644\u0632\u064A\u062A', 'Fish, Wine and Oil are Allowed': '\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u0633\u0645\u0643 \u0648\u0627\u0644\u062E\u0645\u0631 \u0648\u0627\u0644\u0632\u064A\u062A', 'Wine is Allowed': '\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u062E\u0645\u0631', 'Wine, Oil and Caviar are Allowed': '\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u062E\u0645\u0631 \u0648\u0627\u0644\u0632\u064A\u062A \u0648\u0627\u0644\u0628\u0637\u0627\u0631\u062E', 'Meat Fast': '\u0627\u0644\u0627\u0645\u062A\u0646\u0627\u0639 \u0639\u0646 \u0627\u0644\u0644\u062D\u0645', 'Strict Fast (Wine and Oil)': '\u0635\u0648\u0645 (\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u062E\u0645\u0631 \u0648\u0627\u0644\u0632\u064A\u062A)', 'Strict Fast': '\u0635\u0648\u0645 \u0642\u0637\u0627\u0639\u064A', 'Fast Free': '\u0644\u0627 \u0635\u0648\u0645' },
    fr: { Vespers: 'V\u00EApres', 'Matins Gospel': '\u00C9vangile des matines', Matins: 'Matines', 'Matins Epistle': '\u00C9p\u00EEtre des matines', 'Vespers Gospel': '\u00C9vangile des v\u00EApres', '1st Hour': 'Prime', '3rd Hour': 'Tierce', '6th Hour': 'Sexte', '9th Hour': 'None', 'Great Blessing of Waters': 'Grande b\u00E9n\u00E9diction des eaux', 'Cross Procession': 'Procession de la Croix', 'Passion Gospel': '\u00C9vangile de la Passion', Prophecy: 'Proph\u00E9tie',
      'No Fast': '', Fast: 'Je\u00FBne', 'Lenten Fast': 'Grand Car\u00EAme', 'Apostles Fast': 'Je\u00FBne des Ap\u00F4tres', 'Dormition Fast': 'Je\u00FBne de la Dormition', 'Nativity Fast': 'Je\u00FBne de la Nativit\u00E9',
      'Wine and Oil are Allowed': 'vin et huile permis', 'Fish, Wine and Oil are Allowed': 'poisson, vin et huile permis', 'Wine is Allowed': 'vin permis', 'Wine, Oil and Caviar are Allowed': 'vin, huile et caviar permis', 'Meat Fast': 'sans viande', 'Strict Fast (Wine and Oil)': 'je\u00FBne (vin et huile permis)', 'Strict Fast': 'je\u00FBne strict', 'Fast Free': 'pas de je\u00FBne' },
    es: { Vespers: 'V\u00EDsperas', 'Matins Gospel': 'Evangelio de maitines', Matins: 'Maitines', 'Matins Epistle': 'Ep\u00EDstola de maitines', 'Vespers Gospel': 'Evangelio de v\u00EDsperas', '1st Hour': 'Hora prima', '3rd Hour': 'Hora tercia', '6th Hour': 'Hora sexta', '9th Hour': 'Hora nona', 'Great Blessing of Waters': 'Gran bendici\u00F3n de las aguas', 'Cross Procession': 'Procesi\u00F3n de la Cruz', 'Passion Gospel': 'Evangelio de la Pasi\u00F3n', Prophecy: 'Profec\u00EDa',
      'No Fast': '', Fast: 'Ayuno', 'Lenten Fast': 'Gran Cuaresma', 'Apostles Fast': 'Ayuno de los Ap\u00F3stoles', 'Dormition Fast': 'Ayuno de la Dormici\u00F3n', 'Nativity Fast': 'Ayuno de la Natividad',
      'Wine and Oil are Allowed': 'se permiten vino y aceite', 'Fish, Wine and Oil are Allowed': 'se permiten pescado, vino y aceite', 'Wine is Allowed': 'se permite vino', 'Wine, Oil and Caviar are Allowed': 'se permiten vino, aceite y caviar', 'Meat Fast': 'sin carne', 'Strict Fast (Wine and Oil)': 'ayuno (vino y aceite permitidos)', 'Strict Fast': 'ayuno estricto', 'Fast Free': 'sin ayuno' },
    zh: { Vespers: '\u665A\u7977', 'Matins Gospel': '\u6668\u7977\u798F\u97F3', Matins: '\u6668\u7977', 'Matins Epistle': '\u6668\u7977\u4F7F\u5F92\u4E66', 'Vespers Gospel': '\u665A\u7977\u798F\u97F3', '1st Hour': '\u7B2C\u4E00\u65F6\u8FB0\u7977', '3rd Hour': '\u7B2C\u4E09\u65F6\u8FB0\u7977', '6th Hour': '\u7B2C\u516D\u65F6\u8FB0\u7977', '9th Hour': '\u7B2C\u4E5D\u65F6\u8FB0\u7977', 'Great Blessing of Waters': '\u5927\u795D\u6C34\u793C', 'Cross Procession': '\u5341\u5B57\u67B6\u6E38\u884C', 'Passion Gospel': '\u53D7\u96BE\u798F\u97F3', Prophecy: '\u5148\u77E5\u4E66',
      'No Fast': '', Fast: '\u658B\u6212', 'Lenten Fast': '\u5927\u658B\u671F', 'Apostles Fast': '\u4F7F\u5F92\u658B\u671F', 'Dormition Fast': '\u5723\u6BCD\u5B89\u606F\u658B\u671F', 'Nativity Fast': '\u5723\u8BDE\u658B\u671F',
      'Wine and Oil are Allowed': '\u53EF\u7528\u9152\u548C\u6CB9', 'Fish, Wine and Oil are Allowed': '\u53EF\u7528\u9C7C\u3001\u9152\u548C\u6CB9', 'Wine is Allowed': '\u53EF\u7528\u9152', 'Wine, Oil and Caviar are Allowed': '\u53EF\u7528\u9152\u3001\u6CB9\u548C\u9C7C\u5B50', 'Meat Fast': '\u6212\u8089', 'Strict Fast (Wine and Oil)': '\u658B\u6212\uFF08\u53EF\u7528\u9152\u548C\u6CB9\uFF09', 'Strict Fast': '\u4E25\u658B', 'Fast Free': '\u514D\u658B' },
    hi: { Vespers: '\u0938\u0902\u0927\u094D\u092F\u093E \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0928\u093E', 'Matins Gospel': '\u092A\u094D\u0930\u093E\u0924\u0903 \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0928\u093E \u0915\u093E \u0938\u0941\u0938\u092E\u093E\u091A\u093E\u0930', Matins: '\u092A\u094D\u0930\u093E\u0924\u0903 \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0928\u093E', 'Matins Epistle': '\u092A\u094D\u0930\u093E\u0924\u0903 \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0928\u093E \u0915\u0940 \u092A\u0924\u094D\u0930\u0940', 'Vespers Gospel': '\u0938\u0902\u0927\u094D\u092F\u093E \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0928\u093E \u0915\u093E \u0938\u0941\u0938\u092E\u093E\u091A\u093E\u0930', '1st Hour': '\u092A\u0939\u0932\u093E \u092A\u094D\u0930\u0939\u0930', '3rd Hour': '\u0924\u0940\u0938\u0930\u093E \u092A\u094D\u0930\u0939\u0930', '6th Hour': '\u091B\u0920\u093E \u092A\u094D\u0930\u0939\u0930', '9th Hour': '\u0928\u094C\u0935\u093E\u0901 \u092A\u094D\u0930\u0939\u0930', 'Great Blessing of Waters': '\u091C\u0932 \u0915\u093E \u092E\u0939\u093E \u0906\u0936\u0940\u0930\u094D\u0935\u093E\u0926', 'Cross Procession': '\u0915\u094D\u0930\u0942\u0938 \u0915\u0940 \u0936\u094B\u092D\u093E\u092F\u093E\u0924\u094D\u0930\u093E', 'Passion Gospel': '\u0926\u0941\u0903\u0916\u092D\u094B\u0917 \u0915\u093E \u0938\u0941\u0938\u092E\u093E\u091A\u093E\u0930', Prophecy: '\u092D\u0935\u093F\u0937\u094D\u092F\u0935\u093E\u0923\u0940',
      'No Fast': '', Fast: '\u0909\u092A\u0935\u093E\u0938', 'Lenten Fast': '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938', 'Apostles Fast': '\u092A\u094D\u0930\u0947\u0930\u093F\u0924\u094B\u0902 \u0915\u093E \u0909\u092A\u0935\u093E\u0938', 'Dormition Fast': '\u0935\u093F\u0936\u094D\u0930\u093E\u092E \u0915\u093E \u0909\u092A\u0935\u093E\u0938', 'Nativity Fast': '\u091C\u0928\u094D\u092E \u0915\u093E \u0909\u092A\u0935\u093E\u0938',
      'Wine and Oil are Allowed': '\u0926\u093E\u0916\u0930\u0938 \u0914\u0930 \u0924\u0947\u0932 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F', 'Fish, Wine and Oil are Allowed': '\u092E\u091B\u0932\u0940, \u0926\u093E\u0916\u0930\u0938 \u0914\u0930 \u0924\u0947\u0932 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F', 'Wine is Allowed': '\u0926\u093E\u0916\u0930\u0938 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F', 'Wine, Oil and Caviar are Allowed': '\u0926\u093E\u0916\u0930\u0938, \u0924\u0947\u0932 \u0914\u0930 \u092E\u091B\u0932\u0940 \u0915\u0947 \u0905\u0902\u0921\u094B\u0902 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F', 'Meat Fast': '\u092E\u093E\u0902\u0938 \u0938\u0947 \u092A\u0930\u0939\u0947\u091C\u093C', 'Strict Fast (Wine and Oil)': '\u0909\u092A\u0935\u093E\u0938 (\u0926\u093E\u0916\u0930\u0938 \u0914\u0930 \u0924\u0947\u0932 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F)', 'Strict Fast': '\u0915\u0921\u093C\u093E \u0909\u092A\u0935\u093E\u0938', 'Fast Free': '\u0909\u092A\u0935\u093E\u0938 \u0928\u0939\u0940\u0902' },
    tl: { Vespers: 'Bespera', 'Matins Gospel': 'Ebanghelyo ng Matins', Matins: 'Matins', 'Matins Epistle': 'Sulat ng Matins', 'Vespers Gospel': 'Ebanghelyo ng Bespera', '1st Hour': 'Unang Oras', '3rd Hour': 'Ikatlong Oras', '6th Hour': 'Ikaanim na Oras', '9th Hour': 'Ikasiyam na Oras', 'Great Blessing of Waters': 'Dakilang Pagbabasbas ng Tubig', 'Cross Procession': 'Prusisyon ng Krus', 'Passion Gospel': 'Ebanghelyo ng Pasyon', Prophecy: 'Hula',
      'No Fast': '', Fast: 'Pag-aayuno', 'Lenten Fast': 'Dakilang Kuwaresma', 'Apostles Fast': 'Pag-aayuno ng mga Apostol', 'Dormition Fast': 'Pag-aayuno ng Paghimlay', 'Nativity Fast': 'Pag-aayuno ng Kapanganakan',
      'Wine and Oil are Allowed': 'pinapayagan ang alak at langis', 'Fish, Wine and Oil are Allowed': 'pinapayagan ang isda, alak at langis', 'Wine is Allowed': 'pinapayagan ang alak', 'Wine, Oil and Caviar are Allowed': 'pinapayagan ang alak, langis at itlog ng isda', 'Meat Fast': 'walang karne', 'Strict Fast (Wine and Oil)': 'pag-aayuno (pinapayagan ang alak at langis)', 'Strict Fast': 'mahigpit na pag-aayuno', 'Fast Free': 'walang pag-aayuno' },
    ru: {"Vespers": "Вечерня", "Matins Gospel": "Евангелие на утрене", "Matins": "Утреня", "Matins Epistle": "Апостол на утрене", "Vespers Gospel": "Евангелие на вечерне", "1st Hour": "Первый час", "3rd Hour": "Третий час", "6th Hour": "Шестой час", "9th Hour": "Девятый час", "Great Blessing of Waters": "Великое освящение воды", "Cross Procession": "Крестный ход", "Passion Gospel": "Страстное Евангелие", "Prophecy": "Паремия", "No Fast": "", "Fast": "Пост", "Lenten Fast": "Великий пост", "Apostles Fast": "Петров пост", "Dormition Fast": "Успенский пост", "Nativity Fast": "Рождественский пост", "Wine and Oil are Allowed": "разрешается вино и елей", "Fish, Wine and Oil are Allowed": "разрешается рыба, вино и елей", "Wine is Allowed": "разрешается вино", "Wine, Oil and Caviar are Allowed": "разрешается вино, елей и икра", "Meat Fast": "без мяса", "Strict Fast (Wine and Oil)": "пост (разрешается вино и елей)", "Strict Fast": "строгий пост", "Fast Free": "поста нет"},
    el: {"Vespers": "Εσπερινός", "Matins Gospel": "Εωθινό Ευαγγέλιο", "Matins": "Όρθρος", "Matins Epistle": "Απόστολος του Όρθρου", "Vespers Gospel": "Ευαγγέλιο του Εσπερινού", "1st Hour": "Α΄ Ώρα", "3rd Hour": "Γ΄ Ώρα", "6th Hour": "ΣΤ΄ Ώρα", "9th Hour": "Θ΄ Ώρα", "Great Blessing of Waters": "Μέγας Αγιασμός", "Cross Procession": "Λιτανεία του Τιμίου Σταυρού", "Passion Gospel": "Ευαγγέλιο των Παθών", "Prophecy": "Ανάγνωσμα", "No Fast": "", "Fast": "Νηστεία", "Lenten Fast": "Μεγάλη Τεσσαρακοστή", "Apostles Fast": "Νηστεία των Αγίων Αποστόλων", "Dormition Fast": "Νηστεία του Δεκαπενταυγούστου", "Nativity Fast": "Νηστεία των Χριστουγέννων", "Wine and Oil are Allowed": "κατάλυση οίνου και ελαίου", "Fish, Wine and Oil are Allowed": "κατάλυση ιχθύος, οίνου και ελαίου", "Wine is Allowed": "κατάλυση οίνου", "Wine, Oil and Caviar are Allowed": "κατάλυση οίνου, ελαίου και αυγοτάραχου", "Meat Fast": "αποχή από κρέας", "Strict Fast (Wine and Oil)": "νηστεία (κατάλυση οίνου και ελαίου)", "Strict Fast": "αυστηρή νηστεία", "Fast Free": "κατάλυση εις πάντα"}
  };
  var DAYS = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], ar: ['\u0627\u0644\u0623\u062D\u062F', '\u0627\u0644\u0627\u062B\u0646\u064A\u0646', '\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621', '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621', '\u0627\u0644\u062E\u0645\u064A\u0633', '\u0627\u0644\u062C\u0645\u0639\u0629', '\u0627\u0644\u0633\u0628\u062A'], fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], es: ['Domingo', 'Lunes', 'Martes', 'Mi\u00E9rcoles', 'Jueves', 'Viernes', 'S\u00E1bado'], zh: ['\u4E3B\u65E5', '\u661F\u671F\u4E00', '\u661F\u671F\u4E8C', '\u661F\u671F\u4E09', '\u661F\u671F\u56DB', '\u661F\u671F\u4E94', '\u661F\u671F\u516D'], hi: ['\u0930\u0935\u093F\u0935\u093E\u0930', '\u0938\u094B\u092E\u0935\u093E\u0930', '\u092E\u0902\u0917\u0932\u0935\u093E\u0930', '\u092C\u0941\u0927\u0935\u093E\u0930', '\u0917\u0941\u0930\u0941\u0935\u093E\u0930', '\u0936\u0941\u0915\u094D\u0930\u0935\u093E\u0930', '\u0936\u0928\u093F\u0935\u093E\u0930'], tl: ['Linggo', 'Lunes', 'Martes', 'Miyerkoles', 'Huwebes', 'Biyernes', 'Sabado'], ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], el: ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"] };
  var ORD = { First: 1, Second: 2, Third: 3, Fourth: 4, Fifth: 5, Sixth: 6 };
  /* {d} weekday, {n} number */
  var PAT = {
    ar: { sunPent: '\u0627\u0644\u0623\u062D\u062F {n} \u0628\u0639\u062F \u0627\u0644\u0639\u0646\u0635\u0631\u0629', dayPent: '{d} \u0645\u0646 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 {n} \u0628\u0639\u062F \u0627\u0644\u0639\u0646\u0635\u0631\u0629', dayLent: '{d} \u0645\u0646 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 {n} \u0645\u0646 \u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', satLent: '\u0627\u0644\u0633\u0628\u062A {n} \u0645\u0646 \u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', sunLent: '\u0627\u0644\u0623\u062D\u062F {n} \u0645\u0646 \u0627\u0644\u0635\u0648\u0645 \u0627\u0644\u0643\u0628\u064A\u0631', sunPascha: '\u0627\u0644\u0623\u062D\u062F {n} \u0645\u0646 \u0627\u0644\u0641\u0635\u062D', dayPascha: '{d} \u0645\u0646 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 {n} \u0645\u0646 \u0627\u0644\u0641\u0635\u062D', bright: '{d} \u0627\u0644\u0628\u0627\u0631\u0648\u0633\u064A (\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062A\u062C\u062F\u064A\u062F\u0627\u062A)', meat: '{d} \u0645\u0646 \u0623\u0633\u0628\u0648\u0639 \u0645\u0631\u0641\u0639 \u0627\u0644\u0644\u062D\u0645', cheese: '{d} \u0645\u0646 \u0623\u0633\u0628\u0648\u0639 \u0645\u0631\u0641\u0639 \u0627\u0644\u062C\u0628\u0646' },
    fr: { sunPent: '{n}e dimanche apr\u00E8s la Pentec\u00F4te', dayPent: '{d} de la {n}e semaine apr\u00E8s la Pentec\u00F4te', dayLent: '{d} de la {n}e semaine du Grand Car\u00EAme', satLent: '{n}e samedi du Grand Car\u00EAme', sunLent: '{n}e dimanche du Grand Car\u00EAme', sunPascha: '{n}e dimanche de P\u00E2ques', dayPascha: '{d} de la {n}e semaine de P\u00E2ques', bright: '{d} de la Semaine radieuse', meat: '{d} de la semaine de carnaval', cheese: '{d} de la semaine des laitages' },
    es: { sunPent: 'Domingo {n} despu\u00E9s de Pentecost\u00E9s', dayPent: '{d} de la semana {n} despu\u00E9s de Pentecost\u00E9s', dayLent: '{d} de la semana {n} de la Gran Cuaresma', satLent: 'S\u00E1bado {n} de la Gran Cuaresma', sunLent: 'Domingo {n} de la Gran Cuaresma', sunPascha: 'Domingo {n} de Pascua', dayPascha: '{d} de la semana {n} de Pascua', bright: '{d} de la Semana Luminosa', meat: '{d} de la semana de la carne', cheese: '{d} de la semana de los l\u00E1cteos' },
    zh: { sunPent: '\u4E94\u65EC\u8282\u540E\u7B2C{n}\u4E3B\u65E5', dayPent: '\u4E94\u65EC\u8282\u540E\u7B2C{n}\u5468{d}', dayLent: '\u5927\u658B\u671F\u7B2C{n}\u5468{d}', satLent: '\u5927\u658B\u671F\u7B2C{n}\u4E2A\u661F\u671F\u516D', sunLent: '\u5927\u658B\u671F\u7B2C{n}\u4E3B\u65E5', sunPascha: '\u590D\u6D3B\u8282\u7B2C{n}\u4E3B\u65E5', dayPascha: '\u590D\u6D3B\u8282\u7B2C{n}\u5468{d}', bright: '\u5149\u660E\u5468{d}', meat: '\u8089\u98DF\u5468{d}', cheese: '\u5976\u98DF\u5468{d}' },
    hi: { sunPent: '\u092A\u093F\u0928\u094D\u0924\u0947\u0915\u0941\u0938\u094D\u0924 \u0915\u0947 \u092C\u093E\u0926 \u0930\u0935\u093F\u0935\u093E\u0930 {n}', dayPent: '\u092A\u093F\u0928\u094D\u0924\u0947\u0915\u0941\u0938\u094D\u0924 \u0915\u0947 \u092C\u093E\u0926 \u0938\u092A\u094D\u0924\u093E\u0939 {n} \u0915\u093E {d}', dayLent: '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938 \u0915\u0947 \u0938\u092A\u094D\u0924\u093E\u0939 {n} \u0915\u093E {d}', satLent: '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938 \u0915\u093E \u0936\u0928\u093F\u0935\u093E\u0930 {n}', sunLent: '\u092E\u0939\u093E \u0909\u092A\u0935\u093E\u0938 \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930 {n}', sunPascha: '\u092A\u093E\u0938\u094D\u0915\u093E \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930 {n}', dayPascha: '\u092A\u093E\u0938\u094D\u0915\u093E \u0915\u0947 \u0938\u092A\u094D\u0924\u093E\u0939 {n} \u0915\u093E {d}', bright: '\u0909\u091C\u094D\u091C\u094D\u0935\u0932 \u0938\u092A\u094D\u0924\u093E\u0939 \u0915\u093E {d}', meat: '\u092E\u093E\u0902\u0938-\u0924\u094D\u092F\u093E\u0917 \u0938\u092A\u094D\u0924\u093E\u0939 \u0915\u093E {d}', cheese: '\u092A\u0928\u0940\u0930-\u0924\u094D\u092F\u093E\u0917 \u0938\u092A\u094D\u0924\u093E\u0939 \u0915\u093E {d}' },
    tl: { sunPent: 'Ika-{n} na Linggo pagkatapos ng Pentecostes', dayPent: '{d} ng ika-{n} na linggo pagkatapos ng Pentecostes', dayLent: '{d} ng ika-{n} na linggo ng Dakilang Kuwaresma', satLent: 'Ika-{n} na Sabado ng Dakilang Kuwaresma', sunLent: 'Ika-{n} na Linggo ng Dakilang Kuwaresma', sunPascha: 'Ika-{n} na Linggo ng Pascha', dayPascha: '{d} ng ika-{n} na linggo ng Pascha', bright: '{d} ng Maliwanag na Linggo', meat: '{d} ng linggo ng pag-iwas sa karne', cheese: '{d} ng linggo ng pag-iwas sa keso' },
    ru: {"sunPent": "Неделя {n}-я по Пятидесятнице", "dayPent": "{d} {n}-й седмицы по Пятидесятнице", "dayLent": "{d} {n}-й седмицы Великого поста", "satLent": "Суббота {n}-я Великого поста", "sunLent": "Неделя {n}-я Великого поста", "sunPascha": "Неделя {n}-я по Пасхе", "dayPascha": "{d} {n}-й седмицы по Пасхе", "bright": "{d} Светлой седмицы", "meat": "{d} мясопустной седмицы", "cheese": "{d} сырной седмицы"},
    el: {"sunPent": "{n}η Κυριακή μετά την Πεντηκοστή", "dayPent": "{d} της {n}ης εβδομάδας μετά την Πεντηκοστή", "dayLent": "{d} της {n}ης εβδομάδας των Νηστειών", "satLent": "{n}ο Σάββατο των Νηστειών", "sunLent": "{n}η Κυριακή των Νηστειών", "sunPascha": "{n}η Κυριακή από του Πάσχα", "dayPascha": "{d} της {n}ης εβδομάδας από του Πάσχα", "bright": "{d} της Διακαινησίμου", "meat": "{d} της εβδομάδας της Απόκρεω", "cheese": "{d} της Τυρινής"}
  };
  var NAMES = {
    'Holy Pascha': { ar: '\u0627\u0644\u0641\u0635\u062D \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'La Sainte P\u00E2que', es: 'Santa Pascua', zh: '\u5723\u590D\u6D3B\u8282', hi: '\u092A\u0935\u093F\u0924\u094D\u0930 \u092A\u093E\u0938\u094D\u0915\u093E', tl: 'Banal na Pascha' , ru: "Святая Пасха", el: "Το Άγιο Πάσχα"},
    'The Resurrection of our Lord and Savior Jesus Christ': { ar: '\u0642\u064A\u0627\u0645\u0629 \u0631\u0628\u0646\u0627 \u0648\u0645\u062E\u0644\u0635\u0646\u0627 \u064A\u0633\u0648\u0639 \u0627\u0644\u0645\u0633\u064A\u062D', fr: 'La R\u00E9surrection de notre Seigneur et Sauveur J\u00E9sus-Christ', es: 'La Resurrecci\u00F3n de nuestro Se\u00F1or y Salvador Jesucristo', zh: '\u6211\u4EEC\u7684\u4E3B\u6551\u4E3B\u8036\u7A23\u57FA\u7763\u590D\u6D3B', hi: '\u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0930\u092D\u0941 \u0914\u0930 \u0909\u0926\u094D\u0927\u093E\u0930\u0915\u0930\u094D\u0924\u093E \u092F\u0940\u0936\u0941 \u092E\u0938\u0940\u0939 \u0915\u093E \u092A\u0941\u0928\u0930\u0941\u0924\u094D\u0925\u093E\u0928', tl: 'Ang Muling Pagkabuhay ng ating Panginoon at Tagapagligtas na si Jesu-Cristo' , ru: "Светлое Христово Воскресение", el: "Η Ανάσταση του Κυρίου και Σωτήρος ημών Ιησού Χριστού"},
    'Nativity of Christ': { ar: '\u0645\u064A\u0644\u0627\u062F \u0627\u0644\u0645\u0633\u064A\u062D', fr: 'La Nativit\u00E9 du Christ', es: 'La Natividad de Cristo', zh: '\u57FA\u7763\u5723\u8BDE', hi: '\u092E\u0938\u0940\u0939 \u0915\u093E \u091C\u0928\u094D\u092E', tl: 'Ang Kapanganakan ni Cristo' , ru: "Рождество Христово", el: "Η Γέννηση του Χριστού"},
    'Theophany of Our Lord and Savior Jesus Christ': { ar: '\u0627\u0644\u0638\u0647\u0648\u0631 \u0627\u0644\u0625\u0644\u0647\u064A (\u0639\u064A\u062F \u0627\u0644\u063A\u0637\u0627\u0633)', fr: 'La Th\u00E9ophanie de notre Seigneur', es: 'La Teofan\u00EDa de nuestro Se\u00F1or', zh: '\u4E3B\u9886\u6D17\u8282\uFF08\u795E\u663E\u8282\uFF09', hi: '\u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u0908\u0936-\u092A\u094D\u0930\u0915\u091F\u0928', tl: 'Ang Teopaniya ng ating Panginoon' , ru: "Святое Богоявление. Крещение Господне", el: "Τα Άγια Θεοφάνεια"},
    'Circumcision of Our Lord': { ar: '\u062E\u062A\u0627\u0646 \u0631\u0628\u0646\u0627 \u064A\u0633\u0648\u0639 \u0627\u0644\u0645\u0633\u064A\u062D \u0628\u0627\u0644\u062C\u0633\u062F', fr: 'La Circoncision de notre Seigneur', es: 'La Circuncisi\u00F3n de nuestro Se\u00F1or', zh: '\u4E3B\u53D7\u5272\u793C\u8282', hi: '\u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u0916\u093C\u0924\u0928\u093E', tl: 'Ang Pagtutuli sa ating Panginoon' , ru: "Обрезание Господне", el: "Η κατά σάρκα Περιτομή του Κυρίου"},
    'Meeting of Christ in the Temple': { ar: '\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u064A\u062F \u0625\u0644\u0649 \u0627\u0644\u0647\u064A\u0643\u0644', fr: 'La Rencontre du Seigneur au Temple', es: 'El Encuentro del Se\u00F1or en el Templo', zh: '\u4E3B\u8FDB\u5802\u8282', hi: '\u092E\u0902\u0926\u093F\u0930 \u092E\u0947\u0902 \u092A\u094D\u0930\u092D\u0941 \u0915\u0940 \u092D\u0947\u0902\u091F', tl: 'Ang Pagsalubong sa Panginoon sa Templo' , ru: "Сретение Господне", el: "Η Υπαπαντή του Κυρίου"},
    'Annunciation Most Holy Theotokos': { ar: '\u0628\u0634\u0627\u0631\u0629 \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647 \u0627\u0644\u0641\u0627\u0626\u0642\u0629 \u0627\u0644\u0642\u062F\u0627\u0633\u0629', fr: 'L\u2019Annonciation de la Tr\u00E8s Sainte M\u00E8re de Dieu', es: 'La Anunciaci\u00F3n de la Sant\u00EDsima Madre de Dios', zh: '\u5723\u6BCD\u9886\u62A5\u8282', hi: '\u092A\u0930\u092E \u092A\u0935\u093F\u0924\u094D\u0930 \u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u094B \u0936\u0941\u092D \u0938\u0902\u0926\u0947\u0936', tl: 'Ang Pagbabalita sa Kabanal-banalang Theotokos' , ru: "Благовещение Пресвятой Богородицы", el: "Ο Ευαγγελισμός της Υπεραγίας Θεοτόκου"},
    'Transfiguration of Our Lord': { ar: '\u062A\u062C\u0644\u064A \u0631\u0628\u0646\u0627 \u064A\u0633\u0648\u0639 \u0627\u0644\u0645\u0633\u064A\u062D', fr: 'La Transfiguration de notre Seigneur', es: 'La Transfiguraci\u00F3n de nuestro Se\u00F1or', zh: '\u4E3B\u663E\u5723\u5BB9\u8282', hi: '\u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u0930\u0942\u092A\u093E\u0902\u0924\u0930\u0923', tl: 'Ang Pagbabagong-anyo ng ating Panginoon' , ru: "Преображение Господне", el: "Η Μεταμόρφωση του Σωτήρος"},
    'Dormition of the Most-Holy Theotokos': { ar: '\u0631\u0642\u0627\u062F \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647 \u0627\u0644\u0641\u0627\u0626\u0642\u0629 \u0627\u0644\u0642\u062F\u0627\u0633\u0629', fr: 'La Dormition de la Tr\u00E8s Sainte M\u00E8re de Dieu', es: 'La Dormici\u00F3n de la Sant\u00EDsima Madre de Dios', zh: '\u5723\u6BCD\u5B89\u606F\u8282', hi: '\u092A\u0930\u092E \u092A\u0935\u093F\u0924\u094D\u0930 \u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u0935\u093F\u0936\u094D\u0930\u093E\u092E', tl: 'Ang Paghimlay ng Kabanal-banalang Theotokos' , ru: "Успение Пресвятой Богородицы", el: "Η Κοίμηση της Υπεραγίας Θεοτόκου"},
    'Nativity of the Most-Holy Theotokos': { ar: '\u0645\u064A\u0644\u0627\u062F \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647 \u0627\u0644\u0641\u0627\u0626\u0642\u0629 \u0627\u0644\u0642\u062F\u0627\u0633\u0629', fr: 'La Nativit\u00E9 de la Tr\u00E8s Sainte M\u00E8re de Dieu', es: 'La Natividad de la Sant\u00EDsima Madre de Dios', zh: '\u5723\u6BCD\u8BDE\u8FB0\u8282', hi: '\u092A\u0930\u092E \u092A\u0935\u093F\u0924\u094D\u0930 \u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u091C\u0928\u094D\u092E', tl: 'Ang Kapanganakan ng Kabanal-banalang Theotokos' , ru: "Рождество Пресвятой Богородицы", el: "Το Γενέσιον της Υπεραγίας Θεοτόκου"},
    'Exaltation (Elevation) of the Precious Cross': { ar: '\u0631\u0641\u0639 \u0627\u0644\u0635\u0644\u064A\u0628 \u0627\u0644\u0643\u0631\u064A\u0645 \u0627\u0644\u0645\u062D\u064A\u064A', fr: 'L\u2019Exaltation de la Pr\u00E9cieuse Croix', es: 'La Exaltaci\u00F3n de la Preciosa Cruz', zh: '\u4E3E\u8363\u5723\u67B6\u8282', hi: '\u092C\u0939\u0941\u092E\u0942\u0932\u094D\u092F \u0915\u094D\u0930\u0942\u0938 \u0915\u093E \u0909\u0924\u094D\u0915\u0930\u094D\u0937', tl: 'Ang Pagtataas ng Mahalagang Krus' , ru: "Воздвижение Честного и Животворящего Креста Господня", el: "Η Παγκόσμιος Ύψωσις του Τιμίου Σταυρού"},
    'Entry of the Most-Holy Theotokos into the Temple': { ar: '\u062F\u062E\u0648\u0644 \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647 \u0625\u0644\u0649 \u0627\u0644\u0647\u064A\u0643\u0644', fr: 'L\u2019Entr\u00E9e au Temple de la Tr\u00E8s Sainte M\u00E8re de Dieu', es: 'La Entrada de la Sant\u00EDsima Madre de Dios en el Templo', zh: '\u5723\u6BCD\u8FDB\u5802\u8282', hi: '\u092A\u0930\u092E \u092A\u0935\u093F\u0924\u094D\u0930 \u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u092E\u0902\u0926\u093F\u0930 \u092E\u0947\u0902 \u092A\u094D\u0930\u0935\u0947\u0936', tl: 'Ang Pagpasok ng Kabanal-banalang Theotokos sa Templo' , ru: "Введение во храм Пресвятой Богородицы", el: "Τα Εισόδια της Υπεραγίας Θεοτόκου"},
    'Holy Pentecost': { ar: '\u0627\u0644\u0639\u0646\u0635\u0631\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629', fr: 'La Sainte Pentec\u00F4te', es: 'Santa Pentecost\u00E9s', zh: '\u5723\u4E94\u65EC\u8282', hi: '\u092A\u0935\u093F\u0924\u094D\u0930 \u092A\u093F\u0928\u094D\u0924\u0947\u0915\u0941\u0938\u094D\u0924', tl: 'Banal na Pentecostes' , ru: "Святая Пятидесятница", el: "Η Αγία Πεντηκοστή"},
    '8th Sunday of Pascha: Feast of the Holy Trinity': { ar: '\u0623\u062D\u062F \u0627\u0644\u0639\u0646\u0635\u0631\u0629: \u0639\u064A\u062F \u0627\u0644\u062B\u0627\u0644\u0648\u062B \u0627\u0644\u0642\u062F\u0648\u0633', fr: 'Pentec\u00F4te : f\u00EAte de la Sainte Trinit\u00E9', es: 'Pentecost\u00E9s: fiesta de la Sant\u00EDsima Trinidad', zh: '\u4E94\u65EC\u8282\uFF1A\u5723\u4E09\u4E00\u8282', hi: '\u092A\u093F\u0928\u094D\u0924\u0947\u0915\u0941\u0938\u094D\u0924: \u092A\u0935\u093F\u0924\u094D\u0930 \u0924\u094D\u0930\u093F\u090F\u0915\u0924\u093E \u0915\u093E \u092A\u0930\u094D\u0935', tl: 'Pentecostes: Kapistahan ng Banal na Trinidad' , ru: "День Святой Троицы. Пятидесятница", el: "Κυριακή της Πεντηκοστής"},
    'Ascension of the Lord': { ar: '\u0635\u0639\u0648\u062F \u0627\u0644\u0631\u0628', fr: 'L\u2019Ascension du Seigneur', es: 'La Ascensi\u00F3n del Se\u00F1or', zh: '\u4E3B\u5347\u5929\u8282', hi: '\u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u0938\u094D\u0935\u0930\u094D\u0917\u093E\u0930\u094B\u0939\u0923', tl: 'Ang Pag-akyat ng Panginoon' , ru: "Вознесение Господне", el: "Η Ανάληψη του Κυρίου"},
    'The Ascension of our Lord, God, and Saviour Jesus Christ': { ar: '\u0635\u0639\u0648\u062F \u0631\u0628\u0646\u0627 \u0648\u0625\u0644\u0647\u0646\u0627 \u0648\u0645\u062E\u0644\u0635\u0646\u0627 \u064A\u0633\u0648\u0639 \u0627\u0644\u0645\u0633\u064A\u062D', fr: 'L\u2019Ascension de notre Seigneur', es: 'La Ascensi\u00F3n de nuestro Se\u00F1or', zh: '\u4E3B\u5347\u5929\u8282', hi: '\u0939\u092E\u093E\u0930\u0947 \u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u0938\u094D\u0935\u0930\u094D\u0917\u093E\u0930\u094B\u0939\u0923', tl: 'Ang Pag-akyat ng ating Panginoon' , ru: "Вознесение Господа Бога и Спаса нашего Иисуса Христа", el: "Η Ανάληψη του Κυρίου ημών Ιησού Χριστού"},
    'Nativity of St John the Baptist': { ar: '\u0645\u0648\u0644\u062F \u0627\u0644\u0646\u0628\u064A \u064A\u0648\u062D\u0646\u0627 \u0627\u0644\u0645\u0639\u0645\u062F\u0627\u0646', fr: 'La Nativit\u00E9 de saint Jean-Baptiste', es: 'La Natividad de san Juan Bautista', zh: '\u5723\u5148\u77E5\u7EA6\u7FF0\u8BDE\u8FB0', hi: '\u0938\u0902\u0924 \u092F\u0942\u0939\u0928\u094D\u0928\u093E \u092C\u092A\u0924\u093F\u0938\u094D\u092E\u093E \u0926\u0947\u0928\u0947\u0935\u093E\u0932\u0947 \u0915\u093E \u091C\u0928\u094D\u092E', tl: 'Ang Kapanganakan ni San Juan Bautista' , ru: "Рождество Иоанна Предтечи", el: "Το Γενέσιον του Τιμίου Προδρόμου"},
    'Beheading of St John the Baptist': { ar: '\u0642\u0637\u0639 \u0631\u0623\u0633 \u0627\u0644\u0646\u0628\u064A \u064A\u0648\u062D\u0646\u0627 \u0627\u0644\u0645\u0639\u0645\u062F\u0627\u0646', fr: 'La D\u00E9collation de saint Jean-Baptiste', es: 'La Degollaci\u00F3n de san Juan Bautista', zh: '\u5723\u5148\u77E5\u7EA6\u7FF0\u88AB\u65A9\u9996', hi: '\u0938\u0902\u0924 \u092F\u0942\u0939\u0928\u094D\u0928\u093E \u092C\u092A\u0924\u093F\u0938\u094D\u092E\u093E \u0926\u0947\u0928\u0947\u0935\u093E\u0932\u0947 \u0915\u093E \u0938\u093F\u0930 \u0915\u093E\u091F\u093E \u091C\u093E\u0928\u093E', tl: 'Ang Pagpugot kay San Juan Bautista' , ru: "Усекновение главы Иоанна Предтечи", el: "Η Αποτομή της Τιμίας Κεφαλής του Προδρόμου"},
    'Holy Apostles Peter and Paul': { ar: '\u0627\u0644\u0642\u062F\u064A\u0633\u0627\u0646 \u0627\u0644\u0631\u0633\u0648\u0644\u0627\u0646 \u0628\u0637\u0631\u0633 \u0648\u0628\u0648\u0644\u0633', fr: 'Les saints ap\u00F4tres Pierre et Paul', es: 'Los santos ap\u00F3stoles Pedro y Pablo', zh: '\u5723\u4F7F\u5F92\u5F7C\u5F97\u548C\u4FDD\u7F57', hi: '\u092A\u0935\u093F\u0924\u094D\u0930 \u092A\u094D\u0930\u0947\u0930\u093F\u0924 \u092A\u0924\u0930\u0938 \u0914\u0930 \u092A\u094C\u0932\u0941\u0938', tl: 'Ang mga banal na apostol na sina Pedro at Pablo' , ru: "Святые первоверховные апостолы Петр и Павел", el: "Οι Άγιοι Απόστολοι Πέτρος και Παύλος"},
    'Protection (Pokrov) of the Most-Holy Theotokos': { ar: '\u062D\u0645\u0627\u064A\u0629 \u0648\u0627\u0644\u062F\u0629 \u0627\u0644\u0625\u0644\u0647', fr: 'La Protection de la M\u00E8re de Dieu', es: 'La Protecci\u00F3n de la Madre de Dios', zh: '\u5723\u6BCD\u62A4\u4F51\u8282', hi: '\u0908\u0936\u094D\u0935\u0930-\u091C\u0928\u0928\u0940 \u0915\u093E \u0938\u0902\u0930\u0915\u094D\u0937\u0923', tl: 'Ang Pagkalinga (Pokrov) ng Theotokos' , ru: "Покров Пресвятой Богородицы", el: "Η Αγία Σκέπη της Θεοτόκου"},
    'Sunday of Zacchaeus': { ar: '\u0623\u062D\u062F \u0632\u0643\u0627', fr: 'Dimanche de Zach\u00E9e', es: 'Domingo de Zaqueo', zh: '\u6492\u8BE5\u4E3B\u65E5', hi: '\u091C\u0915\u094D\u0915\u0908 \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930', tl: 'Linggo ni Zaqueo' , ru: "Неделя о Закхее", el: "Κυριακή του Ζακχαίου"},
    'Sunday of the Publican and the Pharisee': { ar: '\u0623\u062D\u062F \u0627\u0644\u0641\u0631\u064A\u0633\u064A \u0648\u0627\u0644\u0639\u0634\u0627\u0631', fr: 'Dimanche du Publicain et du Pharisien', es: 'Domingo del Publicano y el Fariseo', zh: '\u7A0E\u540F\u548C\u6CD5\u5229\u8D5B\u4EBA\u4E3B\u65E5', hi: '\u092E\u0939\u0938\u0942\u0932 \u0932\u0947\u0928\u0947\u0935\u093E\u0932\u0947 \u0914\u0930 \u092B\u0930\u0940\u0938\u0940 \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930', tl: 'Linggo ng Maniningil ng Buwis at ng Fariseo' , ru: "Неделя о мытаре и фарисее", el: "Κυριακή του Τελώνου και του Φαρισαίου"},
    'Sunday of the Prodigal Son': { ar: '\u0623\u062D\u062F \u0627\u0644\u0627\u0628\u0646 \u0627\u0644\u0634\u0627\u0637\u0631', fr: 'Dimanche du Fils prodigue', es: 'Domingo del Hijo pr\u00F3digo', zh: '\u6D6A\u5B50\u4E3B\u65E5', hi: '\u0909\u0921\u093C\u093E\u090A \u092A\u0941\u0924\u094D\u0930 \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930', tl: 'Linggo ng Alibughang Anak' , ru: "Неделя о блудном сыне", el: "Κυριακή του Ασώτου"},
    'Sunday of Meatfare': { ar: '\u0623\u062D\u062F \u0627\u0644\u062F\u064A\u0646\u0648\u0646\u0629 (\u0645\u0631\u0641\u0639 \u0627\u0644\u0644\u062D\u0645)', fr: 'Dimanche du Jugement dernier', es: 'Domingo del Juicio Final', zh: '\u6700\u540E\u5BA1\u5224\u4E3B\u65E5\uFF08\u8089\u98DF\u4E3B\u65E5\uFF09', hi: '\u0905\u0902\u0924\u093F\u092E \u0928\u094D\u092F\u093E\u092F \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930', tl: 'Linggo ng Huling Paghuhukom' , ru: "Неделя мясопустная, о Страшном Суде", el: "Κυριακή της Απόκρεω"},
    'Sunday of Cheesefare: Expulsion of Adam from Paradise': { ar: '\u0623\u062D\u062F \u0645\u0631\u0641\u0639 \u0627\u0644\u062C\u0628\u0646 (\u0627\u0644\u063A\u0641\u0631\u0627\u0646)', fr: 'Dimanche du Pardon : expulsion d\u2019Adam du Paradis', es: 'Domingo del Perd\u00F3n: expulsi\u00F3n de Ad\u00E1n del Para\u00EDso', zh: '\u5BBD\u6055\u4E3B\u65E5\uFF1A\u4E9A\u5F53\u88AB\u9010\u51FA\u4E50\u56ED', hi: '\u0915\u094D\u0937\u092E\u093E \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930: \u0906\u0926\u092E \u0915\u093E \u0938\u094D\u0935\u0930\u094D\u0917\u0932\u094B\u0915 \u0938\u0947 \u0928\u093F\u0915\u093E\u0932\u093E \u091C\u093E\u0928\u093E', tl: 'Linggo ng Kapatawaran: pagpapalayas kay Adan mula sa Paraiso' , ru: "Неделя сыропустная. Воспоминание Адамова изгнания", el: "Κυριακή της Τυροφάγου"},
    'Lazarus Saturday': { ar: '\u0633\u0628\u062A \u0644\u0639\u0627\u0632\u0631', fr: 'Samedi de Lazare', es: 'S\u00E1bado de L\u00E1zaro', zh: '\u62C9\u6492\u8DEF\u661F\u671F\u516D', hi: '\u0932\u093E\u091C\u093C\u0930 \u0915\u093E \u0936\u0928\u093F\u0935\u093E\u0930', tl: 'Sabado ni Lazaro' , ru: "Лазарева суббота", el: "Σάββατο του Λαζάρου"},
    'Palm Sunday: Entrance of Our Lord into Jerusalem': { ar: '\u0623\u062D\u062F \u0627\u0644\u0634\u0639\u0627\u0646\u064A\u0646: \u062F\u062E\u0648\u0644 \u0627\u0644\u0631\u0628 \u0625\u0644\u0649 \u0623\u0648\u0631\u0634\u0644\u064A\u0645', fr: 'Dimanche des Rameaux : entr\u00E9e du Seigneur \u00E0 J\u00E9rusalem', es: 'Domingo de Ramos: entrada del Se\u00F1or en Jerusal\u00E9n', zh: '\u5723\u679D\u4E3B\u65E5\uFF1A\u4E3B\u8FDB\u8036\u8DEF\u6492\u51B7', hi: '\u0916\u091C\u0942\u0930 \u0930\u0935\u093F\u0935\u093E\u0930: \u092A\u094D\u0930\u092D\u0941 \u0915\u093E \u092F\u0930\u0942\u0936\u0932\u0947\u092E \u092E\u0947\u0902 \u092A\u094D\u0930\u0935\u0947\u0936', tl: 'Linggo ng Palaspas: pagpasok ng Panginoon sa Jerusalem' , ru: "Вход Господень в Иерусалим", el: "Κυριακή των Βαΐων"},
    'Great and Holy Monday': { ar: '\u0627\u0644\u0627\u062B\u0646\u064A\u0646 \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'Grand et Saint Lundi', es: 'Gran y Santo Lunes', zh: '\u5723\u5927\u661F\u671F\u4E00', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u0938\u094B\u092E\u0935\u093E\u0930', tl: 'Dakila at Banal na Lunes' , ru: "Великий Понедельник", el: "Μεγάλη Δευτέρα"},
    'Great and Holy Tuesday': { ar: '\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621 \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'Grand et Saint Mardi', es: 'Gran y Santo Martes', zh: '\u5723\u5927\u661F\u671F\u4E8C', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u092E\u0902\u0917\u0932\u0935\u093E\u0930', tl: 'Dakila at Banal na Martes' , ru: "Великий Вторник", el: "Μεγάλη Τρίτη"},
    'Great and Holy Wednesday': { ar: '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621 \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'Grand et Saint Mercredi', es: 'Gran y Santo Mi\u00E9rcoles', zh: '\u5723\u5927\u661F\u671F\u4E09', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u092C\u0941\u0927\u0935\u093E\u0930', tl: 'Dakila at Banal na Miyerkoles' , ru: "Великая Среда", el: "Μεγάλη Τετάρτη"},
    'Great and Holy Thursday': { ar: '\u0627\u0644\u062E\u0645\u064A\u0633 \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'Grand et Saint Jeudi', es: 'Gran y Santo Jueves', zh: '\u5723\u5927\u661F\u671F\u56DB', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u0917\u0941\u0930\u0941\u0935\u093E\u0930', tl: 'Dakila at Banal na Huwebes' , ru: "Великий Четверг", el: "Μεγάλη Πέμπτη"},
    'Great and Holy Friday': { ar: '\u0627\u0644\u062C\u0645\u0639\u0629 \u0627\u0644\u0639\u0638\u064A\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629', fr: 'Grand et Saint Vendredi', es: 'Gran y Santo Viernes', zh: '\u5723\u5927\u661F\u671F\u4E94', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u0936\u0941\u0915\u094D\u0930\u0935\u093E\u0930', tl: 'Dakila at Banal na Biyernes' , ru: "Великая Пятница", el: "Μεγάλη Παρασκευή"},
    'Great and Holy Saturday': { ar: '\u0627\u0644\u0633\u0628\u062A \u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0645\u0642\u062F\u0633', fr: 'Grand et Saint Samedi', es: 'Gran y Santo S\u00E1bado', zh: '\u5723\u5927\u661F\u671F\u516D', hi: '\u092E\u0939\u093E\u0928 \u0914\u0930 \u092A\u0935\u093F\u0924\u094D\u0930 \u0936\u0928\u093F\u0935\u093E\u0930', tl: 'Dakila at Banal na Sabado' , ru: "Великая Суббота", el: "Μέγα Σάββατο"},
    'Antipascha: 2nd Sunday of Pascha': { ar: '\u0623\u062D\u062F \u062A\u0648\u0645\u0627 (\u0627\u0644\u0623\u062D\u062F \u0627\u0644\u062C\u062F\u064A\u062F)', fr: 'Dimanche de Thomas (Antip\u00E2que)', es: 'Domingo de Tom\u00E1s (Antipascua)', zh: '\u591A\u9A6C\u4E3B\u65E5', hi: '\u0925\u094B\u092E\u093E \u0915\u093E \u0930\u0935\u093F\u0935\u093E\u0930', tl: 'Linggo ni Tomas (Antipascha)' , ru: "Антипасха. Неделя 2-я по Пасхе, апостола Фомы", el: "Κυριακή του Θωμά (Αντίπασχα)"}
  };
  var GREAT = ['Nativity of Christ', 'Theophany of Our Lord and Savior Jesus Christ', 'Meeting of Christ in the Temple', 'Annunciation Most Holy Theotokos', 'Transfiguration of Our Lord', 'Dormition of the Most-Holy Theotokos', 'Nativity of the Most-Holy Theotokos', 'Exaltation (Elevation) of the Precious Cross', 'Entry of the Most-Holy Theotokos into the Temple', 'Circumcision of Our Lord', 'Holy Pentecost', 'Ascension of the Lord', 'The Resurrection of our Lord and Savior Jesus Christ', 'Nativity of St John the Baptist', 'Holy Apostles Peter and Paul', 'Beheading of St John the Baptist', 'Protection (Pokrov) of the Most-Holy Theotokos'];

  function fill(p, d, n) { return p.replace('{d}', d).replace('{n}', n); }
  function wd(name) { var i = DAYS.en.indexOf(name); return i < 0 ? name : DAYS[LANG][i]; }
  function dayName(t) {
    if (!t || LANG === 'en') return t;
    if (NAMES[t] && NAMES[t][LANG]) return NAMES[t][LANG];
    var P = PAT[LANG], m;
    if ((m = /^(\d+)(?:st|nd|rd|th) Sunday after Pentecost$/.exec(t))) return fill(P.sunPent, '', m[1]);
    if ((m = /^(\w+) of the (\d+)(?:st|nd|rd|th) week after Pentecost$/i.exec(t))) return fill(P.dayPent, wd(m[1]), m[2]);
    if ((m = /^(\w+) of the (First|Second|Third|Fourth|Fifth|Sixth) Week of Lent$/.exec(t))) return fill(P.dayLent, wd(m[1]), ORD[m[2]]);
    if ((m = /^(First|Second|Third|Fourth|Fifth|Sixth) Saturday of Lent$/.exec(t))) return fill(P.satLent, '', ORD[m[1]]);
    if ((m = /^(First|Second|Third|Fourth|Fifth|Sixth) Sunday of Lent$/.exec(t))) return fill(P.sunLent, '', ORD[m[1]]);
    if ((m = /^(\d+)(?:st|nd|rd|th) Sunday of Pascha$/.exec(t))) return fill(P.sunPascha, '', m[1]);
    if ((m = /^(\w+) of the (\d+)(?:st|nd|rd|th) Sunday of Pascha$/.exec(t))) return fill(P.dayPascha, wd(m[1]), m[2]);
    if ((m = /^Bright (\w+)$/.exec(t))) return fill(P.bright, wd(m[1]), '');
    if ((m = /^(\w+) of Meatfare$/.exec(t))) return fill(P.meat, wd(m[1]), '');
    if ((m = /^(?:(\w+) of Cheesefare|Cheesefare (\w+))$/.exec(t))) return fill(P.cheese, wd(m[1] || m[2]), '');
    return t; /* names of saints stay in English */
  }
  function source(s) {
    if (L[s]) return L[s];
    if (LANG === 'en') return s;
    var x = X[LANG], m;
    if (x[s]) return x[s];
    if ((m = /^(\d+)(?:st|nd|rd|th) Matins Gospel$/.exec(s))) return x['Matins Gospel'] + ' ' + m[1];
    if ((m = /^(\d+)(?:st|nd|rd|th) Passion Gospel$/.exec(s))) return x['Passion Gospel'] + ' ' + m[1];
    if ((m = /^(.+), (Prophecy|Epistle|Gospel)$/.exec(s))) return source(m[1]) + ' \u00B7 ' + (L[m[2]] || x[m[2]] || m[2]);
    return s;
  }
  /* 4.57.0 · a feast or a fast into your own calendar: in the app, the phone's calendar opens with it filled in;
     on the website, a small calendar file (.ics) that any calendar opens */
  var ADD = { en: 'Add to my calendar', fr: 'Ajouter à mon agenda', es: 'Añadir a mi calendario', ar: 'أضف إلى تقويمي', el: 'Προσθήκη στο ημερολόγιό μου', ru: 'Добавить в мой календарь', zh: '添加到我的日历', hi: 'मेरे कैलेंडर में जोड़ें', tl: 'Idagdag sa aking kalendaryo' }[LANG];
  function addCal(title, desc, start, days) {
    days = Math.max(1, days || 1); var p = start.split('-').map(Number), N = window.KJTNative;
    if (N && N.addEvent) { N.addEvent(title, desc, p[0], p[1], p[2], days); return; }
    var e = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days)), ymd = function (y, m, d) { return y + ('0' + m).slice(-2) + ('0' + d).slice(-2); };
    var esc = function (t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bible Corner//Orthodox calendar//EN', 'BEGIN:VEVENT', 'UID:' + start + '-' + Math.random().toString(36).slice(2) + '@biblecorner.com',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), 'DTSTART;VALUE=DATE:' + ymd(p[0], p[1], p[2]), 'DTEND;VALUE=DATE:' + ymd(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate()),
      'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(desc), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = (title || 'feast').replace(/[^\w\u00C0-\uFFFF-]+/g, '-').slice(0, 60) + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function calBtn(title, desc, start, days, small) {
    var b = el('button', small ? 'kjtb-addcal kjtb-addcal--s' : 'kjtb-addcal', small ? '\uD83D\uDCC5+' : '\uD83D\uDCC5 ' + ADD); b.type = 'button'; b.title = ADD; b.setAttribute('aria-label', ADD + ': ' + title);
    b.addEventListener('click', function (e) { e.stopPropagation(); addCal(title, desc, start, days); }); return b;
  }
  function fastText(d) {
    if (!d.fast || d.fast === 'No Fast') return '';
    var x = X[LANG] || {}, a = d.fast === 'Fast' && d.fast_note ? '' : (LANG === 'en' ? d.fast : (x[d.fast] || d.fast)), b = d.fast_note ? (LANG === 'en' ? d.fast_note : (x[d.fast_note] || d.fast_note)) : '';
    return a && b ? a + ' \u00B7 ' + b : (a || b);
  }

  /* ---------- book names in the visitor's language ---------- */
  var EN = { GEN: 'Genesis', EXO: 'Exodus', LEV: 'Leviticus', NUM: 'Numbers', DEU: 'Deuteronomy', JOS: 'Joshua', JDG: 'Judges', RUT: 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings', JOB: 'Job', PSA: 'Psalms', PRO: 'Proverbs', ECC: 'Ecclesiastes', SNG: 'Song of Songs', WIS: 'Wisdom of Solomon', SIR: 'Sirach', ISA: 'Isaiah', JER: 'Jeremiah', BAR: 'Baruch', LAM: 'Lamentations', EZK: 'Ezekiel', DAN: 'Daniel', HOS: 'Hosea', JOL: 'Joel', AMO: 'Amos', OBA: 'Obadiah', JON: 'Jonah', MIC: 'Micah', NAM: 'Nahum', HAB: 'Habakkuk', ZEP: 'Zephaniah', HAG: 'Haggai', ZEC: 'Zechariah', MAL: 'Malachi', MAT: 'Matthew', MRK: 'Mark', LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians', GAL: 'Galatians', EPH: 'Ephesians', PHP: 'Philippians', COL: 'Colossians', '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy', '2TI': '2 Timothy', TIT: 'Titus', PHM: 'Philemon', HEB: 'Hebrews', JAS: 'James', '1PE': '1 Peter', '2PE': '2 Peter', '1JN': '1 John', '2JN': '2 John', '3JN': '3 John', JUD: 'Jude', REV: 'Revelation' };
  function bookName(code) {
    var u = window.KJTB_UI_BOOKS; if (LANG !== 'en' && u && u[code]) return u[code];
    var sel = document.getElementById('kjtb-book'), o = sel && sel.querySelector('option[value="' + code + '"]');
    if (o && LANG !== 'en' && o.textContent) return o.textContent;
    return EN[code] || code;
  }
  /* the numbers are kept left-to-right, so "1:27\u20132:4" reads correctly on the Arabic page */
  function refLabel(refs, into) {
    var last = '';
    refs.forEach(function (x, i) {
      var b = x[0], c = x[1], v = x[2], c2 = x[3], v2 = x[4];
      var s = c2 !== c ? c + ':' + v + '\u2013' + c2 + ':' + v2 : (v2 !== v ? c + ':' + v + '\u2013' + v2 : c + ':' + v);
      if (i) into.appendChild(document.createTextNode(LANG === 'ar' ? '\u060C ' : ', '));
      /* 4.13.0: on the other pages of the site the site's language helper names the book, and gives the
         chapter and verse numbers of that language's Bible (the Psalms as in the Septuagint for Greek and Russian) */
      var nm = bookName(b), K = window.KJT_LANG;
      if (LANG !== 'en' && K && K.t && EN[b]) { var full = K.t(EN[b] + ' ' + s), mm = /^(.*\S)\s+(\d[\d:\u2013\-]*)$/.exec(full || ''); if (mm && full !== EN[b] + ' ' + s) { if (!window.KJTB_UI_BOOKS) nm = mm[1]; s = mm[2]; } }
      if (b !== last) into.appendChild(document.createTextNode(nm + ' '));
      var n = document.createElement('bdi'); n.setAttribute('dir', 'ltr'); n.textContent = s; into.appendChild(n); last = b;
    });
    return into;
  }
  /* the reader's address for a reading: from its first verse to its last (same book) */
  function href(refs) {
    /* one place, or pieces close together (Heb 11:8, 11-16): the whole span; pieces far apart: the first one */
    var a = refs[0], same = refs.filter(function (r) { return r[0] === a[0] && r[1] === a[1]; }), z = same.length === refs.length ? same.pop() : a;
    var range = a[2] + '-' + (z[3] !== a[1] ? z[3] + ':' : '') + z[4];
    var tr = document.getElementById('kjtb-translation'), t = tr && tr.value ? tr.value : 'kjv';
    var hash = '#/read/' + encodeURIComponent(t) + '/' + a[0] + '/' + a[1] + '/' + range;
    if (document.getElementById('kjtb-reader')) return hash;
    return C.page + (LANG !== 'en' ? '?lang=' + LANG : '') + hash;
  }

  /* ---------- dates and the copy kept on this device ---------- */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function shift(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  /* 4.7.1: the visitor may choose the calendar (remembered on this device) */
  var MKEY = 'kjtb_lect_mymode', MODE = C.mode;
  if (C.choice) { try { var mm = localStorage.getItem(MKEY); if (mm === 'old' || mm === 'new' || mm === 'greek') MODE = mm; } catch (e) {} }
  var KEY = 'kjtb_lect_' + MODE, RKEY = 'kjtb_lect_read';
  function store() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function keep(days) {
    var s = store(); days.forEach(function (d) { if (d && d.date) s[d.date] = d; });
    var ks = Object.keys(s).sort(); while (ks.length > 45) delete s[ks.shift()];
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function readSet() { try { return JSON.parse(localStorage.getItem(RKEY)) || {}; } catch (e) { return {}; } }
  /* 4.9.0: each reading can be marked as read; it goes to My Reading Journey ("Church readings").
     Away from the Holy Bible page the marks wait on this device and join the Journey there. */
  var DKEY = 'kjtb_lect_done', PKEY = 'kjtb_lect_jpending';
  function jget(k) { try { return JSON.parse(localStorage.getItem(k)) || (k === PKEY ? [] : {}); } catch (e) { return k === PKEY ? [] : {}; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rKey(r) { var a = r.refs[0]; return (r.source + (r.desc ? ' (' + r.desc + ')' : '')).replace(/[^A-Za-z0-9 ,.()'_-]/g, '').slice(0, 40) + '|' + a[0] + a[1] + '.' + a[2]; }
  function rVal(r) { var a = r.refs[0], same = r.refs.filter(function (x) { return x[0] === a[0]; }), z = same[same.length - 1]; return a[0] + '.' + a[1] + '.' + a[2] + '-' + z[3] + '.' + z[4]; }
  function isDone(date, r) { var d = jget(DKEY)[date]; return !!(d && d[rKey(r)]); }
  function dayNum(date) { var t = parse(date); return Math.floor((t.getTime() - t.getTimezoneOffset() * 60000) / 86400000); }
  function markReading(date, r) {
    if (!r.refs || !r.refs.length || isDone(date, r)) return;
    var done = jget(DKEY); (done[date] = done[date] || {})[rKey(r)] = rVal(r);
    var ks = Object.keys(done).sort(); while (ks.length > 400) delete done[ks.shift()]; jset(DKEY, done);
    var dn = dayNum(date), ch = {}, read = {}, days = {}; ch[date] = {}; ch[date][rKey(r)] = rVal(r); days[dn] = 1;
    (r.whole || []).forEach(function (k) { read[k] = [dn, dn, 1]; });
    /* 4.9.11: the verses of chapters read only in part count too (My Reading Journey joins them) */
    var parts = {};
    (r.refs || []).forEach(function (x) { for (var c = +x[1]; c <= +x[3]; c++) { var k = x[0] + '.' + c; if (read[k]) continue; (parts[k] = parts[k] || []).push([c === +x[1] ? +x[2] : 1, c === +x[3] ? +x[4] : 999]); } });
    var add = { v: 1, church: ch, read: read, parts: parts, days: days, earned: {} };
    if (window.KJTB_JOURNEY) { try { window.KJTB_JOURNEY.add(add); return; } catch (e) {} }
    var p = jget(PKEY); p.push(add); if (p.length > 300) p = p.slice(-300); jset(PKEY, p);
  }
  function syncJourney() {
    if (!window.KJTB_JOURNEY) return;
    var p = jget(PKEY); if (p.length) { p.forEach(function (x) { try { window.KJTB_JOURNEY.add(x); } catch (e) {} }); jset(PKEY, []); }
    try { var ch = window.KJTB_JOURNEY.church ? window.KJTB_JOURNEY.church() : {}, done = jget(DKEY); Object.keys(ch).forEach(function (d) { done[d] = Object.assign(done[d] || {}, ch[d]); }); jset(DKEY, done); } catch (e) {}
  }
  function fetchDays(from, n) {
    return fetch(C.ajax + '?action=kjtb_lect&from=' + from + '&days=' + n + '&mode=' + MODE, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.success) throw new Error('bad'); keep(j.data.days); return j.data.days; });
  }
  /* fresh from the site when possible (a correction made today shows at once), else the copy on this device */
  function getDay(date) {
    var s = store();
    var net = fetchDays(date, 7).then(function (days) { return days[0]; });
    var timeout = new Promise(function (res, rej) { setTimeout(function () { rej(new Error('slow')); }, s[date] ? 2500 : 15000); });
    return Promise.race([net, timeout]).catch(function (e) { if (s[date]) return s[date]; throw e; });
  }

  /* ---------- drawing ---------- */
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var today = ymd(new Date());
  function draw(box, date) {
    box.innerHTML = ''; box.setAttribute('aria-busy', 'true');
    box.appendChild(el('p', 'kjtb-lect__loading', L.loading));
    getDay(date).then(function (d) { render(box, d, date); }, function () {
      box.innerHTML = ''; box.removeAttribute('aria-busy'); head(box, date, null); box.appendChild(el('p', 'kjtb-lect__empty', L.offline));
    });
  }
  function head(box, date, d) {
    var h = el('div', 'kjtb-lect__head');
    var prev = el('button', 'kjtb-lect__nav', LANG === 'ar' ? '\u203A' : '\u2039'); prev.type = 'button'; prev.title = L.prev; prev.setAttribute('aria-label', L.prev); prev.onclick = function () { draw(box, shift(date, -1)); };
    var next = el('button', 'kjtb-lect__nav', LANG === 'ar' ? '\u2039' : '\u203A'); next.type = 'button'; next.title = L.next; next.setAttribute('aria-label', L.next); next.onclick = function () { draw(box, shift(date, 1)); };
    var mid = el('div', 'kjtb-lect__mid');
    mid.appendChild(el('p', 'kjtb-lect__kicker', date === today ? '\uD83D\uDCD6 ' + L.title : '\uD83D\uDCD6 ' + L.of + ' ' + parse(date).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })));
    if (date === today) mid.appendChild(el('p', 'kjtb-lect__date', parse(date).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));
    h.appendChild(prev); h.appendChild(mid); h.appendChild(next);
    box.appendChild(h);
    /* 4.38.0: the Orthodox calendar, a month at a glance */
    var cb = el('button', 'kjtb-lect__calbtn', '\uD83D\uDCC5 ' + CL.cal); cb.type = 'button'; cb.onclick = function () { calendar(box, date.slice(0, 7), date); }; box.appendChild(cb);
    if (date !== today) { var t = el('button', 'kjtb-lect__today', L.today); t.type = 'button'; t.onclick = function () { draw(box, today); }; box.appendChild(t); }
  }
  function render(box, d, date) {
    box.innerHTML = ''; box.removeAttribute('aria-busy');
    head(box, date, d);
    if (!d || d.missing) { box.appendChild(el('p', 'kjtb-lect__empty', L.missing)); return; }
    var feasts = (d.feast || '').split('; ').filter(Boolean), great = feasts.filter(function (f) { return GREAT.indexOf(f) >= 0; })[0];
    var title = great || d.title || feasts[0] || '';
    var h = el('h3', 'kjtb-lect__title' + (d.level >= 7 ? ' is-great' : ''), (d.level >= 7 ? '\u2720 ' : '') + dayName(title));
    if (date === today) chip(d.level >= 7 && great ? dayName(great) : '');
    box.appendChild(h);
    /* 4.81.0: the icon of the great feast (an old icon, public domain, Wikimedia Commons) */
    if (d.icon && d.icon.src) {
      var fig = el('figure', 'kjtb-lect__icon'), im = el('img'); im.src = d.icon.src; im.alt = ((FEASTS || {})[d.icon.key] || d.icon.t || title); im.loading = 'lazy'; im.decoding = 'async'; fig.appendChild(im);
      var cap = el('figcaption', '', d.icon.by || ''); if (d.icon.page) { var a = el('a', '', ' ↗'); a.href = d.icon.page; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Wikimedia Commons'; cap.appendChild(a); }
      cap.setAttribute('lang', 'en'); fig.appendChild(cap); box.appendChild(fig);
    }
    var others = feasts.filter(function (f) { return f !== title; });
    if (great && d.title && d.title !== great) others.unshift(d.title);
    var sub = others.map(dayName).concat(d.saints ? [d.saints] : []).join(' \u00B7 ');
    if (sub) { var s = el('p', 'kjtb-lect__saints', sub); if (LANG !== 'en') s.setAttribute('lang', 'en'); box.appendChild(s); }
    var f = fastText(d); if (f) box.appendChild(el('p', 'kjtb-lect__fast', '\uD83C\uDF3F ' + L.fast + ': ' + f));
    if (title || f) box.appendChild(calBtn(dayName(title) || (L.fast + ': ' + f), [sub, f ? L.fast + ': ' + f : ''].filter(Boolean).join('\n'), date, 1));
    var main = d.readings.filter(function (r) { return r.source === 'Epistle' || r.source === 'Gospel'; });
    var rest = d.readings.filter(function (r) { return main.indexOf(r) < 0; });
    if (d.corrected) { main = d.readings; rest = []; }
    var list = el('ul', 'kjtb-lect__list');
    main.forEach(function (r) { list.appendChild(item(r, date, box, d)); });
    if (main.length) box.appendChild(list); else box.appendChild(el('p', 'kjtb-lect__empty', L.none));
    if (rest.length) {
      var det = el('details', 'kjtb-lect__more'); det.appendChild(el('summary', '', L.more + ' (' + rest.length + ')'));
      var ul = el('ul', 'kjtb-lect__list'); rest.forEach(function (r) { ul.appendChild(item(r, date, box, d)); }); det.appendChild(ul); box.appendChild(det);
    }
    if (d.corrected) box.appendChild(el('p', 'kjtb-lect__note', '\u2713 ' + L.corrected));
    /* mark as read: each reading (tick) or all of them */
    if (main.length && date <= today) {
      var old = !!readSet()[date]; if (old) main.forEach(function (r) { markReading(date, r); });
      var all = function () { return main.every(function (r) { return !r.refs || !r.refs.length || isDone(date, r); }); };
      var b = el('button', 'kjtb-lect__mark' + (all() ? ' is-done' : ''), all() ? L.marked : '\u2610 ' + L.mark); b.type = 'button';
      b.onclick = function () { main.forEach(function (r) { markReading(date, r); }); render(box, d, date); };
      box.appendChild(b);
    }
    chooser(box, date);
  }
  function chooser(box, date) {
    if (!C.choice) return;
    var p = el('p', 'kjtb-lect__cal'), lab = el('label', '', '\uD83D\uDCC5 ' + MODES.label + ' '), sel = document.createElement('select');
    ['old', 'new', 'greek'].forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = MODES[m]; if (m === MODE) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () {
      MODE = sel.value; KEY = 'kjtb_lect_' + MODE;
      try { localStorage.setItem(MKEY, MODE); } catch (e) {}
      document.querySelectorAll('.kjtb-lect').forEach(function (b) { draw(b, b === box ? date : today); });
      document.querySelectorAll('[data-kjtb-feasts]').forEach(drawFeasts);
      try { greet(); } catch (e) {}
    });
    lab.appendChild(sel); p.appendChild(lab); box.appendChild(p);
  }
  function item(r, date, box, d) {
    var li = el('li', 'kjtb-lect__item');
    if (r.refs && r.refs.length && date && date <= today) {
      var on = isDone(date, r), tk = el('button', 'kjtb-lect__tick' + (on ? ' is-done' : ''), on ? '\u2713' : '');
      tk.type = 'button'; tk.setAttribute('aria-pressed', on ? 'true' : 'false'); tk.title = on ? L.marked : L.tick; tk.setAttribute('aria-label', tk.title);
      if (!on) tk.onclick = function () { markReading(date, r); render(box, d, date); };
      li.appendChild(tk); if (on) li.classList.add('is-done');
    }
    li.appendChild(el('span', 'kjtb-lect__src', source(r.source) + (r.desc ? ' (' + r.desc + ')' : '')));
    if (r.refs && r.refs.length) {
      var a = refLabel(r.refs, el('a', 'kjtb-lect__ref')); a.href = href(r.refs); a.__kjtbRefs = r.refs;
      a.addEventListener('click', function () { var rd = document.getElementById('kjtb-reader-card') || document.getElementById('kjtb-reader'); if (rd && a.getAttribute('href').charAt(0) === '#') setTimeout(function () { rd.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350); });
      li.appendChild(a);
      var go = el('a', 'kjtb-lect__go', L.read + (LANG === 'ar' ? ' \u2190' : ' \u2192')); go.href = a.href; go.setAttribute('aria-hidden', 'true'); go.tabIndex = -1;
      go.addEventListener('click', function () { a.click(); });
      li.appendChild(go);
    } else li.appendChild(el('span', 'kjtb-lect__ref', r.text || ''));
    return li;
  }

  /* ---------- where the card goes ---------- */
  function boxes() {
    var list = [].slice.call(document.querySelectorAll('[data-kjtb-lect]'));
    var card = document.getElementById('kjtb-reader-card');
    if (card && C.onBible && !document.querySelector('.kjtb-lect[data-kjtb-lect="bible"]')) {
      var b = el('section', 'kjtb-lect'); b.setAttribute('data-kjtb-lect', 'bible'); b.setAttribute('aria-label', L.title);
      if (!document.getElementById('todays-readings')) b.id = 'todays-readings'; /* "Today's Readings" in Today with God jumps here */
      /* 4.14.0: a tile beside Bible Study Journey that opens the readings full screen (panels.js) */
      var slot = document.getElementById('kjtb-lect-slot');
      if (slot) {
        var d = document.createElement('details'); d.className = 'kjtb-lect-panel'; d.id = 'kjtb-lect-panel';
        var s = el('summary', 'kjtb-tile kjtb-tile--lect'), ic = el('span', 'kjtb-tile__icon', '\uD83D\uDCD6'), tx = el('span', 'kjtb-tile__text');
        ic.setAttribute('aria-hidden', 'true'); tx.appendChild(el('strong', '', L.title)); tx.appendChild(el('small', 'kjtb-tile__line', L.loading));
        var go = el('span', 'kjtb-tile__go', LANG === 'ar' ? '\u2039' : '\u203A'); go.setAttribute('aria-hidden', 'true');
        s.appendChild(ic); s.appendChild(tx); s.appendChild(go); d.appendChild(s); d.appendChild(b); slot.appendChild(d);
        /* the tile names the day (and the feast) */
        var line = tx.querySelector('small');
        new MutationObserver(function () { var t = b.querySelector('.kjtb-lect__title'); if (t && t.textContent && line.textContent !== t.textContent) line.textContent = t.textContent; }).observe(b, { childList: true, subtree: true });
      } else card.parentNode.insertBefore(b, card);
      list.push(b);
    }
    return list;
  }
  /* ---------- 4.38.0: the Orthodox calendar: a month at a glance (feasts, fasts, saints); tap a day for its readings.
     A month is fetched at once and kept on this device, so the months already seen open without internet. ---------- */
  var CW = {
    en: { cal: 'Orthodox calendar', great: 'Great feast', feast: 'Feast', strict: 'Strict fast', oil: 'Wine and oil allowed', fish: 'Fish allowed', back: 'Readings of the day', none: 'This month is not on this device yet. Open it once with internet.' },
    fr: { cal: 'Calendrier orthodoxe', great: 'Grande fête', feast: 'Fête', strict: 'Jeûne strict', oil: 'Vin et huile permis', fish: 'Poisson permis', back: 'Lectures du jour', none: 'Ce mois n’est pas encore sur cet appareil. Ouvrez-le une fois avec internet.' },
    es: { cal: 'Calendario ortodoxo', great: 'Gran fiesta', feast: 'Fiesta', strict: 'Ayuno estricto', oil: 'Vino y aceite permitidos', fish: 'Pescado permitido', back: 'Lecturas del día', none: 'Este mes aún no está en este dispositivo. Ábralo una vez con internet.' },
    ar: { cal: 'التقويم الأرثوذكسي', great: 'عيد سيدي كبير', feast: 'عيد', strict: 'صوم انقطاعي', oil: 'يُسمح بالخمر والزيت', fish: 'يُسمح بالسمك', back: 'قراءات اليوم', none: 'هذا الشهر غير محفوظ على هذا الجهاز بعد. افتحه مرة مع الإنترنت.' },
    el: { cal: 'Ορθόδοξο ημερολόγιο', great: 'Μεγάλη εορτή', feast: 'Εορτή', strict: 'Αυστηρή νηστεία', oil: 'Επιτρέπεται οίνος και έλαιο', fish: 'Επιτρέπεται ψάρι', back: 'Αναγνώσματα της ημέρας', none: 'Αυτός ο μήνας δεν είναι ακόμα σε αυτή τη συσκευή. Ανοίξτε τον μία φορά με internet.' },
    ru: { cal: 'Православный календарь', great: 'Великий праздник', feast: 'Праздник', strict: 'Строгий пост', oil: 'Разрешены вино и елей', fish: 'Разрешена рыба', back: 'Чтения дня', none: 'Этого месяца ещё нет на устройстве. Откройте его один раз с интернетом.' },
    zh: { cal: '东正教日历', great: '大节日', feast: '节日', strict: '严斋', oil: '可用酒和油', fish: '可吃鱼', back: '当日经课', none: '此月尚未保存在此设备上。请联网打开一次。' },
    hi: { cal: 'ऑर्थोडॉक्स कैलेंडर', great: 'महान पर्व', feast: 'पर्व', strict: 'कठोर उपवास', oil: 'दाखरस और तेल की अनुमति', fish: 'मछली की अनुमति', back: 'दिन के पाठ', none: 'यह महीना अभी इस डिवाइस पर नहीं है। इसे एक बार इंटरनेट के साथ खोलें।' },
    tl: { cal: 'Kalendaryong Ortodokso', great: 'Dakilang kapistahan', feast: 'Kapistahan', strict: 'Mahigpit na pag-aayuno', oil: 'Pinapayagan ang alak at langis', fish: 'Pinapayagan ang isda', back: 'Mga pagbasa ng araw', none: 'Wala pa sa device na ito ang buwang ito. Buksan ito minsan nang may internet.' }
  };
  var CL = CW[LANG] || CW.en;
  function monthKey(ym) { return 'kjtb_lect_m_' + MODE + '_' + ym; }
  function pruneMonths() { try { var ks = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('kjtb_lect_m_') === 0) ks.push(k); } ks.sort(); while (ks.length > 6) localStorage.removeItem(ks.shift()); } catch (e) {} }
  function getMonth(ym) {
    var n = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), saved = null;
    try { saved = JSON.parse(localStorage.getItem(monthKey(ym))); } catch (e) {}
    var net = fetch(C.ajax + '?action=kjtb_lect&from=' + ym + '-01&days=' + n + '&mode=' + MODE, { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.success) throw new Error('bad'); try { localStorage.setItem(monthKey(ym), JSON.stringify(j.data.days)); pruneMonths(); } catch (e) {} return j.data.days; });
    var slow = new Promise(function (res, rej) { setTimeout(function () { rej(new Error('slow')); }, saved ? 2500 : 20000); });
    return Promise.race([net, slow]).catch(function () {
      if (saved) return saved;
      var st = store(), out = []; for (var i = 1; i <= n; i++) { var dt = ym + '-' + ('0' + i).slice(-2); if (st[dt]) out.push(st[dt]); }
      if (out.length) return out; throw new Error('none');
    });
  }
  function fastKind(d) { var f = d.fast || '', n = d.fast_note || ''; if (!f || f === 'No Fast' || /free/i.test(f)) return ''; if (/fish/i.test(n)) return 'fish'; if (/wine|oil/i.test(n)) return 'oil'; return 'strict'; }
  function monthShift(ym, k) { var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + k, 1, 12); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function calendar(box, ym, sel) {
    box.innerHTML = ''; box.setAttribute('aria-busy', 'true'); box.classList.add('is-cal');
    var h = el('div', 'kjtb-lect__head');
    var prev = el('button', 'kjtb-lect__nav', LANG === 'ar' ? '›' : '‹'); prev.type = 'button'; prev.onclick = function () { calendar(box, monthShift(ym, -1), sel); };
    var next = el('button', 'kjtb-lect__nav', LANG === 'ar' ? '‹' : '›'); next.type = 'button'; next.onclick = function () { calendar(box, monthShift(ym, 1), sel); };
    var mid = el('div', 'kjtb-lect__mid'); mid.appendChild(el('p', 'kjtb-lect__kicker', '📅 ' + CL.cal));
    mid.appendChild(el('p', 'kjtb-lect__date kjtb-cal__month', parse(ym + '-15').toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })));
    h.appendChild(prev); h.appendChild(mid); h.appendChild(next); box.appendChild(h);
    var back = el('button', 'kjtb-lect__today', '← ' + CL.back); back.type = 'button'; back.onclick = function () { box.classList.remove('is-cal'); draw(box, sel || today); }; box.appendChild(back);
    var wrap = el('div', 'kjtb-cal'); wrap.appendChild(el('p', 'kjtb-lect__loading', L.loading)); box.appendChild(wrap);
    getMonth(ym).then(function (days) {
      box.removeAttribute('aria-busy'); wrap.innerHTML = '';
      var grid = el('div', 'kjtb-cal__grid'); grid.setAttribute('role', 'grid');
      for (var w = 0; w < 7; w++) grid.appendChild(el('span', 'kjtb-cal__wd', new Date(2026, 0, 4 + w, 12).toLocaleDateString(LOCALE, { weekday: 'short' })));
      var lead = parse(ym + '-01').getDay(); for (var b = 0; b < lead; b++) grid.appendChild(el('span', 'kjtb-cal__pad'));
      var byDate = {}; days.forEach(function (d) { if (d && d.date) byDate[d.date] = d; });
      var n = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
      for (var i = 1; i <= n; i++) (function (dt) {
        var d = byDate[dt] || null, c = el('button', 'kjtb-cal__d'); c.type = 'button';
        var k = d ? fastKind(d) : ''; if (k) c.classList.add('is-' + k);
        if (d && d.level >= 7) c.classList.add('is-great'); else if (d && d.level >= 5) c.classList.add('is-feast');
        if (dt === today) c.classList.add('is-today'); if (dt === sel) c.classList.add('is-sel'); if (!d) c.disabled = true;
        c.appendChild(el('span', 'kjtb-cal__n', String(+dt.slice(8))));
        if (d && d.level >= 7) c.appendChild(el('span', 'kjtb-cal__m', '✠')); else if (d && d.level >= 5) c.appendChild(el('span', 'kjtb-cal__m', '★'));
        if (d) { var feasts = (d.feast || '').split('; ').filter(Boolean), t = feasts[0] || d.title || ''; c.title = dayName(t) + (d.saints ? ' · ' + d.saints : ''); c.setAttribute('aria-label', parse(dt).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) + (t ? ': ' + dayName(t) : '')); }
        c.onclick = function () { box.classList.remove('is-cal'); draw(box, dt); };
        grid.appendChild(c);
      })(ym + '-' + ('0' + i).slice(-2));
      wrap.appendChild(grid);
      var lg = el('p', 'kjtb-cal__legend');
      [['great', '✠', CL.great], ['feast', '★', CL.feast], ['strict', '', CL.strict], ['oil', '', CL.oil], ['fish', '', CL.fish]].forEach(function (x) { var sp = el('span', 'kjtb-cal__lg kjtb-cal__lg--' + x[0]); var dot = el('i', '', x[1]); sp.appendChild(dot); sp.appendChild(document.createTextNode(' ' + x[2])); lg.appendChild(sp); });
      wrap.appendChild(lg);
      wrap.appendChild(el('p', 'kjtb-cal__mode', MODES[MODE] || ''));
    }, function () { box.removeAttribute('aria-busy'); wrap.innerHTML = ''; wrap.appendChild(el('p', 'kjtb-lect__empty', CL.none)); });
  }
  /* 4.38.0: opened from the app's More list (or anywhere): the calendar in the readings window */
  window.KJTB_LECT_CAL = function (box) { box = box || document.querySelector('.kjtb-lect[data-kjtb-lect="bible"]') || document.querySelector('.kjtb-lect'); if (box) calendar(box, today.slice(0, 7), today); return !!box; };
  /* in the app: this month and the next are kept on the device, for the calendar without internet */
  if (document.documentElement.classList.contains('kjt-app')) setTimeout(function () { if (navigator.onLine) { var ym = today.slice(0, 7); getMonth(ym).catch(function () {}); getMonth(monthShift(ym, 1)).catch(function () {}); } }, 6000);
  /* ---------- the coming great feasts ---------- */
  function feastsKey() { return 'kjtb_feasts_' + MODE; }
  /* 4.8.2: an icon for each kind of day, explained in a legend under the list */
  var ICON = { lord: '\u271D\uFE0F', theotokos: '\u2B50', pascha: '\u2600\uFE0F', fast: '\uD83C\uDF3F' };
  var KIND = { nativity: 'lord', theophany: 'lord', meeting: 'lord', palm: 'lord', ascension: 'lord', pentecost: 'lord', transfiguration: 'lord', elevation: 'lord', annunciation: 'theotokos', dormition: 'theotokos', nativity_theotokos: 'theotokos', entry: 'theotokos', pascha: 'pascha', lent: 'fast' };
  function icon(kind) { var i = el('span', 'kjtb-feasts__ic kjtb-feasts__ic--' + kind, ICON[kind] || ''); i.setAttribute('aria-hidden', 'true'); return i; }
  function drawFeasts(box) {
    box.classList.add('kjtb-feasts'); if (LANG === 'ar') box.setAttribute('dir', 'rtl');
    var show = function (data) {
      var list = Array.isArray(data) ? data : (data.feasts || []), fasts = Array.isArray(data) ? [] : (data.fasts || []);
      box.innerHTML = '';
      box.appendChild(el('h3', 'kjtb-feasts__title', '\uD83D\uDCC5 ' + (fasts.length ? FEASTS.title2 : FEASTS.title)));
      var ul = el('ul', 'kjtb-feasts__list'), t0 = parse(today).getTime(), rows = [];
      var days = function (d) { return Math.round((parse(d).getTime() - t0) / 86400000); };
      var fmt = function (d) { return parse(d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }); };
      var hasLent = fasts.some(function (f) { return f.key === 'lent'; });
      list.filter(function (f) { return f.date >= today && !(hasLent && f.key === 'lent'); }).forEach(function (f) { rows.push({ at: f.date, feast: f }); });
      fasts.filter(function (f) { return f.end >= today; }).forEach(function (f) { rows.push({ at: f.start < today ? today : f.start, fast: f }); });
      rows.sort(function (a, b) { return a.at < b.at ? -1 : (a.at > b.at ? 1 : (a.fast ? -1 : 1)); });
      rows.forEach(function (r) {
        var li;
        if (r.feast) {
          var n = days(r.feast.date);
          li = el('li', 'kjtb-feasts__item' + (n === 0 ? ' is-today' : ''));
          li.appendChild(el('span', 'kjtb-feasts__date', fmt(r.feast.date)));
          var fn = el('span', 'kjtb-feasts__name'), kind = KIND[r.feast.key] || 'lord'; fn.appendChild(icon(kind)); fn.appendChild(document.createTextNode(FEASTS[r.feast.key] || r.feast.key)); li.classList.add('is-' + kind); li.appendChild(fn);
          li.appendChild(el('span', 'kjtb-feasts__when', n === 0 ? FEASTS.today : (n === 1 ? FEASTS.tomorrow : FEASTS.days.replace('{n}', n))));
          li.appendChild(calBtn(FEASTS[r.feast.key] || r.feast.key, '', r.feast.date, 1, true));
        } else {
          var f = r.fast, s0 = days(f.start), e0 = days(f.end), on = s0 <= 0;
          li = el('li', 'kjtb-feasts__item is-fast' + (on ? ' is-now' : ''));
          li.appendChild(el('span', 'kjtb-feasts__date', fmt(f.start)));
          var nm = el('span', 'kjtb-feasts__name'); nm.appendChild(icon('fast')); nm.appendChild(document.createTextNode(FEASTS['fast_' + f.key] || f.key));
          if (f.end !== f.start) { var rg = el('small', 'kjtb-feasts__range'); var b1 = document.createElement('bdi'); b1.textContent = fmt(f.start) + ' \u2013 ' + fmt(f.end); rg.appendChild(b1); nm.appendChild(rg); }
          li.appendChild(nm);
          li.appendChild(calBtn(FEASTS['fast_' + f.key] || f.key, '', f.start, days(f.end) - days(f.start) + 1, true));
          li.appendChild(el('span', 'kjtb-feasts__when', on ? (e0 === 0 ? FEASTS.endsToday : FEASTS.now + ' \u00b7 ' + FEASTS.ends.replace('{n}', e0)) : (s0 === 1 ? FEASTS.tomorrow : FEASTS.days.replace('{n}', s0))));
        }
        ul.appendChild(li);
      });
      box.appendChild(ul);
      var lg = el('ul', 'kjtb-feasts__legend'); lg.setAttribute('aria-label', 'Legend');
      ['lord', 'theotokos', 'pascha', 'fast'].forEach(function (k) { var li2 = el('li'); li2.appendChild(icon(k)); li2.appendChild(document.createTextNode(FEASTS['lg_' + k])); lg.appendChild(li2); });
      box.appendChild(lg);
      if (C.choice) box.appendChild(el('p', 'kjtb-feasts__cal', MODES[MODE]));
    };
    var cached = null; try { cached = JSON.parse(localStorage.getItem(feastsKey())); } catch (e) {}
    if (cached && (cached.length || cached.feasts)) show(cached); else box.appendChild(el('p', 'kjtb-lect__loading', L.loading));
    fetch(C.ajax + '?action=kjtb_feasts&from=' + today + '&n=14&mode=' + MODE, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.success) return; var data = { feasts: j.data.feasts, fasts: j.data.fasts || [] }; try { localStorage.setItem(feastsKey(), JSON.stringify(data)); } catch (e) {} show(data);
    }).catch(function () { if (!cached) { box.innerHTML = ''; box.appendChild(el('p', 'kjtb-lect__empty', L.offline)); } });
  }

  /* ---------- 4.27.0: "Today with God" greets the visitor ----------
     Every day by the time of day; on Sundays and in the Church's seasons and great feasts with the
     Church's own greeting (Christ is risen! in the forty days of Pascha, Christ is born! at the Nativity,
     Christ is baptized! at Theophany, the civil and the Church New Year...). Worked out on the visitor's
     device, for the calendar they follow (the Old calendar keeps the fixed feasts 13 days later). */
  var GW = {
    en: { m: 'Good morning!', a: 'Good afternoon!', e: 'Good evening!', bless: 'May God bless you and your day.', sunday: 'A blessed Lord’s Day!', pascha: 'Christ is risen! Truly He is risen!', nativity: 'Christ is born! Glorify Him!', theophany: 'Christ is baptized! In the Jordan!', newyear: 'Happy New Year! May God bless you with a holy and peaceful year.', churchny: 'A blessed Church New Year!', palm: 'A blessed Palm Sunday!', holyweek: 'A blessed Holy Week!', lent: 'A blessed Great Lent!', nfast: 'A blessed Nativity Fast!', feast: 'A blessed feast: {f}!' },
    fr: { m: 'Bonjour !', a: 'Bon après-midi !', e: 'Bonsoir !', bless: 'Que Dieu vous bénisse, vous et votre journée.', sunday: 'Bon dimanche, jour du Seigneur !', pascha: 'Le Christ est ressuscité ! En vérité il est ressuscité !', nativity: 'Le Christ est né ! Glorifions-le !', theophany: 'Le Christ est baptisé ! Dans le Jourdain !', newyear: 'Bonne année ! Que Dieu vous accorde une année sainte et paisible.', churchny: 'Bon Nouvel An de l’Église !', palm: 'Bon dimanche des Rameaux !', holyweek: 'Bonne et sainte Semaine sainte !', lent: 'Bon Grand Carême !', nfast: 'Bon jeûne de la Nativité !', feast: 'Bonne fête : {f} !' },
    es: { m: '¡Buenos días!', a: '¡Buenas tardes!', e: '¡Buenas noches!', bless: 'Que Dios le bendiga a usted y su día.', sunday: '¡Feliz domingo, día del Señor!', pascha: '¡Cristo ha resucitado! ¡En verdad ha resucitado!', nativity: '¡Cristo ha nacido! ¡Glorificadle!', theophany: '¡Cristo es bautizado! ¡En el Jordán!', newyear: '¡Feliz Año Nuevo! Que Dios le conceda un año santo y lleno de paz.', churchny: '¡Feliz Año Nuevo de la Iglesia!', palm: '¡Bendito Domingo de Ramos!', holyweek: '¡Bendita Semana Santa!', lent: '¡Bendita Gran Cuaresma!', nfast: '¡Bendito ayuno de la Natividad!', feast: '¡Feliz fiesta: {f}!' },
    ru: { m: 'Доброе утро!', a: 'Добрый день!', e: 'Добрый вечер!', bless: 'Храни вас Господь!', sunday: 'С воскресным днём!', pascha: 'Христос воскресе! Воистину воскресе!', nativity: 'Христос рождается! Славите!', theophany: 'Христос крестился! Во Иордане!', newyear: 'С Новым годом! Да благословит вас Господь мирным и святым годом.', churchny: 'С церковным новолетием!', palm: 'С Входом Господним в Иерусалим!', holyweek: 'Благословенной Страстной седмицы!', lent: 'Благословенного Великого поста!', nfast: 'Благословенного Рождественского поста!', feast: 'С праздником: {f}!' },
    el: { m: 'Καλημέρα!', a: 'Καλό απόγευμα!', e: 'Καλησπέρα!', bless: 'Ο Θεός να σας ευλογεί!', sunday: 'Καλή Κυριακή!', pascha: 'Χριστός ανέστη! Αληθώς ανέστη!', nativity: 'Χριστός γεννάται· δοξάσατε!', theophany: 'Χριστός βαπτίζεται! Εν τω Ιορδάνη!', newyear: 'Καλή χρονιά! Ο Θεός να σας χαρίσει μια ευλογημένη και ειρηνική χρονιά.', churchny: 'Καλό εκκλησιαστικό έτος!', palm: 'Καλή Κυριακή των Βαΐων!', holyweek: 'Καλή Μεγάλη Εβδομάδα!', lent: 'Καλή Σαρακοστή!', nfast: 'Καλή Σαρακοστή των Χριστουγέννων!', feast: 'Χρόνια πολλά! {f}' },
    ar: { m: 'صباح الخير!', a: 'نهارك سعيد!', e: 'مساء الخير!', bless: 'باركك الله وبارك يومك.', sunday: 'أحدٌ مبارك، يوم الرب!', pascha: 'المسيح قام! حقاً قام!', nativity: 'المسيح وُلد! فمجّدوه!', theophany: 'المسيح اعتمد! في نهر الأردن!', newyear: 'سنة جديدة سعيدة! باركك الله بسنةٍ مقدّسة مملوءة سلاماً.', churchny: 'رأس سنة كنسية مبارك!', palm: 'أحد شعانين مبارك!', holyweek: 'أسبوع آلام مبارك!', lent: 'صوم أربعيني مبارك!', nfast: 'صوم ميلادي مبارك!', feast: 'عيد مبارك: {f}!' },
    hi: { m: 'सुप्रभात!', a: 'नमस्कार!', e: 'शुभ संध्या!', bless: 'परमेश्वर आपको और आपके दिन को आशीष दे।', sunday: 'प्रभु का दिन मंगलमय हो!', pascha: 'मसीह जी उठा है! सचमुच वह जी उठा है!', nativity: 'मसीह का जन्म हुआ है! उसकी महिमा करो!', theophany: 'मसीह का बपतिस्मा हुआ! यरदन में!', newyear: 'नया वर्ष मंगलमय हो! परमेश्वर आपको पवित्र और शांतिपूर्ण वर्ष की आशीष दे।', churchny: 'कलीसिया का नया वर्ष मंगलमय हो!', palm: 'खजूर रविवार मंगलमय हो!', holyweek: 'पवित्र सप्ताह मंगलमय हो!', lent: 'महान उपवास मंगलमय हो!', nfast: 'जन्मपर्व का उपवास मंगलमय हो!', feast: 'पर्व मंगलमय हो: {f}!' },
    tl: { m: 'Magandang umaga!', a: 'Magandang hapon!', e: 'Magandang gabi!', bless: 'Pagpalain kayo ng Diyos at ang inyong araw.', sunday: 'Mapagpalang Araw ng Panginoon!', pascha: 'Si Kristo ay nabuhay! Tunay Siyang nabuhay!', nativity: 'Si Kristo ay isinilang! Luwalhatiin Siya!', theophany: 'Si Kristo ay bininyagan! Sa Ilog Jordan!', newyear: 'Manigong Bagong Taon! Pagpalain kayo ng Diyos ng isang banal at mapayapang taon.', churchny: 'Mapagpalang Bagong Taon ng Simbahan!', palm: 'Mapagpalang Linggo ng Palaspas!', holyweek: 'Mapagpalang Mahal na Araw!', lent: 'Mapagpalang Dakilang Kuwaresma!', nfast: 'Mapagpalang Ayuno ng Pasko!', feast: 'Mapagpalang kapistahan: {f}!' },
    zh: { m: '早上好！', a: '下午好！', e: '晚上好！', bless: '愿神赐福给您和您的这一天。', sunday: '主日蒙福！', pascha: '基督复活了！祂真的复活了！', nativity: '基督降生了！当荣耀祂！', theophany: '基督受洗了！在约旦河中！', newyear: '新年快乐！愿神赐您圣洁平安的一年。', churchny: '教会新年蒙福！', palm: '棕枝主日蒙福！', holyweek: '圣周蒙福！', lent: '大斋期蒙福！', nfast: '圣诞斋期蒙福！', feast: '节日蒙福：{f}！' }
  }[LANG];
  /* Orthodox Pascha (Julian reckoning), as a civil (Gregorian) date: valid 1900-2099 */
  function paschaOf(y) { var a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, m = Math.floor((d + e + 114) / 31), dd = (d + e + 114) % 31 + 1; var t = new Date(y, m - 1, dd, 12); t.setDate(t.getDate() + 13); return t; }
  function special(dt, mode) {
    var y = dt.getFullYear(), old = mode === 'old', md = function (m, d) { var t = new Date(y, m - 1, d, 12); if (old) t.setDate(t.getDate() + 13); return t; };
    var day = function (t) { return Math.round((new Date(y, dt.getMonth(), dt.getDate(), 12) - new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12)) / 86400000); };
    var P = day(paschaOf(y));          /* days since Pascha (negative: before) */
    if (P >= 0 && P <= 38) return ['☀️', GW.pascha, P === 0 ? 'pascha' : 'paschal'];   /* to the leave-taking of Pascha */
    /* the Nativity and its afterfeast (to 31 December; Old calendar 7-13 January) */
    var nat = day(md(12, 25)), natPrev = old ? day(new Date(y - 1, 11, 25 + 13, 12)) : 99;
    if ((nat >= 0 && nat <= 6) || (natPrev >= 0 && natPrev <= 6)) return ['⭐', GW.nativity, 'nativity'];
    if (day(md(1, 6)) === 0) return ['🕊️', GW.theophany, 'theophany'];
    if (dt.getMonth() === 0 && dt.getDate() === 1) return ['🎉', GW.newyear, 'newyear'];
    if (day(md(9, 1)) === 0) return ['🌾', GW.churchny, 'churchny'];
    if (P === -7) return ['🌿', GW.palm, 'palm'];
    if (P >= -6 && P <= -1) return ['✝️', GW.holyweek, 'holyweek'];
    var fixed = { annunciation: [3, 25], transfiguration: [8, 6], dormition: [8, 15], nativity_theotokos: [9, 8], elevation: [9, 14], entry: [11, 21], meeting: [2, 2] };
    for (var k in fixed) if (day(md(fixed[k][0], fixed[k][1])) === 0 && FEASTS[k]) return ['✠', GW.feast.replace('{f}', FEASTS[k]), 'feast'];
    if (P === 39 && FEASTS.ascension) return ['✠', GW.feast.replace('{f}', FEASTS.ascension), 'feast'];
    if (P === 49 && FEASTS.pentecost) return ['🔥', GW.feast.replace('{f}', FEASTS.pentecost), 'feast'];
    if (P >= -48 && P <= -9) return ['🌿', GW.lent, 'lent'];
    /* the Nativity Fast: 15 November - 24 December (Old calendar 28 November - 6 January) */
    var nf = day(md(11, 15)), nfPrev = old ? day(new Date(y - 1, 10, 15 + 13, 12)) : 99;
    if ((nf >= 0 && nf <= 39) || (nfPrev >= 0 && nfPrev <= 39)) return ['🌿', GW.nfast, 'nfast'];
    if (dt.getDay() === 0) return ['☀️', GW.sunday, 'sunday'];
    return null;
  }
  function greet() {
    var heads = document.querySelectorAll('.kjt-today__head'); if (!heads.length || !GW) return;
    var now = new Date(), h = now.getHours(), sp = special(now, MODE);
    [].forEach.call(heads, function (hd) {
      var g = hd.querySelector('.kjt-today__greet'); if (!g) { g = el('div', 'kjt-today__greet'); g.setAttribute('data-kjt-notr', ''); var dt = hd.querySelector('.kjt-today__date'); if (dt) dt.after(g); else hd.appendChild(g); }
      if (LANG === 'ar') g.setAttribute('dir', 'rtl');
      g.innerHTML = '';
      g.appendChild(el('p', 'kjt-today__hello', (h >= 5 && h < 12 ? GW.m : h >= 12 && h < 18 ? GW.a : GW.e) + ' ' + GW.bless));
      hd.classList.toggle('is-festive', !!sp && sp[2] !== 'sunday' && sp[2] !== 'lent' && sp[2] !== 'nfast');
      if (sp) { var f = el('p', 'kjt-today__feastday kjt-today__feastday--' + sp[2]); var i = el('span', 'kjt-today__feastic', sp[0]); i.setAttribute('aria-hidden', 'true'); f.appendChild(i); f.appendChild(document.createTextNode(' ' + sp[1])); g.appendChild(f); }
    });
  }
  window.KJTB_GREET = { special: special, pascha: paschaOf };
  /* the "Today with God" bubble under the hero names today's great feast */
  function chip(feast) {
    document.querySelectorAll('.kjt-today-chip__sub').forEach(function (s) {
      if (!s.getAttribute('data-default')) s.setAttribute('data-default', s.textContent);
      s.textContent = feast ? '\u2720 ' + feast : s.getAttribute('data-default');
    });
  }

  function start() {
    syncJourney();
    try { greet(); } catch (e) {}
    var bx = boxes(), fx = document.querySelectorAll('[data-kjtb-feasts]'), hasChip = !!document.querySelector('.kjt-today-chip__sub');
    if (!bx.length && !fx.length && !hasChip) return; /* nothing on this page needs the readings */
    [].forEach.call(fx, drawFeasts);
    if (!bx.length && hasChip) getDay(today).then(function (d) { var f = (d.feast || '').split('; ').filter(function (x) { return GREAT.indexOf(x) >= 0; })[0]; if (d.level >= 7 && f) chip(dayName(f)); }).catch(function () {});
    bx.forEach(function (b) { if (!b.classList.contains('kjtb-lect')) b.classList.add('kjtb-lect'); if (LANG === 'ar') b.setAttribute('dir', 'rtl'); draw(b, today); });
    /* fetch the coming week once, for reading without internet */
    if (bx.length) { var s = store(); if (!s[shift(today, 6)]) fetchDays(today, 14).catch(function () {}); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* 4.13.0: when the site's language words arrive after the readings were drawn, name the references again */
  if (LANG !== 'en' && window.KJT_LANG && window.KJT_LANG.on) window.KJT_LANG.on(function () {
    [].forEach.call(document.querySelectorAll('.kjtb-lect__ref'), function (a) { if (a.__kjtbRefs) { a.textContent = ''; refLabel(a.__kjtbRefs, a); } });
  });
})();
