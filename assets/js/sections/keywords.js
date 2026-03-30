// keywords.js — Voice analysis: radar charts (痛點/優勢) + category pills + review list
import { YUANTA, BANK_COLORS, ALL_BANKS } from "../config.js";
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

  // On first render, default to Yuanta + first 4 sidebar-selected competitors
  if (_selectedRadarBanks.length === 0) {
    const competitors = sidebarSelectedBanks
      .filter((b) => b !== YUANTA && availableBanks.includes(b))
      .slice(0, MAX_RADAR_BANKS - 1);
    _selectedRadarBanks = [YUANTA, ...competitors];
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
    return `<button
      class="voice-bank-pill"
      data-bank="${bank}"
      style="padding:0.25rem 0.6rem;border-radius:999px;border:1.5px solid;font-size:0.75rem;font-weight:600;cursor:${isDisabled ? "not-allowed" : "pointer"};transition:all 0.15s;${style}"
      ${isYuanta ? "disabled" : ""}
    >${bank}</button>`;
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

  function buildDatasets(scoreField) {
    return _selectedRadarBanks.map((bank) => {
      const isYuanta = bank === YUANTA;
      const color = BANK_COLORS[bank] || "#94a3b8";
      return {
        label: bank,
        data: getScores(bank, scoreField),
        borderColor: color,
        backgroundColor: color + (isYuanta ? "22" : "10"),
        borderWidth: isYuanta ? 3 : 1.5,
        pointRadius: isYuanta ? 4 : 3,
        pointBackgroundColor: color,
      };
    });
  }

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#64748b", font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, color: "#94a3b8", font: { size: 9 }, backdropColor: "transparent" },
        grid: { color: "#e2e8f0" },
        angleLines: { color: "#e2e8f0" },
        pointLabels: {
          color: "#334155",
          font: { size: 11, weight: "500" },
          callback: (label) => label,
        },
      },
    },
    onClick: (e, elements, chartInstance) => {
      // Detect which category label was clicked via nearest angle
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

  // Negative radar
  const negCanvas = document.getElementById("chart-voice-neg");
  if (negCanvas) {
    const negData = { labels: VOICE_CATEGORIES, datasets: buildDatasets("negative_pct") };
    if (chartNeg) {
      chartNeg.data = negData;
      chartNeg.update();
    } else {
      chartNeg = new Chart(negCanvas, { type: "radar", data: negData, options: radarOptions });
    }
  }

  // Positive radar
  const posCanvas = document.getElementById("chart-voice-pos");
  if (posCanvas) {
    const posData = { labels: VOICE_CATEGORIES, datasets: buildDatasets("positive_pct") };
    if (chartPos) {
      chartPos.data = posData;
      chartPos.update();
    } else {
      chartPos = new Chart(posCanvas, { type: "radar", data: posData, options: radarOptions });
    }
  }
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
