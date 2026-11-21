# 資料授權與署名

`data/words.json` 由 **nihongo-daily-pwa** 專案內建的 N5／N4 單字與漢字資料轉換而來。依該專案 README 的說明，其資料來自 **OpenJLPT**（CC BY-SA 4.0），內容包含：

- **JMdict**（Electronic Dictionary Research and Development Group，CC BY-SA 4.0）
- **KANJIDIC2**（同上，漢字的音讀、訓讀、筆畫）
- **Jonathan Waller 的 JLPT 清單**（N5／N4 級別為社群整理的近似值）
- **Tatoeba** 例句（各句的作者與授權請見 Tatoeba 網站）

## 使用條件

- 本資料依 **CC BY-SA 4.0** 散布：使用、修改或再散布時，必須保留上述出處與署名，並以相同授權（CC BY-SA 4.0）分享衍生資料。
- 本專案對資料所做的修改：轉換欄位格式；單字依表記分為「平假名（含漢字）」「片假名」兩類，另有「漢字」類（單字漢字）；每個單字只保留一句例句（在兩句中選較短者）；不使用原資料中的測驗題欄位。
- 繁體中文意思為草稿、尚待校對。例句目前只有 Tatoeba 的英文翻譯，`exampleMeaning`（中文翻譯）為 `null`。
- 外語來源（`notes`）尚未核對，皆為 `null`，畫面顯示「待核對」。
- JLPT 官方沒有公布完整固定的詞彙表；`level` 欄位不代表考試保證範圍。漢字卡的「常見單字」內有部分單字標有 N3 以上的級別，是原資料的標示。

CC BY-SA 4.0 全文：https://creativecommons.org/licenses/by-sa/4.0/
