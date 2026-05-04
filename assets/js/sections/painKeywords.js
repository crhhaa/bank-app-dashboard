// painKeywords.js — Pain point keyword word cloud (負評痛點文字雲)
import { ALL_BANKS, YUANTA } from "../config.js";

let _painKeywordSummary = [];
let _painReviews = [];
let _lastFilterState = null;
let _selectedBank = YUANTA;

// Pagination state for drilldown
let _drilldownReviews = [];
let _drilldownPage = 0;
const PAGE_SIZE = 5;

export function initPainKeywords(painKeywordSummary, painReviews) {
  _painKeywordSummary = painKeywordSummary || [];
  _painReviews = painReviews || [];
  if (_lastFilterState) renderPainKeywords(_lastFilterState);
}

export function renderPainKeywords(filterState) {
  _lastFilterState = filterState;
  _populateBankSelect(filterState);
  _renderWordCloud();
  _renderRanking();
}

// ── Color palette ──────────────────────────────────────────────────

const PALETTE = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#10b981", // emerald
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
];

function _wordColor(word, weight, minW, maxW) {
  // High-frequency words get a strong color, low-frequency get a lighter shade
  const t = maxW === minW ? 0.5 : (weight - minW) / (maxW - minW);
  // Pick color by hash of word text for variety
  let hash = 0;
  for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) & 0xffff;
  const base = PALETTE[hash % PALETTE.length];
  // Lighten low-weight words by mixing with white
  const alpha = (0.55 + t * 0.45).toFixed(2);
  return base + _alphaHex(alpha);
}

function _alphaHex(alpha) {
  return Math.round(parseFloat(alpha) * 255).toString(16).padStart(2, "0");
}

function _rankBarColor(rank, total) {
  // Gradient: top ranks → blue-indigo, mid → teal, bottom → slate
  const t = total <= 1 ? 0 : (total - rank) / (total - 1);
  if (t > 0.6) return "#3b82f6";
  if (t > 0.3) return "#06b6d4";
  return "#94a3b8";
}

// ── Bank selector ──────────────────────────────────────────────────

function _populateBankSelect(filterState) {
  const sel = document.getElementById("pain-bank-select");
  if (!sel) return;

  const banks = (filterState.selectedBanks && filterState.selectedBanks.length)
    ? filterState.selectedBanks
    : ALL_BANKS;

  if (!banks.includes(_selectedBank)) {
    _selectedBank = banks[0] || YUANTA;
  }

  sel.innerHTML = banks.map(b =>
    `<option value="${b}"${b === _selectedBank ? " selected" : ""}>${b}</option>`
  ).join("");

  sel.onchange = () => {
    _selectedBank = sel.value;
    _renderWordCloud();
    _renderRanking();
    const card = document.getElementById("pain-reviews-card");
    if (card) card.style.display = "none";
  };
}

// ── Aggregate keywords for current selection ───────────────────────

function _getKeywordCounts() {
  const platFilter = _lastFilterState?.platform === "all" ? null : _lastFilterState?.platform;
  const counts = {};
  _painKeywordSummary
    .filter(r => r.bank === _selectedBank)
    .filter(r => !platFilter || r.platform === platFilter)
    .forEach(r => {
      const kw = (r.keyword || "").trim();
      if (kw.length < 2) return;
      counts[kw] = (counts[kw] || 0) + parseInt(r.count || 0, 10);
    });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ── Word cloud ─────────────────────────────────────────────────────

function _renderWordCloud() {
  const container = document.getElementById("pain-wordcloud-container");
  if (!container) return;

  const sorted = _getKeywordCounts();

  if (!sorted.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:3rem;font-size:0.9rem">暫無資料 — 請先執行 pipeline 並填入 GID</p>';
    return;
  }

  const top60 = sorted.slice(0, 60);
  const maxW = top60[0][1];
  const minW = top60[top60.length - 1][1];

  if (window.WordCloud) {
    const list = top60.map(([text, w]) => {
      const size = minW === maxW ? 32 : 10 + Math.round((w - minW) / (maxW - minW) * 52);
      return [text, size];
    });

    container.innerHTML = "";
    WordCloud(container, {
      list,
      gridSize: Math.max(8, Math.round(14 * container.offsetWidth / 900)),
      weightFactor: 1,
      fontFamily: "'Noto Sans TC', 'Inter', sans-serif",
      color: (word, weight) => {
        let hash = 0;
        for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) & 0xffff;
        return PALETTE[hash % PALETTE.length];
      },
      backgroundColor: "transparent",
      rotateRatio: 0.15,
      rotationSteps: 2,
      minRotation: -Math.PI / 2,
      maxRotation: 0,
      drawOutOfBound: false,
      shuffle: false,
      click: (item) => _showDrilldown(item[0]),
    });
  } else {
    _renderFallbackBadges(container, top60, maxW, minW);
  }
}

