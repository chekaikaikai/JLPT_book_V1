(() => {
  'use strict';

  /* ------------------------------------------------------------------
   * 常數
   * ------------------------------------------------------------------ */
  const DATA_URL = 'data/words.json'; // 相對路徑：GitHub Pages 子路徑可用
  const KEYS = {
    progress: 'kotobaka:v1:progress',
    today: 'kotobaka:v1:today',
    filters: 'kotobaka:v1:filters',
    settings: 'kotobaka:v1:settings'
  };
  const MISSING = '待核對';
  const LEVELS = ['N5', 'N4'];
  const CATEGORIES = ['kanji', 'hiragana', 'katakana'];
  const CATEGORY_LABEL = { kanji: '漢字', hiragana: '平假名（含漢字）', katakana: '片假名' };
  const DEFAULT_FILTERS = { level: 'all', category: 'all', range: 'all', shuffle: false };
  const DEFAULT_SETTINGS = { furigana: true };
  const RATINGS = ['unfamiliar', 'normal', 'familiar'];
  const RUBY_RE = /\{([^|}]+)\|([^}]+)\}/g; // {漢字|かんじ}

  /* ------------------------------------------------------------------
   * LocalStorage（不可用時退回記憶體，頁面仍可使用）
   * ------------------------------------------------------------------ */
  const storage = {
    available: (() => {
      try {
        const k = '__kotobaka_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    read(key, fallback) {
      if (!this.available) return fallback;
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      if (!this.available) return false;
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  /* ------------------------------------------------------------------
   * 狀態
   * ------------------------------------------------------------------ */
  const state = {
    words: [],
    skipped: 0,
    meta: null,
    deck: [],
    index: 0,
    flipped: false,
    filters: Object.assign({}, DEFAULT_FILTERS, readFilters()),
    settings: Object.assign({}, DEFAULT_SETTINGS, readSettings()),
    progress: readProgress(),
    today: readToday()
  };

  function readFilters() {
    const saved = storage.read(KEYS.filters, {});
    const out = {};
    if (saved && typeof saved === 'object') {
      if (saved.level === 'all' || LEVELS.includes(saved.level)) out.level = saved.level;
      if (saved.category === 'all' || CATEGORIES.includes(saved.category)) out.category = saved.category;
      if (['all', 'notfamiliar', 'favorites'].includes(saved.range)) out.range = saved.range;
      if (typeof saved.shuffle === 'boolean') out.shuffle = saved.shuffle;
    }
    return out;
  }

  function readSettings() {
    const saved = storage.read(KEYS.settings, {});
    return saved && typeof saved.furigana === 'boolean' ? { furigana: saved.furigana } : {};
  }

  function readProgress() {
    const saved = storage.read(KEYS.progress, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function localDateKey() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function readToday() {
    const saved = storage.read(KEYS.today, null);
    const key = localDateKey();
    if (saved && saved.date === key && Array.isArray(saved.ids)) return saved;
    return { date: key, ids: [] };
  }

  /* ------------------------------------------------------------------
   * DOM
   * ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const el = {
    demoBadge: $('demoBadge'),
    statToday: $('statToday'), statTotal: $('statTotal'), statKnown: $('statKnown'), statFav: $('statFav'),
    fLevel: $('fLevel'), fCategory: $('fCategory'), fRange: $('fRange'), fShuffle: $('fShuffle'),
    btnReshuffle: $('btnReshuffle'),
    notice: $('notice'), study: $('study'), progressText: $('progressText'),
    card: $('card'), faceFront: $('faceFront'), faceBack: $('faceBack'),
    frontTag: $('frontTag'), frontWord: $('frontWord'),
    backTag: $('backTag'), backWord: $('backWord'), backReading: $('backReading'), backRomaji: $('backRomaji'),
    backMeaning: $('backMeaning'), backMeaningEn: $('backMeaningEn'),
    backExample: $('backExample'), backExampleZh: $('backExampleZh'),
    notesLabel: $('notesLabel'), backNotes: $('backNotes'), backSource: $('backSource'),
    btnFlipBack: $('btnFlipBack'), btnSpeakReading: $('btnSpeakReading'), btnSpeakExample: $('btnSpeakExample'),
    btnFurigana: $('btnFurigana'),
    backOn: $('backOn'), backKun: $('backKun'), backRelated: $('backRelated'),
    kanjiRows: Array.from(document.querySelectorAll('.row-kanji')),
    wordRows: Array.from(document.querySelectorAll('.row-word')),
    btnPrev: $('btnPrev'), btnNext: $('btnNext'), btnFav: $('btnFav'),
    rateBtns: Array.from(document.querySelectorAll('.rate-btn')),
    btnExport: $('btnExport'), btnImport: $('btnImport'), fileImport: $('fileImport'),
    tabs: Array.from(document.querySelectorAll('.tab')),
    views: Array.from(document.querySelectorAll('.view')),
    tabTitle: $('tabTitle'), btnGoCard: $('btnGoCard'), deckCount: $('deckCount'),
    deckSummary: $('deckSummary'), storageState: $('storageState'), warnings: $('warnings'),
    rLevel: $('rLevel'), recordsBody: $('recordsBody'),
    footerNote: $('footerNote'), toast: $('toast')
  };

  let toastTimer = null;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2800);
  }

  /* ------------------------------------------------------------------
   * 資料載入與驗證
   * ------------------------------------------------------------------ */
  function textOrNull(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t === '' ? null : t;
  }

  function stringList(v) {
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : [];
  }

  function normalizeRelated(v) {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === 'object' && textOrNull(x.word))
      .map((x) => ({
        word: textOrNull(x.word),
        reading: textOrNull(x.reading),
        meaning: textOrNull(x.meaning),
        meaningEn: textOrNull(x.meaningEn),
        level: textOrNull(x.level)
      }));
  }

  // id、word、level、category 無效或 id 重複的項目會被略過；
  // 其他欄位缺漏時保留 null，畫面上顯示「待核對」。
  function normalizeWords(rawList) {
    const seen = new Set();
    const words = [];
    let skipped = 0;
    rawList.forEach((raw) => {
      if (!raw || typeof raw !== 'object') { skipped++; return; }
      const id = textOrNull(raw.id);
      const word = textOrNull(raw.word);
      if (!id || !word || seen.has(id) || !LEVELS.includes(raw.level) || !CATEGORIES.includes(raw.category)) {
        skipped++;
        return;
      }
      seen.add(id);
      words.push({
        id,
        level: raw.level,
        category: raw.category,
        word,
        reading: textOrNull(raw.reading),
        romaji: textOrNull(raw.romaji),
        meaning: textOrNull(raw.meaning),
        meaningEn: textOrNull(raw.meaningEn),
        partOfSpeech: textOrNull(raw.partOfSpeech),
        example: textOrNull(raw.example),
        exampleRuby: textOrNull(raw.exampleRuby),
        exampleMeaning: textOrNull(raw.exampleMeaning),
        exampleMeaningEn: textOrNull(raw.exampleMeaningEn),
        strokes: Number.isFinite(raw.strokes) ? raw.strokes : null,
        onyomi: stringList(raw.onyomi),
        kunyomi: stringList(raw.kunyomi),
        relatedWords: normalizeRelated(raw.relatedWords),
        source: textOrNull(raw.source),
        notes: textOrNull(raw.notes)
      });
    });
    return { words, skipped };
  }

  async function loadData() {
    showNotice({ title: '載入單字中…', body: '', hideStudy: true });
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : json && Array.isArray(json.words) ? json.words : null;
      if (!list) throw new Error('JSON 格式不符：找不到單字陣列（words）');
      const { words, skipped } = normalizeWords(list);
      if (words.length === 0) throw new Error('沒有任何可用的單字資料');
      state.words = words;
      state.skipped = skipped;
      state.meta = Array.isArray(json) ? null : json.meta || null;
      clearNotice();
      init();
    } catch (err) {
      console.error('[單字卡] 載入單字失敗：', err);
      showNotice({
        title: '無法載入單字資料',
        body: `${err.message}。請確認網路連線；若是直接以 file:// 開啟，瀏覽器會阻擋 fetch，請改用本機伺服器預覽（見 README）。`,
        error: true,
        hideStudy: true,
        actions: [{ label: '重新載入', onClick: loadData }]
      });
    }
  }

  /* ------------------------------------------------------------------
   * 提示訊息
   * ------------------------------------------------------------------ */
  function showNotice({ title, body, error = false, hideStudy = false, actions = [] }) {
    el.notice.hidden = false;
    el.notice.className = 'notice' + (error ? ' error' : '');
    el.notice.textContent = '';
    const h = document.createElement('h2');
    h.textContent = title;
    el.notice.appendChild(h);
    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      el.notice.appendChild(p);
    }
    if (actions.length) {
      const wrap = document.createElement('div');
      wrap.className = 'actions';
      actions.forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        wrap.appendChild(b);
      });
      el.notice.appendChild(wrap);
    }
    if (hideStudy) el.study.hidden = true;
  }

  function clearNotice() {
    el.notice.hidden = true;
    el.notice.textContent = '';
  }

  /* ------------------------------------------------------------------
   * 儲存
   * ------------------------------------------------------------------ */
  function saveProgress() { storage.write(KEYS.progress, state.progress); }
  function saveToday() { storage.write(KEYS.today, state.today); }
  function saveFilters() { storage.write(KEYS.filters, state.filters); }
  function saveSettings() { storage.write(KEYS.settings, state.settings); }

  function getEntry(id) { return state.progress[id] || null; }

  function touchEntry(id) {
    const entry = state.progress[id] || { level: null, fav: false, updatedAt: null };
    entry.updatedAt = new Date().toISOString();
    state.progress[id] = entry;
    return entry;
  }

  function markPracticed(id) {
    const key = localDateKey();
    if (state.today.date !== key) state.today = { date: key, ids: [] };
    if (!state.today.ids.includes(id)) {
      state.today.ids.push(id);
      saveToday();
    }
  }

  /* ------------------------------------------------------------------
   * 發音（Web Speech API，ja-JP；需由使用者點擊才會發聲）
   * ------------------------------------------------------------------ */
  const TTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let jaVoice = null;

  function pickVoice() {
    if (!TTS) return;
    const voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang.replace('_', '-')));
    jaVoice = voices.find((v) => /Kyoko|O-Ren|Google|Enhanced|Premium/i.test(v.name)) || voices[0] || null;
  }

  function speak(text) {
    if (!TTS || !text) return;
    if (!jaVoice) pickVoice();
    if (speechSynthesis.getVoices().length && !jaVoice) {
      toast('找不到日文語音，請到裝置設定安裝日文語音');
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.85;
    const go = () => speechSynthesis.speak(u);
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      setTimeout(go, 60);
    } else {
      go();
    }
  }

  // 例句有假名標註時，漢字改用假名朗讀，避免語音引擎讀錯
  function exampleSpeechText(w) {
    if (w.exampleRuby) return w.exampleRuby.replace(RUBY_RE, '$2');
    return w.example;
  }

  if (TTS) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  /* ------------------------------------------------------------------
   * 牌組
   * ------------------------------------------------------------------ */
  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDeck() {
    const f = state.filters;
    let list = state.words.filter((w) =>
      (f.level === 'all' || w.level === f.level) &&
      (f.category === 'all' || w.category === f.category)
    );
    if (f.range === 'favorites') {
      list = list.filter((w) => (getEntry(w.id) || {}).fav === true);
    } else if (f.range === 'notfamiliar') {
      list = list.filter((w) => (getEntry(w.id) || {}).level !== 'familiar');
    }
    if (f.shuffle) shuffleInPlace(list);
    state.deck = list;
    state.index = 0;
    state.flipped = false;
    render();
  }

  function currentWord() { return state.deck[state.index] || null; }

  /* ------------------------------------------------------------------
   * 繪製
   * ------------------------------------------------------------------ */
  function valueOrMissing(node, value) {
    node.textContent = value == null ? MISSING : value;
    node.classList.toggle('missing', value == null);
  }

  // 以 DOM API 組出 <ruby>，不使用 innerHTML
  function renderExample(node, w) {
    node.textContent = '';
    if (w.example == null) {
      node.textContent = MISSING;
      node.classList.add('missing');
      return;
    }
    node.classList.remove('missing');
    if (!w.exampleRuby) {
      node.textContent = w.example;
      return;
    }
    const src = w.exampleRuby;
    const re = new RegExp(RUBY_RE.source, 'g');
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) node.append(src.slice(last, m.index));
      const ruby = document.createElement('ruby');
      ruby.append(m[1]);
      const rt = document.createElement('rt');
      rt.textContent = m[2];
      ruby.append(rt);
      node.append(ruby);
      last = re.lastIndex;
    }
    if (last < src.length) node.append(src.slice(last));
  }

  function renderExampleMeaning(node, w) {
    if (w.exampleMeaning != null) {
      node.textContent = w.exampleMeaning;
      node.classList.remove('missing');
    } else if (w.exampleMeaningEn != null) {
      node.textContent = `${w.exampleMeaningEn}（英文）`;
      node.classList.remove('missing');
    } else {
      node.textContent = w.example == null ? '' : MISSING;
      node.classList.toggle('missing', w.example != null);
    }
  }

  function renderReadingList(node, list) {
    if (list.length === 0) {
      node.textContent = '無';
      node.classList.remove('missing');
    } else {
      node.textContent = list.join('、');
      node.classList.remove('missing');
    }
  }

  function renderRelated(list) {
    el.backRelated.textContent = '';
    if (list.length === 0) {
      const li = document.createElement('li');
      li.textContent = MISSING;
      li.className = 'missing';
      el.backRelated.appendChild(li);
      return;
    }
    list.forEach((r) => {
      const li = document.createElement('li');
      const info = document.createElement('span');
      info.className = 'info';
      const word = document.createElement('span');
      word.className = 'rw';
      word.lang = 'ja';
      word.textContent = r.word;
      info.appendChild(word);
      if (r.reading) {
        const rr = document.createElement('span');
        rr.className = 'rr';
        rr.lang = 'ja';
        rr.textContent = `　${r.reading}`;
        info.appendChild(rr);
      }
      const gloss = r.meaning != null ? r.meaning : r.meaningEn;
      if (gloss != null) {
        const rm = document.createElement('span');
        rm.className = 'rm';
        rm.textContent = `　${gloss}${r.meaning == null ? '（英）' : ''}`;
        info.appendChild(rm);
      }
      if (r.level) {
        const rl = document.createElement('span');
        rl.className = 'rl';
        rl.textContent = r.level;
        info.append(' ', rl);
      }
      li.appendChild(info);
      if (TTS && r.reading) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'speak';
        b.textContent = '🔊';
        b.setAttribute('aria-label', `朗讀 ${r.word}`);
        b.addEventListener('click', () => speak(r.reading));
        li.appendChild(b);
      }
      el.backRelated.appendChild(li);
    });
  }

  function renderRecords() {
    const level = el.rLevel.value;
    const tally = {};
    CATEGORIES.concat('all').forEach((c) => { tally[c] = { familiar: 0, normal: 0, unfamiliar: 0, none: 0 }; });
    state.words.forEach((w) => {
      if (level !== 'all' && w.level !== level) return;
      const e = state.progress[w.id];
      const key = e && RATINGS.includes(e.level) ? e.level : 'none';
      tally[w.category][key]++;
      tally.all[key]++;
    });
    el.recordsBody.textContent = '';
    CATEGORIES.concat('all').forEach((c) => {
      const t = tally[c];
      const tr = document.createElement('tr');
      if (c === 'all') tr.className = 'sum';
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = c === 'all' ? '合計' : CATEGORY_LABEL[c];
      tr.appendChild(th);
      ['familiar', 'normal', 'unfamiliar', 'none'].forEach((k) => {
        const td = document.createElement('td');
        td.textContent = String(t[k]);
        tr.appendChild(td);
      });
      el.recordsBody.appendChild(tr);
    });
  }

  function renderStats() {
    renderRecords();
    const ids = new Set(state.words.map((w) => w.id));
    let known = 0;
    let fav = 0;
    Object.keys(state.progress).forEach((id) => {
      if (!ids.has(id)) return;
      const e = state.progress[id];
      if (e && e.level === 'familiar') known++;
      if (e && e.fav === true) fav++;
    });
    el.statToday.textContent = String(state.today.ids.length);
    el.statTotal.textContent = String(state.words.length);
    el.statKnown.textContent = String(known);
    el.statFav.textContent = String(fav);
  }

  function emptyDeckMessage() {
    const f = state.filters;
    if (f.range === 'favorites') {
      return { title: '還沒有符合條件的收藏單字', body: '先到「篩選」把範圍切回「全部」，在卡片上按「☆ 收藏」，之後就能只練習收藏。' };
    }
    if (f.range === 'notfamiliar') {
      return { title: '這個條件下的單字都已熟悉', body: '可以到「篩選」把範圍改成「全部」複習，或換一個程度與分類。' };
    }
    return { title: '沒有符合條件的單字', body: '目前的程度與分類組合沒有資料，請換一個篩選條件。' };
  }

  function render() {
    renderStats();
    updateDeckInfo();
    el.btnReshuffle.disabled = !state.filters.shuffle || state.deck.length < 2;

    const word = currentWord();
    if (!word) {
      el.study.hidden = true;
      const msg = emptyDeckMessage();
      showNotice({
        title: msg.title,
        body: msg.body,
        actions: [
          { label: '前往篩選', onClick: () => showTab('filters') },
          { label: '重設篩選', onClick: resetFilters }
        ]
      });
      return;
    }
    clearNotice();
    el.study.hidden = false;
    renderCard(word);
  }

  function renderCard(w) {
    const entry = getEntry(w.id) || {};
    const total = state.deck.length;
    el.progressText.textContent = `第 ${state.index + 1} / ${total} 張`;

    // 正面：只顯示日文單字（與程度、分類標籤）
    const tagText = `${w.level}・${CATEGORY_LABEL[w.category]}`;
    el.frontTag.textContent = tagText;
    el.frontWord.textContent = w.word;

    // 背面
    const isKanji = w.category === 'kanji';
    el.kanjiRows.forEach((n) => { n.hidden = !isKanji; });
    el.wordRows.forEach((n) => { n.hidden = isKanji; });
    el.backTag.textContent = tagText;
    el.backWord.hidden = isKanji;
    el.btnSpeakReading.hidden = isKanji || !TTS;
    el.backReading.classList.toggle('kanji-big', isKanji);
    valueOrMissing(el.backMeaning, w.meaning);

    if (isKanji) {
      el.backReading.textContent = w.word;
      el.backReading.classList.remove('missing');
      renderReadingList(el.backOn, w.onyomi);
      renderReadingList(el.backKun, w.kunyomi);
      el.backRomaji.textContent = w.strokes == null ? `筆畫${MISSING}` : `${w.strokes} 畫`;
      renderRelated(w.relatedWords);
    } else {
      el.backWord.textContent = w.word;
      valueOrMissing(el.backReading, w.reading);
      el.backRomaji.textContent = w.romaji || '';
      // 英文釋義與詞性併成一行，節省小螢幕的空間
      el.backMeaningEn.textContent = `${w.meaningEn == null ? '英文待核對' : w.meaningEn}・${w.partOfSpeech == null ? '詞性待核對' : w.partOfSpeech}`;
      el.backMeaningEn.classList.toggle('missing', w.meaningEn == null || w.partOfSpeech == null);
      renderExample(el.backExample, w);
      renderExampleMeaning(el.backExampleZh, w);

      el.btnSpeakReading.disabled = !w.reading;
      el.btnSpeakExample.disabled = !w.example;
      el.btnSpeakExample.hidden = !TTS;
      el.btnFurigana.disabled = !w.exampleRuby;

      // 外語來源：片假名固定顯示（未核對時顯示「待核對」）；其他類有補充時才顯示
      const showNotes = w.category === 'katakana' || w.notes != null;
      el.notesLabel.hidden = !showNotes;
      el.backNotes.hidden = !showNotes;
      el.notesLabel.textContent = w.category === 'katakana' ? '外語來源' : '補充';
      valueOrMissing(el.backNotes, w.notes);
    }

    el.backSource.textContent = `資料來源：${w.source == null ? MISSING : w.source}`;

    applyFurigana();
    setFlipped(state.flipped, false);

    el.rateBtns.forEach((b) => b.setAttribute('aria-pressed', String(entry.level === b.dataset.level)));
    const fav = entry.fav === true;
    el.btnFav.setAttribute('aria-pressed', String(fav));
    el.btnFav.textContent = fav ? '★ 已收藏' : '☆ 收藏';

    el.btnPrev.disabled = total < 2;
    el.btnNext.disabled = total < 2;
  }

  function applyFurigana() {
    const on = state.settings.furigana;
    el.card.classList.toggle('nofu', !on);
    el.btnFurigana.setAttribute('aria-pressed', String(on));
    el.btnFurigana.textContent = on ? '假名：顯示' : '假名：隱藏';
  }

  function setFlipped(flipped, moveFocus) {
    state.flipped = flipped;
    el.card.classList.toggle('is-flipped', flipped);
    el.faceFront.inert = flipped;
    el.faceBack.inert = !flipped;
    el.faceFront.setAttribute('aria-hidden', String(flipped));
    el.faceBack.setAttribute('aria-hidden', String(!flipped));
    if (moveFocus) {
      (flipped ? el.btnFlipBack : el.faceFront).focus({ preventScroll: true });
    }
  }

  /* ------------------------------------------------------------------
   * 操作
   * ------------------------------------------------------------------ */
  function flip() {
    const w = currentWord();
    if (!w) return;
    setFlipped(!state.flipped, true);
    if (state.flipped) {
      markPracticed(w.id);
      renderStats();
    }
  }

  function move(step) {
    const n = state.deck.length;
    if (n < 2) return;
    state.index = (state.index + step + n) % n;
    state.flipped = false;
    if (TTS) speechSynthesis.cancel();
    render();
  }

  function rate(level) {
    const w = currentWord();
    if (!w || !RATINGS.includes(level)) return;
    const entry = touchEntry(w.id);
    entry.level = entry.level === level ? null : level; // 再按一次可取消
    saveProgress();
    markPracticed(w.id);
    renderStats();
    renderCard(w);
  }

  function toggleFavorite() {
    const w = currentWord();
    if (!w) return;
    const entry = touchEntry(w.id);
    entry.fav = !entry.fav;
    saveProgress();
    renderStats();
    renderCard(w);
  }

  function resetFilters() {
    state.filters = Object.assign({}, DEFAULT_FILTERS);
    syncFilterControls();
    saveFilters();
    buildDeck();
  }

  function syncFilterControls() {
    el.fLevel.value = state.filters.level;
    el.fCategory.value = state.filters.category;
    el.fRange.value = state.filters.range;
    el.fShuffle.checked = state.filters.shuffle;
  }

  const LEVEL_SUMMARY = { all: '全部程度', N5: 'N5', N4: 'N4' };
  const RANGE_SUMMARY = { all: '', notfamiliar: '尚未熟悉', favorites: '收藏' };
  function filterSummaryText() {
    const f = state.filters;
    const parts = [LEVEL_SUMMARY[f.level], f.category === 'all' ? '全部分類' : CATEGORY_LABEL[f.category]];
    if (RANGE_SUMMARY[f.range]) parts.push(RANGE_SUMMARY[f.range]);
    if (f.shuffle) parts.push('隨機');
    return parts.join('・');
  }

  function updateDeckInfo() {
    el.deckCount.textContent = `符合條件：${state.deck.length} 張`;
    el.deckSummary.textContent = `${filterSummaryText()}（${state.deck.length} 張）`;
  }

  function onFilterChange() {
    state.filters = {
      level: el.fLevel.value,
      category: el.fCategory.value,
      range: el.fRange.value,
      shuffle: el.fShuffle.checked
    };
    saveFilters();
    buildDeck();
  }

  /* ------------------------------------------------------------------
   * 備份：匯出／匯入（合併，同一單字以較新的更新時間為準）
   * ------------------------------------------------------------------ */
  function exportProgress() {
    const payload = {
      app: 'kotobaka',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: state.progress,
      settings: state.settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kotobaka-backup-${localDateKey().replace(/-/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已匯出學習紀錄');
  }

  function validEntry(e) {
    return e && typeof e === 'object' &&
      (e.level === null || RATINGS.includes(e.level)) &&
      typeof e.fav === 'boolean' &&
      (e.updatedAt === null || typeof e.updatedAt === 'string');
  }

  async function importProgress(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'kotobaka' || !data.progress || typeof data.progress !== 'object') {
        throw new Error('不是單字卡的備份檔');
      }
      let merged = 0;
      Object.keys(data.progress).forEach((id) => {
        const incoming = data.progress[id];
        if (!validEntry(incoming)) return;
        const current = state.progress[id];
        const newer = !current || (incoming.updatedAt || '') > (current.updatedAt || '');
        if (newer) { state.progress[id] = incoming; merged++; }
      });
      saveProgress();
      buildDeck();
      toast(`已匯入 ${merged} 筆紀錄`);
    } catch (err) {
      console.error('[單字卡] 匯入失敗：', err);
      toast(`匯入失敗：${err.message}`);
    } finally {
      el.fileImport.value = '';
    }
  }

  /* ------------------------------------------------------------------
   * 分頁
   * ------------------------------------------------------------------ */
  const TAB_TITLES = { card: '字卡', filters: '篩選', records: '進度記錄', status: '狀態' };
  let currentTab = 'card';

  function showTab(name) {
    if (!TAB_TITLES[name]) return;
    currentTab = name;
    el.views.forEach((v) => { v.hidden = v.id !== `view-${name}`; });
    el.tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    el.tabTitle.textContent = TAB_TITLES[name];
    if (name !== 'card' && TTS) speechSynthesis.cancel();
    if (name === 'records') renderRecords();
  }

  /* ------------------------------------------------------------------
   * 初始化
   * ------------------------------------------------------------------ */
  function init() {
    const meta = state.meta || {};
    el.demoBadge.hidden = meta.isDemo !== true;
    el.footerNote.textContent = buildFooterNote(meta);

    el.storageState.textContent = storage.available ? '儲存在這個瀏覽器（可用）' : '無法儲存（LocalStorage 不可用）';
    syncFilterControls();
    buildDeck();

    if (state.skipped > 0) {
      appendWarning(`有 ${state.skipped} 筆資料因必要欄位缺漏或重複而被略過。`);
    }
    if (!storage.available) {
      appendWarning('此瀏覽器無法使用 LocalStorage（可能為無痕模式），學習紀錄不會被保存。');
    }
  }

  function buildFooterNote(meta) {
    const parts = [];
    if (meta.isDemo === true) parts.push('目前為示範資料，不代表完整的 N5／N4 考試範圍。');
    parts.push('JLPT 並無官方固定詞彙表，級別標示僅供參考。');
    if (meta.license) parts.push(`資料授權：${meta.license}`);
    return parts.join(' ');
  }

  function appendWarning(text) {
    const p = document.createElement('p');
    p.className = 'inline-warning';
    p.textContent = text;
    el.warnings.appendChild(p);
  }

  function bindEvents() {
    [el.fLevel, el.fCategory, el.fRange, el.fShuffle].forEach((c) => c.addEventListener('change', onFilterChange));
    el.btnReshuffle.addEventListener('click', buildDeck);
    el.btnGoCard.addEventListener('click', () => showTab('card'));
    el.rLevel.addEventListener('change', renderRecords);
    el.tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

    // 點卡片空白處翻面（按鈕除外）
    el.card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      flip();
    });
    el.faceFront.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
    el.btnFlipBack.addEventListener('click', flip);

    el.btnSpeakReading.addEventListener('click', () => {
      const w = currentWord();
      if (w) speak(w.reading);
    });
    el.btnSpeakExample.addEventListener('click', () => {
      const w = currentWord();
      if (w) speak(exampleSpeechText(w));
    });
    el.btnFurigana.addEventListener('click', () => {
      state.settings.furigana = !state.settings.furigana;
      saveSettings();
      applyFurigana();
    });

    el.btnPrev.addEventListener('click', () => move(-1));
    el.btnNext.addEventListener('click', () => move(1));
    el.btnFav.addEventListener('click', toggleFavorite);
    el.rateBtns.forEach((b) => b.addEventListener('click', () => rate(b.dataset.level)));

    el.btnExport.addEventListener('click', exportProgress);
    el.btnImport.addEventListener('click', () => el.fileImport.click());
    el.fileImport.addEventListener('change', () => {
      const f = el.fileImport.files && el.fileImport.files[0];
      if (f) importProgress(f);
    });

    document.addEventListener('keydown', (e) => {
      if (currentTab !== 'card' || el.study.hidden) return;
      const tag = (e.target && e.target.tagName) || '';
      if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(tag)) {
        if (e.key === 'ArrowLeft' && tag === 'BUTTON') { e.preventDefault(); move(-1); }
        else if (e.key === 'ArrowRight' && tag === 'BUTTON') { e.preventDefault(); move(1); }
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (e.key === ' ' && e.target !== el.faceFront) { e.preventDefault(); flip(); }
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('[單字卡] Service Worker 註冊失敗：', err));
    });
  }

  bindEvents();
  registerServiceWorker();
  loadData();
})();
