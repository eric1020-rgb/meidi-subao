# Tide US · 美股潮汐

美股產業輪動／資金流代理儀表板（靈感來自台灣市場的板塊潮汐視覺化，**原創品牌與實作**，非 tide-tw 官方產品）。

US sector rotation & capital-flow **proxy** dashboard. Educational demo — **not investment advice**.

---

## 快速開始 · How to run

```bash
cd tide-us
npm install
npm run dev
```

開啟 http://localhost:3000

正式建置：

```bash
npm run build
npm start
```

需求：Node.js 18+（建議 20）。

---

## 功能 · Features

1. **板塊泡泡圖** — XLK / XLF / XLE 等產業 ETF；X≈近 5 日資金流代理、Y≈加速度、大小≈約 20 日幅度；四象限潮汐狀態；支援平移／縮放
2. **排行榜** — Net Buy / Net Sell、Today / 5 Days，含長條視覺化
3. **觀察清單** — 本機 localStorage 儲存代碼
4. **今日亮點** — 大型股動能條、SPX proxy、as of 時間戳
5. **明日 SPX 投票** — 本機 bull/bear 聚合（趣味用）
6. **設定** — 台股紅漲／美股綠漲色系、深／淺色、字級
7. **免責聲明** — 非投資建議

---

## 資料方法論 · Data methodology

機構資金流通常需要付費 API。本專案在沒有 API key 的前提下：

1. **優先**嘗試從 Yahoo Finance 公開 chart API 拉取產業 ETF 與大型股報價。失敗則優雅降級。
2. **資金流代理（synthetic flow）**由價格／量能動能合成，使圖表永不空白：
   - `flow5d` ≈ 短窗漲跌動能 × 量能因子 × 產業偏置
   - `acceleration` ≈ 今日動能 − 滯後窗動能
   - `magnitude20d` ≈ 累積動能絕對值（控制泡泡大小）
   - 潮汐狀態依 `flow5d` 與 `acceleration` 正負象限分類
3. 畫面標示 as of 時間與來源：`live-quotes+synthetic-flow` 或 `demo`
4. 同一 UTC 日期的 demo 亂數種子固定

這些指標是視覺化代理，不是真實法人買賣超。

---

## 技術棧 · Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- D3.js 泡泡圖（pan / zoom）
- localStorage（觀察清單、設定、投票）

---

## 免責聲明 · Disclaimer

本工具僅供教育與介面示範，**並非投資建議**。內容含合成資金流代理指標，不構成任何買賣推薦。投資有風險，請自行研究並諮詢合格顧問。

This software is for education and UI demonstration only. **Not investment advice.** Synthetic flow proxies are illustrative. Do your own research.

---

## License

MIT — demo project for local use.