function _renderFallbackBadges(container, top60, maxW, minW) {
  const html = top60.map(([kw, w], i) => {
    const t = maxW === minW ? 0.5 : (w - minW) / (maxW - minW);
    const size = (0.75 + t * 1.5).toFixed(2);
    let hash = 0;
    for (let j = 0; j < kw.length; j++) hash = (hash * 31 + kw.charCodeAt(j)) & 0xffff;
    const color = PALETTE[hash % PALETTE.length];
    return `<span onclick="_painKeywordClick('${kw.replace(/'/g, "\\'")}')"
      style="display:inline-block;cursor:pointer;padding:0.2em 0.5em;margin:0.2em;
             font-size:${size}rem;opacity:${(0.6 + t * 0.4).toFixed(2)};
             color:${color};font-weight:${t > 0.5 ? 700 : 500}"
      title="${kw}: ${w} 次">${kw}</span>`;
  }).join("");
  container.innerHTML = `<div style="padding:1rem;line-height:2">${html}</div>`;
  window._painKeywordClick = (kw) => _showDrilldown(kw);
}

// ── Ranking list (two-column) ──────────────────────────────────────

function _renderRanking() {
  const container = document.getElementById("pain-keyword-ranking");
  if (!container) return;

  const top20 = _getKeywordCounts().slice(0, 20);
  if (!top20.length) {
    container.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem">暫無資料</span>';
    return;
  }

  const maxW = top20[0][1];
  const total = top20.length;

  const renderItem = ([kw, w], i) => {
    const barPct = Math.round((w / maxW) * 100);
    const rank = i + 1;
    const medalColor = rank === 1 ? "#f59e0b" : rank === 2 ? "#9ca3af" : rank === 3 ? "#b45309" : "var(--text-secondary)";
    const barColor = _rankBarColor(rank, total);
    return `
      <div onclick="_painKeywordClick('${kw.replace(/'/g, "\\'")}')"
           style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.3rem 0.4rem;border-radius:6px;transition:background 0.15s"
           onmouseover="this.style.background='var(--bg-hover,#f8fafc)'"
           onmouseout="this.style.background='transparent'">
        <span style="width:1.3rem;text-align:center;font-size:0.76rem;font-weight:700;color:${medalColor};flex-shrink:0">${rank}</span>
        <span style="min-width:4.5rem;font-size:0.85rem;font-weight:${rank <= 3 ? 700 : 500};color:var(--text-primary);flex-shrink:0">${kw}</span>
        <div style="flex:1;background:var(--bg-secondary,#f1f5f9);border-radius:3px;height:6px;overflow:hidden;min-width:2rem">
          <div style="width:${barPct}%;background:${barColor};height:100%;border-radius:3px;transition:width 0.3s"></div>
        </div>
        <span style="font-size:0.76rem;color:var(--text-secondary);min-width:2.5rem;text-align:right;flex-shrink:0">${w} 次</span>
      </div>`;
  };

  // Split into two columns: left = ranks 1-10, right = ranks 11-20
  const leftItems = top20.slice(0, 10).map((item, i) => renderItem(item, i)).join("");
  const rightItems = top20.slice(10, 20).map((item, i) => renderItem(item, i + 10)).join("");

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 1rem">
      <div style="display:flex;flex-direction:column;gap:0.1rem">${leftItems}</div>
      <div style="display:flex;flex-direction:column;gap:0.1rem">${rightItems}</div>
    </div>`;

  window._painKeywordClick = (kw) => _showDrilldown(kw);
}

// ── Drilldown with pagination ──────────────────────────────────────

function _stars(rating) {
  const n = parseInt(rating, 10) || 0;
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

function _showDrilldown(keyword) {
  const card = document.getElementById("pain-reviews-card");
  const title = document.getElementById("pain-reviews-title");
  const list = document.getElementById("pain-reviews-list");
  const countEl = document.getElementById("pain-reviews-count");
  if (!card || !list) return;

  const platFilter = _lastFilterState?.platform === "all" ? null : _lastFilterState?.platform;

  const totalCount = _painKeywordSummary
    .filter(r => r.bank === _selectedBank && r.keyword === keyword)
    .filter(r => !platFilter || r.platform === platFilter)
    .reduce((s, r) => s + parseInt(r.count || 0, 10), 0);

  title.textContent = `「${keyword}」相關評論`;
  countEl.textContent = `共 ${totalCount} 則提及`;

  const matched = _painReviews
    .filter(r => r.bank === _selectedBank)
    .filter(r => !platFilter || r.platform === platFilter)
    .filter(r => (r.keywords || "").split("|").map(k => k.trim()).includes(keyword))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  _drilldownReviews = matched;
  _drilldownPage = 0;

  if (!matched.length) {
    // Fallback: show platform count badges
    const badges = _painKeywordSummary
      .filter(r => r.bank === _selectedBank && r.keyword === keyword)
      .filter(r => !platFilter || r.platform === platFilter)
      .map(r => `<span style="padding:0.25rem 0.6rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:99px;font-size:0.8rem;color:#1d4ed8">
        ${r.platform}: ${r.count} 次 (${r.pct_of_neg_reviews}%)
      </span>`)
      .join("");
    list.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.5rem">${badges}</div>`;
  } else {
    _renderDrilldownPage(list);
  }

  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function _renderDrilldownPage(listEl) {
  const reviews = _drilldownReviews;
  const total = reviews.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = _drilldownPage * PAGE_SIZE;
  const pageItems = reviews.slice(start, start + PAGE_SIZE);

  const reviewsHtml = pageItems.map(r => {
    const rating = parseInt(r.rating, 10) || 0;
    const starColor = rating <= 2 ? "#dc2626" : "#f59e0b";
    const platBg = r.platform === "App Store" ? "#e0f2fe" : "#dcfce7";
    const platColor = r.platform === "App Store" ? "#0369a1" : "#166534";
    const categoryBadge = r.category
      ? `<span style="padding:0.15rem 0.5rem;background:#f3f4f6;border-radius:99px;font-size:0.72rem;color:#374151">${r.category}</span>`
      : "";
    const productBadge = r.product_line && r.product_line !== "其他"
      ? `<span style="padding:0.15rem 0.5rem;background:#ede9fe;border-radius:99px;font-size:0.72rem;color:#6d28d9">${r.product_line}</span>`
      : "";
    const replyHtml = r.has_reply === "1" || r.has_reply === 1
      ? `<div style="margin-top:0.6rem;padding:0.5rem 0.75rem;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;font-size:0.8rem;color:#166534">
          <span style="font-weight:600">官方回覆：</span>${r.developer_reply || ""}
        </div>`
      : "";
    return `
      <div style="padding:0.85rem 1rem;border-bottom:1px solid var(--border,#e2e8f0)">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;flex-wrap:wrap">
          <span style="font-size:0.75rem;color:var(--text-secondary)">${r.date || ""}</span>
          <span style="padding:0.1rem 0.45rem;background:${platBg};color:${platColor};border-radius:99px;font-size:0.72rem;font-weight:600">${r.platform}</span>
          <span style="font-size:0.82rem;color:${starColor};letter-spacing:1px">${_stars(rating)}</span>
          ${categoryBadge}${productBadge}
        </div>
        <div style="font-size:0.875rem;color:var(--text-primary);line-height:1.55;white-space:pre-wrap">${r.review || ""}</div>
        ${replyHtml}
      </div>`;
  }).join("");

  const paginationHtml = totalPages > 1 ? `
    <div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:0.85rem 1rem;border-top:1px solid var(--border,#e2e8f0)">
      <button id="pain-page-prev"
        onclick="window._painPagePrev()"
        ${_drilldownPage === 0 ? "disabled" : ""}
        style="padding:0.3rem 0.8rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);cursor:pointer;font-size:0.82rem;color:var(--text-primary);opacity:${_drilldownPage === 0 ? 0.4 : 1}">
        ← 上一頁
      </button>
      <span style="font-size:0.82rem;color:var(--text-secondary)">
        第 ${_drilldownPage + 1} / ${totalPages} 頁（共 ${total} 則）
      </span>
      <button id="pain-page-next"
        onclick="window._painPageNext()"
        ${_drilldownPage >= totalPages - 1 ? "disabled" : ""}
        style="padding:0.3rem 0.8rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);cursor:pointer;font-size:0.82rem;color:var(--text-primary);opacity:${_drilldownPage >= totalPages - 1 ? 0.4 : 1}">
        下一頁 →
      </button>
    </div>` : "";

  listEl.innerHTML = reviewsHtml + paginationHtml;
}

window._painPagePrev = () => {
  if (_drilldownPage > 0) {
    _drilldownPage--;
    const list = document.getElementById("pain-reviews-list");
    if (list) {
      _renderDrilldownPage(list);
      document.getElementById("pain-reviews-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
};

window._painPageNext = () => {
  const totalPages = Math.ceil(_drilldownReviews.length / PAGE_SIZE);
  if (_drilldownPage < totalPages - 1) {
    _drilldownPage++;
    const list = document.getElementById("pain-reviews-list");
    if (list) {
      _renderDrilldownPage(list);
      document.getElementById("pain-reviews-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
};
