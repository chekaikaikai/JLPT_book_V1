# ことば卡

手機優先的 N5／N4 日文翻卡 PWA。純 HTML／CSS／JavaScript，沒有後端、框架或資料庫，可直接部署到 GitHub Pages。

本版以 **nihongo-daily-pwa** 為範例改寫：沿用它的單字與漢字資料、🔊 發音、假名標註（furigana）、備份、深色模式與網路優先的 Service Worker，並改成「翻卡」介面，資料獨立放在 `data/words.json`。

> JLPT 官方沒有公布完整固定的 N5／N4 詞彙表，本專案的級別來自社群整理資料，僅供參考，不代表考試範圍。

## 三種卡片

| 分類 | 內容 | N5 | N4 | 合計 |
|---|---|---|---|---|
| 漢字 | 單字漢字（例：日） | 84 | 169 | 253 |
| 平假名（含漢字） | 含平假名或漢字表記的單字（例：ありがとう、青い、食べる） | 613 | 588 | 1201 |
| 片假名 | 以片假名表記的單字（例：テレビ） | 61 | 42 | 103 |

共 1557 張。範例中的 1304 個單字全數收錄，並加上 253 個漢字。每一類都可選 N5、N4 或全部程度。

- **漢字卡**：正面是漢字；背面有中文意思、音讀、訓讀、筆畫，以及「常見單字」（每個單字可按 🔊 朗讀）。
- **單字卡**（平假名、片假名）：正面只有日文單字；背面有讀音、羅馬字、中文意思、英文釋義、詞性、例句與翻譯。

## 功能

- 篩選：程度、分類、抽卡範圍（全部、尚未熟悉、只練習收藏）
- 標記「不熟悉／普通／已熟悉」（再按一次可取消）、收藏
- 隨機順序、重新洗牌、上一張／下一張、目前張數
- 統計（狀態頁）：今日練習（今天翻過面或標記過的不重複卡片數）、總卡片、已熟悉、收藏；進度記錄頁依分類顯示熟悉度分佈
- 🔊 發音（Web Speech API，`ja-JP`）、例句假名標註可顯示或隱藏
- 備份（進度記錄頁）：匯出／匯入學習紀錄（匯入時合併，同一張卡以較新的更新時間為準）
- 深色模式（跟隨系統）、PWA（可加入主畫面、離線可用）
- 處理：JSON 載入失敗（可重試）、篩選後沒有卡片、欄位缺漏（顯示「待核對」）、LocalStorage 不可用

## 檔案結構

```
kotobaka/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/style.css
├── js/app.js
├── data/words.json       # 全部 1557 張卡片
├── icons/
├── DATA-LICENSE.md
└── README.md
```

所有資源路徑都是相對路徑，放在 GitHub Pages 子路徑（`https://帳號.github.io/倉庫名/`）也能正常載入。

## 本機預覽

不要直接雙擊開啟 `index.html`：`file://` 下瀏覽器會阻擋 `fetch` 載入 JSON，也無法註冊 Service Worker。

```bash
cd kotobaka
python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

## 部署到 GitHub Pages

1. 建立新的 GitHub repository（例如 `kotobaka`），把本資料夾**內的檔案**放在根目錄（`index.html` 要在最上層）。
2. 推送到 `main`：
   ```bash
   git init
   git add .
   git commit -m "ことば卡"
   git branch -M main
   git remote add origin https://github.com/<帳號>/kotobaka.git
   git push -u origin main
   ```
3. Repository 的 **Settings → Pages**：Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)`。
4. 稍等一兩分鐘，開啟 `https://<帳號>.github.io/kotobaka/`。

Service Worker 採「網路優先」：有網路時載入最新版，離線時用快取。更新後重新部署即可；若新增檔案，請加進 `sw.js` 的 `SHELL` 並調高 `CACHE_VERSION`（目前為 `kotobaka-v5`）。

## 畫面與分頁（針對 320×480 小手機）

畫面固定為一頁，底部有四個分頁，各分頁內容太多時在自己的區域內捲動：

| 分頁 | 內容 |
|---|---|
| 🃏 字卡 | 只有卡片本身：頂端是張數與「收藏」，卡片下方依序是熟悉度三個按鈕、「上一張／下一張」。卡片高度會自動填滿剩餘空間，所以按鈕一直都在畫面內 |
| 🔎 篩選 | 程度、分類、抽卡範圍、隨機順序與重新洗牌；顯示符合條件的張數，按「開始練習」回到字卡 |
| 📝 進度記錄 | 依分類統計「已熟悉／普通／不熟悉／未標記」張數（可選程度）；匯出、匯入學習紀錄 |
| 📊 狀態 | 今日練習、總卡片、已熟悉、收藏；目前牌組、儲存狀態、資料授權說明與載入警告 |

其他小螢幕調整：

- 卡片背面內容較多時（例如漢字卡的「常見單字」）在卡片內捲動，不會把按鈕推出畫面。
- 讀音、「英文釋義・詞性」各併成一行；漢字卡的筆畫放在標題旁。
- 翻面為簡單的轉入動畫（不使用 3D 疊層），避免部分手機瀏覽器卡片內無法捲動。
- 按鈕高度約 40–44px，下拉選單字體維持 16px 以避免 iOS 自動放大。
- 切換到其他分頁時會停止正在朗讀的語音。

