# 美帝速報 · US Market Brief

美股產業輪動／資金流代理儀表板（靈感來自台灣市場的板塊潮汐視覺化，**原創品牌與實作**）。

US sector rotation & capital-flow **proxy** dashboard. Educational demo — **not investment advice**.

---

## 快速開始 · How to run

```bash
cd meidi-subao
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
4. **今日亮點** — 大型股動能條、SPX proxy、資料快照（snapshot）時間戳
5. **明日 SPX 投票** — 本機 bull/bear 聚合（趣味用）
6. **設定** — 台股紅漲／美股綠漲色系、深／淺色、字級
7. **免責聲明** — 非投資建議
8. **當日新聞** — 美股／財經同日（或最新）頭條；`/api/news` 彙整公開 RSS；約 90s 自動更新 + 手動重新整理
9. **漲跌榜** — 當日 Top 漲／跌（各 10，合計 20）；`/api/movers`；約 90s 自動更新 + 手動重新整理
10. **總結** — 每日盤後總結、每周股市總結、未來一周大事預期；`/api/summary/*`；手動重新整理 + 每日輕量自動更新

---



## 當日新聞 · Today's News

| Item | Value |
|------|--------|
| UI | Header tab **當日新聞** — Chinese title primary + English secondary |
| API | `GET /api/news` → `{ items: [{ title, titleZh?, … }], asOf, source, error? }` |
| Client refresh | ~90s auto + manual **重新整理** (`?refresh=1` bypasses short cache) |
| Server cache | ~45s in-memory + fetch revalidate; translations cached by title hash |

### Sources (free public RSS, no API key)

- CNBC Business / Finance device RSS
- MarketWatch Top Stories & Market Pulse
- Yahoo Finance Top Financial Stories
- Investing.com news RSS

Feeds are fetched server-side, parsed, deduped by title, sorted by time. Prefer same-UTC-day items; if sparse, fall back to latest headlines. If all upstream feeds fail, the API returns demo stubs with `error: true` so the page never crashes.

### Headline translation (zh-Hant / Traditional Chinese)

- Server-side when building `/api/news` — clients receive ready-made `titleZh`.
- **Primary:** [MyMemory](https://mymemory.translated.net/) free public API (`en|zh-TW`), no user-provided API key.
- **Fallback:** Google Translate unofficial `gtx` endpoint (demo-style; may rate-limit).
- In-memory cache keyed by title hash; concurrency + timeouts so a slow translator cannot hang the feed.
- If translation fails for an item, UI shows **English only** — never breaks the page.
- **Limitations:** machine translation quality varies (finance jargon, tickers, proper nouns). Not human-edited; for reference only. Free tiers have daily quotas / rate limits.

**Disclaimer:** aggregated for information only — not investment advice.

---

## 漲跌榜 · Movers

| Item | Value |
|------|--------|
| UI | Header tab **漲跌榜** |
| API | `GET /api/movers` → `{ gainers, losers, asOf, source, error? }` |
| Client refresh | ~90s auto + manual **重新整理** (`?refresh=1` bypasses short cache) |
| Server cache | ~45s in-memory |

### Data (free, no API key)

1. **Primary:** Yahoo Finance predefined screener (`day_gainers` / `day_losers`) — liquid US equities by session % change.
2. **Fallback:** Rank a built-in liquid universe (mega-caps + sector leads + liquid large names) via Yahoo chart quotes.
3. **Demo stubs** if both fail — UI never empty/crashes.

Colors respect 台股紅漲／美股綠漲 setting (`--up` / `--down`).

**Disclaimer:** for information only — not investment advice.

---
## 總結 · Market Wrap

| Item | Value |
|------|--------|
| UI | Header tab **總結**（子區塊：每日盤後／每周總結／未來一周大事） |
| APIs | `GET /api/summary/daily` · `GET /api/summary/weekly` · `GET /api/summary/calendar` |
| Client refresh | Manual **重新整理**；每日盤後約 120s 輕量自動更新（`?refresh=1` 略過短快取） |
| Server cache | ~60s in-memory |

### Daily wrap（每日盤後）

- Major indices: SPY / QQQ / DIA / IWM via Yahoo chart quotes
- Sector ETF leaders & laggards (existing sector universe)
- Top movers summary (reuses `/api/movers` logic)
- Bullet highlights + recent RSS headlines

### Weekly wrap（每周總結）

- ~5 trading-day performance of indices & sectors (Yahoo `range=5d`)
- Notable themes from recent news RSS (reuses news feeds)

### Upcoming week calendar（未來一周大事）

- Primary: public Forex Factory week JSON (`ff_calendar_thisweek.json`) — USD High/Medium events, times labeled **HKT**
- Fallback: curated “expected” macro windows (CPI / Claims / Fed watch) so UI never empty
- Framed as **expected** catalysts — not a paid calendar product; schedules can slip

**Disclaimer:** wraps & calendar for information only — **not investment advice**.

---

## 每日自動更新 · Daily market refresh (Vercel Cron)

No push notifications — server-side cache refresh only.

| Item | Value |
|------|--------|
| Path | `/api/cron/refresh` |
| Schedule | `30 20 * * 1-5` (20:30 UTC Mon–Fri) |
| Local meaning | ≈ after US cash close · ~04:30 HKT next calendar day |
| Hobby | Daily cron supported on Hobby |

### Setup on Vercel

1. In the Vercel project → **Settings → Environment Variables**, add:
   - `CRON_SECRET` — a long random string (Production; Preview optional)
2. Redeploy so the cron + env take effect.
3. Vercel invokes the route with `Authorization: Bearer ${CRON_SECRET}` and/or `x-vercel-cron: 1`. Manual test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/refresh
```

The handler loads fresh quotes, runs `revalidateTag('market')`, and returns `{ ok, asOf, source }`. `/api/market` serves data from `unstable_cache` (tag `market`, ~12h time-based revalidate as a safety net).

Defined in `vercel.json`.

---

## 資料方法論 · Data methodology

機構資金流通常需要付費 API。本專案在沒有 API key 的前提下：

1. **優先**嘗試從 Yahoo Finance 公開 chart API 拉取產業 ETF 與大型股報價。失敗則優雅降級。
2. **資金流代理（synthetic flow）**由價格／量能動能合成，使圖表永不空白：
   - `flow5d` ≈ 短窗漲跌動能 × 量能因子 × 產業偏置
   - `acceleration` ≈ 今日動能 − 滯後窗動能
   - `magnitude20d` ≈ 累積動能絕對值（控制泡泡大小）
   - 潮汐狀態依 `flow5d` 與 `acceleration` 正負象限分類
3. 畫面標示 **資料快照（snapshot）** 時間與來源：`live-quotes+synthetic-flow` 或 `demo`（非即時 tick）
4. 同一 UTC 日期的 demo 亂數種子固定

這些指標是視覺化代理，不是真實法人買賣超。

---

## 技術棧 · Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- D3.js 泡泡圖（pan / zoom）
- localStorage（觀察清單、設定、投票）
- Vercel Cron + `unstable_cache` / `revalidateTag`（每日行情快照）

---

## 免責聲明 · Disclaimer

本工具僅供教育與介面示範，**並非投資建議**。內容含合成資金流代理指標，不構成任何買賣推薦。投資有風險，請自行研究並諮詢合格顧問。

This software is for education and UI demonstration only. **Not investment advice.** Synthetic flow proxies are illustrative. Do your own research.

---

## License

MIT — demo project for local use.
