// keywords.js — Voice analysis: radar charts (痛點/優勢) + category pills + review list
import { YUANTA, BANK_COLORS, ALL_BANKS, BANK_LOGOS } from "../config.js";
import { num } from "../dataLoader.js";

const VOICE_CATEGORIES = [
  "登入與認證",
  "轉帳與交易",
  "介面體驗",
  "系統穩定性",
  "客服支援",
  "功能完整性",
  "速度效能",
];

const MAX_RADAR_BANKS = 5; // 元大 + 最多4家競品

// Dash patterns for each radar bank slot (index 0 = Yuanta, always solid)
const RADAR_DASH_PATTERNS = [[], [], [8, 4], [3, 4], [12, 4, 3, 4]];

// Sqrt-based spread transform: stretches low values apart for better visual separation
function _sqrtTransform(v, max) {
  if (max <= 0 || v <= 0) return 0;
  return Math.sqrt(v / max) * max;
}

function _sqrtInverse(v, max) {
  if (max <= 0 || v <= 0) return 0;
  return Math.pow(v / max, 2) * max;
}

let chartNeg = null;
let chartPos = null;
let _voiceSummary = [];
let _voiceReviews = [];
let _reviewCategoryMap = new Map(); // key: bank||platform||date||review50 → category
let _selectedRadarBanks = []; // which banks show on radar
let _selectedCategory = null; // which category pill is active
let _lastFilterState = null;

// ── Public: init voice reviews (background loaded) ──────────────────
export function initVoiceReviews(reviews) {
  _voiceReviews = reviews || [];
  // Build lookup map for alertReviews.js to use
  _reviewCategoryMap = new Map();
  for (const r of _voiceReviews) {
    const key = `${r.bank}||${r.platform}||${String(r.date || "").slice(0, 10)}||${String(r.review || "").slice(0, 50)}`;
    _reviewCategoryMap.set(key, r.category);
  }
  if (_selectedCategory) {
    renderReviewList(_selectedCategory);
  }
}

// ── Public: look up category for a review (used by alertReviews.js) ─
export function getCategoryForReview(bank, platform, date, reviewText) {
  const key = `${bank}||${platform}||${String(date || "").slice(0, 10)}||${String(reviewText || "").slice(0, 50)}`;
  return _reviewCategoryMap.get(key) || null;
}

// ── Public: render full voice analysis section ───────────────────────
export function renderKeywords(voiceSummary, filterState) {
  _voiceSummary = voiceSummary || [];
  _lastFilterState = filterState;

  // Determine available banks in voice data, with Yuanta first
  const availableBanks = [...new Set(_voiceSummary.map((r) => r.bank))].sort((a, b) => {
    if (a === YUANTA) return -1;
    if (b === YUANTA) return 1;
    return ALL_BANKS.indexOf(a) - ALL_BANKS.indexOf(b);
  });

  // Init radar bank selection (once, or refresh when filterState changes)
  _initRadarBankSelector(availableBanks, filterState.selectedBanks);

  // Render radar charts
  renderRadarCharts();

  // Render category pills
  renderCategoryPills();
}

