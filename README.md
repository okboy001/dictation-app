# 默書小幫手

小朋友默書工具：輸入詞語同課文，逐項按鍵朗讀，方便隨時加減句子同課文。全程喺瀏覽器運行（Web Speech API），唔需要 API key，亦唔使用麥克風。

## 功能

- **單一清單**：詞語同課文放喺同一個清單，可新增、編輯、刪除、上移、下移，亦可一鍵「清除全部」（會先彈確認；雲端內容亦會一併清除）。
- **自動分段**：用 **Space 或換行分隔**每項；**標點符號自己一行**（連續標點同一行，引號／括號黐住文字）。若一行超過 **8 個字**（唔計標點），會按詞語邊界拆開（唔會斬開詞語），切口盡量自然。
- **逐項朗讀**：每一項都有播放掣，點文字亦可播放；朗讀時會讀出標點名（`，`→逗號、`。`→句號、`！`→感嘆號、`？`→問號、`、`→頓號、`；`→分號、`：`→冒號、`…`→省略號、`「」『』`→引號），方便小朋友寫返標點。
- **語言切換**：普通話（`zh-CN`，**預設**，包括台灣國語 `zh-TW` 候選）／粵語（`zh-HK`），另有「聲線」下拉列出裝置**全部**聲線，粵、普各自記憶。搵唔到相應聲線會提示安裝（macOS：系統設定 → 輔助使用 → 朗讀內容 → 系統聲音 → 管理聲音 → 下載「普通話（中國）」）。
- **語速切換**：下拉揀 `0.2x`（更慢）／`0.25x`（極慢）／`0.3x`（超慢）／`0.4x`（預設）／`0.5x`（慢）／`0.6x`／`0.75x`／`0.85x`／`1.0x`。
- **雲端同步**：內容會自動同步去你嘅 Google Sheet（見下）。改動後約一秒自動儲存；開 app 或返到頁面時自動載入。離線時會保留本機內容，恢復後自動重試。
- **自動儲存**：內容同設定會存喺瀏覽器 `localStorage`，下次打開自動載入。

朗讀使用瀏覽器內置語音合成，建議用 Chrome、Edge 或 Safari。

## 雲端同步（Google Sheet + Apps Script）

App 會將內容同步去一份 Google Sheet：A1 係標題「內容」，A2 起每列一項，你可以隨時直接喺 Sheet 加減內容。

設定步驟：

1. 開新 Google Sheet，分享 → 任何知道連結嘅人 → 編輯者。
2. 擴充功能 → Apps Script → 貼上下方腳本 → 儲存。
3. 部署 → 新部署 → Web App → 執行身分「我」、存取「任何人」→ 部署 → 複製 `/exec` 網址。
4. 自己用瀏覽器開一次該 `/exec` 網址，完成首次授權。
5. 將網址寫入 `src/App.tsx` 嘅 `CLOUD_SCRIPT_URL` 常數，重新部署網站。

Apps Script 腳本：

```js
const SHEET_NAME = '默書內容';

function doGet() {
  return jsonResponse({ ok: true, items: getItems() });
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) {
    return jsonResponse({ ok: false, error: 'bad_json' });
  }
  if (e.parameter.action === 'set') {
    const count = setItems(data.items || []);
    return jsonResponse({ ok: true, count });
  }
  return jsonResponse({ ok: false, error: 'unknown_action' });
}

function getItems() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return [];
  const rows = sheet.getLastRow() - 1;
  if (rows <= 0) return [];
  return sheet.getRange(2, 1, rows, 1).getValues()
    .map(row => String(row[0]).trim())
    .filter(Boolean)
    .slice(0, 2000);
}

function setItems(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('內容');
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
