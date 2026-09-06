export default function Disclaimer() {
  return (
    <footer className="border-t border-white/5 px-3 py-4 text-center text-[10px] leading-relaxed text-ink-faint">
      <div className="mb-1 flex items-center justify-center gap-2 text-xs text-ink-muted">
        <span className="font-semibold text-ink">Tide US · 美股潮汐</span>
        <span>·</span>
        <span>local demo dashboard</span>
      </div>
      <p>
        本工具僅供教育與視覺化示範，<strong>並非投資建議</strong>。內容含合成資金流代理指標，不構成買賣推薦。
        投資有風險，請自行研究並諮詢合格顧問。Not investment advice. Synthetic flow proxies for illustration only.
      </p>
    </footer>
  );
}