// ── Bank selector for radar (up to 5 banks) ─────────────────────────
function _initRadarBankSelector(availableBanks, sidebarSelectedBanks) {
  const container = document.getElementById("voice-bank-pills");
  if (!container) return;

  // On first render, default to Yuanta only
  if (_selectedRadarBanks.length === 0) {
    _selectedRadarBanks = [YUANTA];
  }

  // Remove banks no longer in available list
  _selectedRadarBanks = _selectedRadarBanks.filter((b) => b === YUANTA || availableBanks.includes(b));
  if (!_selectedRadarBanks.includes(YUANTA)) _selectedRadarBanks.unshift(YUANTA);

  container.innerHTML = availableBanks.map((bank) => {
    const isYuanta = bank === YUANTA;
    const isSelected = _selectedRadarBanks.includes(bank);
    const isDisabled = !isSelected && _selectedRadarBanks.length >= MAX_RADAR_BANKS;
    const color = isYuanta ? "#f97316" : (BANK_COLORS[bank] || "#64748b");
    const style = isSelected
      ? `background:${color};color:#fff;border-color:${color}`
      : isDisabled
        ? "background:#f1f5f9;color:#cbd5e1;border-color:#e2e8f0;cursor:not-allowed"
        : "background:#fff;color:var(--text-primary);border-color:var(--border)";
    const logoSrc = BANK_LOGOS[bank] || "";
    return `<button
      class="voice-bank-pill"
      data-bank="${bank}"
      style="display:inline-flex;align-items:center;gap:4px;padding:0.25rem 0.6rem;border-radius:999px;border:1.5px solid;font-size:0.75rem;font-weight:600;cursor:${isDisabled ? "not-allowed" : "pointer"};transition:all 0.15s;${style}"
      ${isYuanta ? "disabled" : ""}
    ><img src="${logoSrc}" width="14" height="14" style="border-radius:2px;object-fit:contain;" onerror="this.style.display='none'">${bank}</button>`;
  }).join("");

  container.querySelectorAll(".voice-bank-pill:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bank = btn.dataset.bank;
      if (_selectedRadarBanks.includes(bank)) {
        _selectedRadarBanks = _selectedRadarBanks.filter((b) => b !== bank);
      } else if (_selectedRadarBanks.length < MAX_RADAR_BANKS) {
        _selectedRadarBanks.push(bank);
      }
      // Refresh
      _initRadarBankSelector(availableBanks, _lastFilterState?.selectedBanks || []);
      renderRadarCharts();
    });
  });
}

