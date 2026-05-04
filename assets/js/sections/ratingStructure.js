// ratingStructure.js — Monthly rating structure: absolute counts & proportion trend by star (1-5★)
import { YUANTA } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

// Muted diverging spectrum: dark red → coral → gold → sage → forest green
const STAR_COLORS = {
  1: "#c0392b",
  2: "#e07850",
  3: "#d4a017",
  4: "#4caf7d",
  5: "#1e8449",
};

// Semi-transparent fills for the line chart
const STAR_FILL = {
  1: "#c0392b28",
  2: "#e0785028",
  3: "#d4a01728",
  4: "#4caf7d28",
  5: "#1e844928",
};

let _reviews = [];
let _filterState = null;
let _selectedBank = YUANTA;
let _chartAbs = null;
let _chartPct = null;

export function initRatingStructure(reviews) {
  _reviews = reviews || [];
  if (_filterState) _render();
}

export function renderRatingStructure(filterState) {
  _filterState = filterState;
  if (!filterState.selectedBanks.includes(_selectedBank)) {
    _selectedBank = filterState.selectedBanks[0] || YUANTA;
  }
  _renderBankSelect(filterState.selectedBanks);
  _render();
}

function _renderBankSelect(availableBanks) {
  const sel = document.getElementById("rating-structure-bank-select");
  if (!sel) return;
  sel.innerHTML = availableBanks
    .map((b) => `<option value="${b}" ${b === _selectedBank ? "selected" : ""}>${b}</option>`)
    .join("");
  sel.value = _selectedBank;
  sel.onchange = () => {
    _selectedBank = sel.value;
    _render();
  };
}

function _render() {
  const placeholder = document.getElementById("rating-structure-placeholder");

  if (!_reviews.length) {
    if (placeholder) placeholder.style.display = "flex";
    return;
  }
  if (placeholder) placeholder.style.display = "none";

  const { platform } = _filterState || {};
  const platFilter = platform === "all" ? null : platform;

  const allMonths = _reviews
    .filter((r) => r.bank === _selectedBank && r.date)
    .map((r) => r.date.slice(0, 7))
    .filter(Boolean)
    .sort();
  const maxMonth = allMonths[allMonths.length - 1];
  const cutoff = maxMonth ? getDateCutoff(maxMonth) : null;

  const rows = _reviews.filter((r) => {
    if (r.bank !== _selectedBank) return false;
    if (platFilter && r.platform !== platFilter) return false;
    if (cutoff && r.date && r.date.slice(0, 7) < cutoff) return false;
    return true;
  });

  const monthStarMap = {};
  for (const r of rows) {
    const month = (r.date || "").slice(0, 7);
    if (!month) continue;
    const star = num(r.rating);
    if (star < 1 || star > 5) continue;
    if (!monthStarMap[month]) monthStarMap[month] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    monthStarMap[month][star]++;
  }

  const months = Object.keys(monthStarMap).sort();
  if (!months.length) return;

  _renderSummaryStrip(months, monthStarMap);
  _renderAbsChart(months, monthStarMap);
  _renderPctChart(months, monthStarMap);
}

// ── Latest-month summary bar ──────────────────────────────────────────

