# 默書小幫手

小朋友默書工具：輸入詞語同課文，逐項按鍵朗讀，方便隨時加減句子同課文。全程喺瀏覽器運行（Web Speech API），唔需要 API key，亦唔使用麥克風。

## 功能

- **詞語清單 / 課文清單**：分開管理，可新增、編輯、刪除、上移、下移。
- **自動分段**：新增時先按標點（`。！？，、；：` 及換行）分句；若每段仍超過 **6 個字**，再用詞語邊界拆到每段最多 6 字，切口盡量自然。
- **逐項朗讀**：每個詞語／句子都有播放掣，點文字亦可播放。
- **語言切換**：粵語（`zh-HK`，預設）／普通話（`zh-CN`）。
- **語速切換**：`0.6x / 0.85x / 1.0x`。
- **自動儲存**：詞語、課文同設定會存喺瀏覽器 `localStorage`，下次打開自動載入。

朗讀使用瀏覽器內置語音合成，建議用 Chrome、Edge 或 Safari。

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
