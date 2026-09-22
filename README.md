# 默書小幫手

小朋友默書工具：中英文默書，輸入詞語同課文，逐項按鍵朗讀，方便隨時加減句子同課文。全程喺瀏覽器運行（Web Speech API），唔需要 API key，亦唔使用麥克風。

## 功能

- **中／英切換**：頂部「中文／English」切換，中文同英文各自有四套獨立清單（默書、練習字），互不影響。
- **「默書」清單**：詞語同課文放喺同一個清單，可新增、編輯、刪除、上移、下移，亦可一鍵「清除全部」（會先彈確認；雲端內容亦會一併清除）。
- **默書模式**：默書 Tab 同練習字 Tab 都有「開始默書」掣，進入全畫面默書模式（用嗰個清單嘅內容），四個大掣「上一個／重讀／下一個／離開」，顯示「第 X 個／共 N 個」同「剩返 M 個」；**盲默**（預設唔顯示詞語，有「顯示」偷睇掣）；可設定每項重複 1–3 次、停頓 0–8 秒（預設重複 1 次、停頓 3 秒）；開「收音」後可以用**語音指令**控制（跟返朗讀語言：普通話→「下一個／上一個／重讀」、粵語→廣東話指令、英式／美式→英文指令；iPhone Safari 唔支援語音辨識，用掣）。
- **「練習字」分頁**：輸入默書唔識嘅字（中文 1–4 字／英文生字），逐字撳掣重溫讀音；仲可以「匯出 PDF」整一張 A4 練習紙，**試卷式排版**：每題一行編號（`1. 認真 □□□`），編號＋詞語欄固定闊度、格仔／橫線由固定位置開始對齊，中文用 1.3cm × 1.3cm 格仔、**英文用橫線**，全張統一揀「寫幾多次」1–5 次（例如「認真」×2 → 2 行 × 2 格；`Sunday` ×3 → 3 條橫線），列印時另存為 PDF。
- **中文分段規則**：用 **Space 或換行分隔**每項；**標點符號自己一行**（連續標點同一行，引號／括號黐住文字）。若一行超過 **8 個字**（唔計標點），會按詞語邊界拆開（唔會斬開詞語）。
- **英文分段規則**：輸入段落課文，**換行分段**；**標點符號自己一行**（段落分隔）；每段約 **8 個英文詞語**，超過會按詞語邊界揀最平均嘅切口拆開，**唔會斬開單詞**。英文練習字（生字）則維持逐個字分隔。
- **逐項朗讀**：每一項都有播放掣，點文字亦可播放；朗讀時會讀出標點名（中文：`，`→逗號、`。`→句號、`「」`→引號等；英文：`,`→comma、`.`→period、`!`→exclamation mark 等），方便小朋友寫返標點。
- **語言切換**：中文模式可揀普通話（`zh-CN`，**預設**，包括台灣國語 `zh-TW` 候選）／粵語（`zh-HK`）；英文模式可揀**英式**（`en-GB`，**預設**，`.` 讀「full stop」）／**美式**（`en-US`，`.` 讀「period」）。另有「聲線」下拉列出裝置**全部**聲線，各語言各自記憶。搵唔到相應聲線會提示安裝。
- **語速切換**：下拉揀 `0.2x`（更慢）／`0.25x`（極慢）／`0.3x`（超慢）／`0.4x`（預設）／`0.5x`（慢）／`0.6x`／`0.75x`／`0.85x`／`1.0x`。
- **雲端同步**：四套清單各自同步去 Google Sheet：`默書內容`、`練習字`、`英文默書`、`英文練習字`。改動後約一秒自動儲存；開 app 或返到頁面時自動載入。離線時會保留本機內容，恢復後自動重試。
- **自動儲存**：內容同設定會存喺瀏覽器 `localStorage`，下次打開自動載入。

朗讀使用瀏覽器內置語音合成，建議用 Chrome、Edge 或 Safari。

## 雲端同步（Google Sheet + Apps Script）

App 會同步去一份 Google Sheet，四個 sheet：`默書內容`、`練習字`、`英文默書`、`英文練習字`；每個 sheet 嘅 A1 係標題、A2 起每列一項。你可以隨時直接喺 Sheet 加減內容。

初次設定步驟：

1. 開新 Google Sheet，分享 → 任何知道連結嘅人 → 編輯者。
2. 擴充功能 → Apps Script → 貼上下方腳本 → 儲存。
3. 部署 → 新部署 → Web App → 執行身分「我」、存取「任何人」→ 部署 → 複製 `/exec` 網址。
4. 自己用瀏覽器開一次該 `/exec` 網址，完成首次授權。
5. 將網址寫入 `src/App.tsx` 嘅 `CLOUD_SCRIPT_URL` 常數，重新部署網站。

更新腳本（例如加咗練習字 sheet）時，用「部署 → 管理部署 → 編輯 → 版本：新版本 → 部署」，網址唔會變。

Apps Script 腳本：

```js
const SHEETS = {
  items: '默書內容',
  practice: '練習字',
  enItems: '英文默書',
  enPractice: '英文練習字',
};

function doGet() {
  return jsonResponse({ ok: true,
    items: getItems(SHEETS.items),
    practice: getItems(SHEETS.practice),
    enItems: getItems(SHEETS.enItems),
    enPractice: getItems(SHEETS.enPractice),
  });
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) {
    return jsonResponse({ ok: false, error: 'bad_json' });
  }
  if (e.parameter.action === 'set') {
    const counts = {};
    for (const key of Object.keys(SHEETS)) {
      counts[key] = setItems(SHEETS[key], data[key] || []);
    }
    return jsonResponse({ ok: true, counts });
  }
  return jsonResponse({ ok: false, error: 'unknown_action' });
}

function getItems(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getLastRow() - 1;
  if (rows <= 0) return [];
  return sheet.getRange(2, 1, rows, 1).getValues()
    .map(row => String(row[0]).trim())
    .filter(Boolean)
    .slice(0, 2000);
}

function setItems(sheetName, items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1).setValue(sheetName);
  const clean = items
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 2000);
  if (clean.length) {
    sheet.getRange(2, 1, clean.length, 1).setValues(clean.map(text => [text]));
  }
  return clean.length;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 本機開發

需要 Node.js 18+。

```bash
npm install
npm run dev
```

瀏覽器打開 http://localhost:3000 。

## GitHub Pages

每次 push 去 `main`，GitHub Actions 會 `npm run build` 然後部署 `dist/`。

1. Repo → **Settings → Pages**
2. **Source** 選 **GitHub Actions**
3. 等 workflow 跑完之後，網站會喺：

`https://<你的帳號>.github.io/<repo-name>/`

首次啟用 Pages 之後，之後每次更新 `main` 都會自動上線。