// ── Radar charts ─────────────────────────────────────────────────────
function renderRadarCharts() {
  const platFilter = _lastFilterState?.platform === "all" ? null : _lastFilterState?.platform;

  function getScores(bank, scoreField) {
    let rows = _voiceSummary.filter((r) => r.bank === bank);
    if (platFilter) {
      rows = rows.filter((r) => r.platform === platFilter);
    } else {
      // Average across platforms
      const byCategory = {};
      rows.forEach((r) => {
        if (!byCategory[r.category]) byCategory[r.category] = [];
        byCategory[r.category].push(num(r[scoreField]));
      });
      return VOICE_CATEGORIES.map((c) => {
        const vals = byCategory[c];
        return vals && vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
    }
    const byCategory = {};
    rows.forEach((r) => { byCategory[r.category] = num(r[scoreField]); });
    return VOICE_CATEGORIES.map((c) => byCategory[c] || 0);
  }

  // Compute raw scores for all selected banks, then derive a tight dynamic max
  function _rawScoresByBank(scoreField) {
    const map = {};
    _selectedRadarBanks.forEach(bank => { map[bank] = getScores(bank, scoreField); });
    return map;
  }

  function _computeDynamicMax(rawByBank) {
    let maxVal = 0;
    Object.values(rawByBank).forEach(scores => scores.forEach(v => { if (v > maxVal) maxVal = v; }));
    if (maxVal <= 10) return 15;
    if (maxVal <= 20) return 25;
    if (maxVal <= 30) return 40;
    if (maxVal <= 50) return 60;
    if (maxVal <= 70) return 80;
    return 100;
  }

  function _niceStepSize(max) {
    if (max <= 15) return 5;
    if (max <= 40) return 10;
    if (max <= 60) return 15;
    return 25;
  }

  // Build datasets with sqrt-spread transform so clustered low values are visually separated.
  // rawData is stored on each dataset so tooltips always show original percentages.
  function buildDatasets(rawByBank, dynMax) {
    return _selectedRadarBanks.map((bank, idx) => {
      const isYuanta = bank === YUANTA;
      const color = BANK_COLORS[bank] || "#94a3b8";
      const rawData = rawByBank[bank];
      const displayData = rawData.map(v => _sqrtTransform(v, dynMax));
      return {
        label: bank,
        data: displayData,
        rawData,
        borderColor: color,
        backgroundColor: color + (isYuanta ? "33" : "18"),
        borderWidth: isYuanta ? 3 : 2,
        borderDash: RADAR_DASH_PATTERNS[idx % RADAR_DASH_PATTERNS.length],
        pointRadius: isYuanta ? 5 : 3,
        pointHoverRadius: isYuanta ? 7 : 5,
        pointBackgroundColor: color,
      };
    });
  }

  // Render shared HTML legend for radar charts
  function renderRadarLegend(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const dashSvg = (idx) => {
      const pat = RADAR_DASH_PATTERNS[idx % RADAR_DASH_PATTERNS.length];
      if (!pat || pat.length === 0) return "";
      const dashStr = pat.join(",");
      return `<svg width="18" height="6" style="vertical-align:middle;margin-right:2px"><line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" stroke-width="2" stroke-dasharray="${dashStr}"/></svg>`;
    };
    container.innerHTML = _selectedRadarBanks.map((bank, idx) => {
      const color = BANK_COLORS[bank] || "#94a3b8";
      const logoSrc = BANK_LOGOS[bank] || "";
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;font-size:11px;color:#64748b;border-bottom:2px solid ${color};">
        <img src="${logoSrc}" width="13" height="13" style="object-fit:contain;border-radius:2px;" onerror="this.style.display='none'">
        ${dashSvg(idx)}${bank}
      </span>`;
    }).join("");
  }

  function buildRadarOptions(dynMax) {
    const stepSize = _niceStepSize(dynMax);
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // Show original (un-transformed) value from rawData
            label: (ctx) => {
              const raw = ctx.dataset.rawData?.[ctx.dataIndex];
              return ` ${ctx.dataset.label}: ${(raw ?? 0).toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: dynMax,
          ticks: {
            stepSize,
            color: "#64748b",
            font: { size: 10 },
            backdropColor: "transparent",
            // Back-transform tick position to original percentage for label
            callback: (v) => _sqrtInverse(v, dynMax).toFixed(0) + "%",
          },
          grid: { color: "#cbd5e1", lineWidth: 1.5 },
          angleLines: { color: "#cbd5e1", lineWidth: 1.5 },
          pointLabels: {
            color: "#334155",
            font: { size: 11, weight: "500" },
            callback: (label) => label,
          },
        },
      },
      onClick: (e, elements, chartInstance) => {
        const labels = chartInstance.data.labels;
        if (!labels || labels.length === 0) return;
        const rect = chartInstance.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - chartInstance.chartArea.width / 2 - chartInstance.chartArea.left;
        const y = e.clientY - rect.top - chartInstance.chartArea.height / 2 - chartInstance.chartArea.top;
        const angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        const normalised = ((angle % 360) + 360) % 360;
        const step = 360 / labels.length;
        const idx = Math.round(normalised / step) % labels.length;
        const category = labels[idx];
        if (category && VOICE_CATEGORIES.includes(category)) {
          selectCategory(category);
        }
      },
    };
  }

  function _renderOneRadar(canvasId, scoreField, chartRef) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return chartRef;
    const rawByBank = _rawScoresByBank(scoreField);
    const dynMax = _computeDynamicMax(rawByBank);
    const datasets = buildDatasets(rawByBank, dynMax);
    const chartData = { labels: VOICE_CATEGORIES, datasets };
    // Always recreate so dynMax-based tick/tooltip closures stay fresh
    if (chartRef) { chartRef.destroy(); }
    return new Chart(canvas, { type: "radar", data: chartData, options: buildRadarOptions(dynMax) });
  }

  chartNeg = _renderOneRadar("chart-voice-neg", "negative_pct", chartNeg);
  renderRadarLegend("radar-neg-legend");

  chartPos = _renderOneRadar("chart-voice-pos", "positive_pct", chartPos);
  renderRadarLegend("radar-pos-legend");
}

// ── Category pills ────────────────────────────────────────────────────
function renderCategoryPills() {
  const container = document.getElementById("voice-category-pills");
  if (!container) return;

  container.innerHTML = VOICE_CATEGORIES.map((cat) => {
    const isActive = cat === _selectedCategory;
    const style = isActive
      ? "background:var(--accent);color:#fff;border-color:var(--accent)"
      : "background:#fff;color:var(--text-primary);border-color:var(--border)";
    return `<button
      class="voice-cat-pill"
      data-category="${cat}"
      style="padding:0.3rem 0.8rem;border-radius:999px;border:1.5px solid;font-size:0.8rem;cursor:pointer;transition:all 0.15s;${style}"
    >${cat}</button>`;
  }).join("");

  container.querySelectorAll(".voice-cat-pill").forEach((btn) => {
    btn.addEventListener("click", () => selectCategory(btn.dataset.category));
  });
}

function selectCategory(category) {
  if (_selectedCategory === category) {
    _selectedCategory = null;
    renderCategoryPills();
    hideReviewList();
  } else {
    _selectedCategory = category;
    renderCategoryPills();
    renderReviewList(category);
  }
}

// ── Review list ───────────────────────────────────────────────────────
function renderReviewList(category) {
  const card = document.getElementById("voice-reviews-card");
  const title = document.getElementById("voice-reviews-title");
  const countEl = document.getElementById("voice-reviews-count");
  const tbody = document.getElementById("voice-reviews-tbody");
  const closeBtn = document.getElementById("voice-reviews-close");
  if (!card || !tbody) return;

  const platFilter = _lastFilterState?.platform === "all" ? null : _lastFilterState?.platform;

  let rows = _voiceReviews.filter((r) => {
    if (r.category !== category) return false;
    if (!_selectedRadarBanks.includes(r.bank)) return false;
    if (platFilter && r.platform !== platFilter) return false;
    return true;
  });

  // Sort: negative first (by rating asc), then date desc
  rows = rows.sort((a, b) => {
    if (num(a.rating) !== num(b.rating)) return num(a.rating) - num(b.rating);
    return (b.date || "").localeCompare(a.date || "");
  }).slice(0, 100);

  card.style.display = "block";
  if (title) title.textContent = `「${category}」相關留言`;
  if (countEl) countEl.textContent = `共 ${rows.length} 則`;

  if (closeBtn) {
    closeBtn.onclick = () => {
      _selectedCategory = null;
      renderCategoryPills();
      hideReviewList();
    };
  }

  // Make the table wrapper scrollable (fixed height)
  const tableWrapper = tbody.closest(".overflow-x-auto");
  if (tableWrapper) {
    tableWrapper.style.maxHeight = "480px";
    tableWrapper.style.overflowY = "auto";
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm" style="color:var(--text-secondary)">
      ${_voiceReviews.length === 0 ? "留言資料載入中，請稍後..." : "無符合條件的留言"}
    </td></tr>`;
    return;
  }

  const CATEGORY_COLORS = {
    "登入與認證": "#7c3aed",
    "轉帳與交易": "#0891b2",
    "介面體驗": "#059669",
    "系統穩定性": "#dc2626",
    "客服支援": "#d97706",
    "功能完整性": "#2563eb",
    "速度效能": "#9333ea",
  };

  tbody.innerHTML = rows.map((r) => {
    const rating = num(r.rating);
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const starColor = rating <= 2 ? "#dc2626" : rating === 3 ? "#d97706" : "#16a34a";
    const platformIcon = r.platform === "App Store" ? "🍎" : "🤖";
    const isYuanta = r.bank === YUANTA;
    const catColor = CATEGORY_COLORS[r.category] || "#64748b";
    const reviewText = (r.review || "").trim();
    const short = reviewText.slice(0, 120);
    const expandHtml = reviewText.length > 120
      ? `<details class="inline"><summary style="color:var(--accent);cursor:pointer;font-size:0.75rem;margin-left:0.25rem">展開</summary><span style="color:var(--text-primary)"> ${reviewText.slice(120)}</span></details>`
      : "";

    return `<tr style="background:${isYuanta ? "#fffbeb" : "#ffffff"}">
      <td class="px-3 py-2 text-xs whitespace-nowrap" style="color:var(--text-secondary)">${r.date?.slice(0, 10) || ""}</td>
      <td class="px-3 py-2 text-sm">${platformIcon} <span style="${isYuanta ? "color:var(--accent);font-weight:600" : "color:var(--text-primary)"}">${r.bank}</span></td>
      <td class="px-3 py-2 text-sm whitespace-nowrap" style="color:${starColor}">${stars}</td>
      <td class="px-3 py-2 text-xs whitespace-nowrap">
        <span style="padding:0.15rem 0.5rem;border-radius:999px;border:1.5px solid ${catColor};color:${catColor};font-weight:600;font-size:0.72rem">${r.category}</span>
      </td>
      <td class="px-3 py-2 text-sm max-w-sm" style="color:var(--text-primary)">${short}${expandHtml}</td>
    </tr>`;
  }).join("");
}

function hideReviewList() {
  const card = document.getElementById("voice-reviews-card");
  if (card) card.style.display = "none";
}