function _renderSummaryStrip(months, monthStarMap) {
  const el = document.getElementById("rating-structure-summary");
  if (!el) return;

  const latestMonth = months[months.length - 1];
  const counts = monthStarMap[latestMonth];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const segments = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star] || 0,
    pct: total > 0 ? (counts[star] || 0) / total * 100 : 0,
  }));

  const barHtml = segments.map(({ star, pct }) =>
    pct > 0
      ? `<div style="flex:${pct.toFixed(2)};background:${STAR_COLORS[star]};transition:flex 0.3s" title="${star}★ ${pct.toFixed(1)}%"></div>`
      : ""
  ).join("");

  const pillsHtml = [1, 2, 3, 4, 5].map((star) => {
    const { pct, count } = segments.find((s) => s.star === star);
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem">
      <span style="width:9px;height:9px;border-radius:2px;background:${STAR_COLORS[star]};flex-shrink:0"></span>
      <span style="color:var(--text-secondary)">${star}★</span>
      <strong style="color:var(--text-primary);font-weight:600">${pct.toFixed(1)}%</strong>
      <span style="color:var(--text-secondary);font-size:0.7rem">(${count})</span>
    </span>`;
  }).join("");

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem">
      <span style="font-size:0.72rem;color:var(--text-secondary);white-space:nowrap;flex-shrink:0">最新月份 ${latestMonth}</span>
      <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;flex:1;gap:1px">${barHtml}</div>
      <span style="font-size:0.72rem;color:var(--text-secondary);white-space:nowrap;flex-shrink:0">共 ${total} 則</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem 1.2rem">${pillsHtml}</div>
  `;
}

// ── Absolute count stacked bar ────────────────────────────────────────

function _renderAbsChart(months, monthStarMap) {
  const canvas = document.getElementById("chart-rating-structure-abs");
  if (!canvas) return;

  const datasets = [5, 4, 3, 2, 1].map((star) => ({
    label: `${star}★`,
    data: months.map((m) => monthStarMap[m][star] || 0),
    backgroundColor: STAR_COLORS[star],
    borderColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderSkipped: false,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        reverse: true,
        labels: {
          color: "#475569",
          font: { size: 11 },
          padding: 14,
          usePointStyle: true,
          pointStyle: "rect",
        },
      },
      tooltip: {
        mode: "index",
        backgroundColor: "rgba(15,23,42,0.85)",
        titleColor: "#e2e8f0",
        bodyColor: "#cbd5e1",
        padding: 10,
        callbacks: {
          title: (items) => `📅 ${items[0]?.label}`,
          label: (ctx) => {
            const total = ctx.chart.data.datasets.reduce(
              (s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0
            );
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : "0.0";
            return `  ${ctx.dataset.label}  ${ctx.raw} 則  (${pct}%)`;
          },
          footer: (items) => {
            const total = items.reduce((s, i) => s + (i.raw || 0), 0);
            return `合計: ${total} 則`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 10 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { precision: 0, color: "#94a3b8", font: { size: 11 } },
        grid: { color: "#f1f5f9" },
        border: { display: false },
        title: { display: true, text: "評論數", color: "#94a3b8", font: { size: 11 } },
      },
    },
  };

  if (_chartAbs) {
    _chartAbs.data = { labels: months, datasets };
    _chartAbs.options = options;
    _chartAbs.update("none");
  } else {
    _chartAbs = new Chart(canvas, { type: "bar", data: { labels: months, datasets }, options });
  }
}

// ── Proportion line chart ─────────────────────────────────────────────

function _renderPctChart(months, monthStarMap) {
  const canvas = document.getElementById("chart-rating-structure-pct");
  if (!canvas) return;

  // Line per star: easy to see each rating's trend over time
  const datasets = [1, 2, 3, 4, 5].map((star) => ({
    label: `${star}★`,
    data: months.map((m) => {
      const total = Object.values(monthStarMap[m]).reduce((a, b) => a + b, 0);
      return total > 0 ? +((monthStarMap[m][star] || 0) / total * 100).toFixed(1) : 0;
    }),
    borderColor: STAR_COLORS[star],
    backgroundColor: STAR_FILL[star],
    borderWidth: 2,
    pointRadius: 3.5,
    pointHoverRadius: 6,
    pointBackgroundColor: STAR_COLORS[star],
    tension: 0.35,
    fill: false,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: "#475569",
          font: { size: 11 },
          padding: 14,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        mode: "index",
        backgroundColor: "rgba(15,23,42,0.85)",
        titleColor: "#e2e8f0",
        bodyColor: "#cbd5e1",
        padding: 10,
        callbacks: {
          title: (items) => `📅 ${items[0]?.label}`,
          label: (ctx) => `  ${ctx.dataset.label}  ${ctx.raw.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 10 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#94a3b8",
          font: { size: 11 },
          callback: (v) => v + "%",
        },
        grid: { color: "#f1f5f9" },
        border: { display: false },
        title: { display: true, text: "佔比 (%)", color: "#94a3b8", font: { size: 11 } },
      },
    },
  };

  if (_chartPct) {
    _chartPct.data = { labels: months, datasets };
    _chartPct.options = options;
    _chartPct.update("none");
  } else {
    _chartPct = new Chart(canvas, { type: "line", data: { labels: months, datasets }, options });
  }
}