## 安裝到手機

- **iPhone（Safari）**：分享 → 加入主畫面
- **Android（Chrome）**：選單 → 安裝應用程式／加到主畫面

## 🔊 發音

使用瀏覽器內建的 `speechSynthesis`，不需要音檔或網路 API。

- 必須由使用者**點擊按鈕**才會發聲（iOS 的限制），不會自動播放。
- 聲音品質取決於裝置內建的日文語音；找不到時會提示，請到系統設定安裝日文語音。
- 例句若有假名標註，會改用假名朗讀以避免讀錯；沒有標註的例句直接朗讀原文。
- 單一漢字不提供朗讀（單字的語音引擎容易讀錯），請用「常見單字」旁的 🔊。
- 瀏覽器不支援 Web Speech API 時，🔊 按鈕會隱藏。

## 備份

學習紀錄只存在這個瀏覽器的 LocalStorage，不會上傳到任何伺服器。換手機或清除瀏覽資料前，請先在「進度記錄」分頁按「匯出紀錄」，之後再「匯入紀錄」。iOS 的主畫面 App 可能無法直接下載檔案，若遇到這種情況請改用 Safari 開啟網址進行匯出。

## 資料格式

`data/words.json` 為 `{ "meta": {...}, "words": [...] }`（也接受直接放陣列）。`category` 為 `kanji`、`hiragana` 或 `katakana`。

單字卡（`hiragana`／`katakana`）：

```json
{
  "id": "n5-hiragana-0000",
  "level": "N5",
  "category": "hiragana",
  "word": "会う",
  "reading": "あう",
  "romaji": "au",
  "meaning": "見面、遇見",
  "meaningEn": "to meet",
  "partOfSpeech": "五段動詞",
  "example": "もうスミスさんに会われましたね。",
  "exampleRuby": "もうスミスさんに{会|あ}われましたね。",
  "exampleMeaning": null,
  "exampleMeaningEn": "You've met Mr. Smith already, haven't you?",
  "source": "OpenJLPT 衍生資料（CC BY-SA 4.0；…）",
  "notes": null
}
```

漢字卡（`kanji`）：

```json
{
  "id": "kj-n5-0000",
  "level": "N5",
  "category": "kanji",
  "word": "日",
  "reading": null,
  "meaning": "日、太陽、日本、天數",
  "strokes": 4,
  "onyomi": ["にち", "じつ"],
  "kunyomi": ["ひ", "-び", "-か"],
  "relatedWords": [
    { "word": "明日", "reading": "あした", "meaning": "明天", "meaningEn": null, "level": null }
  ],
  "source": "OpenJLPT 衍生資料（CC BY-SA 4.0；KANJIDIC2、JMdict）…",
  "notes": null
}
```

- `id`、`word`、`level`、`category` 為必要欄位，缺漏或 id 重複的項目會被略過並提示筆數；其他欄位可為 `null`，畫面顯示「待核對」。
- 訓讀的「.」之前是詞幹、之後是送假名；「-」表示接在其他詞的前後（KANJIDIC 的標記方式）。
- `exampleMeaning`（例句中文翻譯）目前全為 `null`，畫面改顯示英文翻譯並標註「（英文）」；補上繁體中文後會自動優先顯示。
- `notes`（外語來源）目前全為 `null`，片假名單字背面顯示「待核對」。**不要憑印象填寫詞源**；JMdict 的 `lsource` 欄位有外語來源資料，可作為核對依據。
- 漢字卡「常見單字」中，沒有中文意思的會顯示英文並標「（英）」，部分單字帶有 N3 以上的級別標示，是原資料的內容。

## 資料處理說明

- 單字（1304 筆）：只含片假名的單字（含「コピーする」「チェックする」）→ `katakana`；其餘（含漢字或只有平假名）→ `hiragana`。
- 漢字（253 筆）→ `kanji`；原資料中的測驗題欄位未使用。
- 每個單字有兩句 Tatoeba 例句，只保留較短的一句；例句是否自然、符合程度，尚未逐句人工核對。

## 資料來源與授權

資料來自 OpenJLPT（CC BY-SA 4.0），內容包含 JMdict、KANJIDIC2、Jonathan Waller 的 JLPT 清單與 Tatoeba 例句。詳見 [DATA-LICENSE.md](DATA-LICENSE.md)。

- 繁體中文意思為草稿，尚待校對。
- 依 CC BY-SA 4.0，散布或修改資料時須保留出處，並以相同授權分享衍生資料。**部署到公開 repository 時請一併保留 `DATA-LICENSE.md`。**

## LocalStorage 鍵值

| 鍵 | 內容 |
|---|---|
| `kotobaka:v1:progress` | `{ [id]: { level, fav, updatedAt } }` |
| `kotobaka:v1:today` | `{ date, ids[] }`（本機日期，跨日自動重算） |
| `kotobaka:v1:filters` | 上次使用的篩選條件 |
| `kotobaka:v1:settings` | `{ furigana }` |
