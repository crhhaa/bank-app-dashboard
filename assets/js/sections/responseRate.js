// responseRate.js — Developer response rate and speed
import { YUANTA, BANK_COLORS, ALL_BANKS, BANK_LOGOS } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

let chartRate = null;
let chartSpeed = null;
let highlightedSpeedBanks = new Set();
let _lastSummaryBank = null;
let _lastSummaryMonthly = null;
let _lastFilterState = null;
let _lastMetadata = null;

// Get 元大's earliest year_month from summaryMonthly
function getYuantaEarliestMonth(summaryMonthly) {
  const months = summaryMonthly
    .filter((r) => r.bank === YUANTA && r.year_month)
    .map((r) => r.year_month)
    .sort();
  return months[0] || null;
}

export function renderResponseRate(summaryBank, summaryMonthly, { selectedBanks, platform, dateRange }, metadata) {
  _lastSummaryBank = summaryBank;
  _lastSummaryMonthly = summaryMonthly;
  _lastFilterState = { selectedBanks, platform, dateRange };
  _lastMetadata = metadata;
  renderRateBar(summaryMonthly, selectedBanks, platform, dateRange);
  renderSpeedLine(summaryMonthly, selectedBanks, platform, dateRange, metadata);
}

function renderRateBar(summaryMonthly, selectedBanks, platform, dateRange) {
  const canvas = document.getElementById("chart-response-rate");
  if (!canvas) return;

  const platFilter = platform === "all" ? null : platform;
  let rows = summaryMonthly.filter((r) => selectedBanks.includes(r.bank));
  if (platFilter) rows = rows.filter((r) => r.platform === platFilter);

  // Apply date range
  const allMonths = [...new Set(rows.map((r) => r.year_month))].sort();
  const maxDate = allMonths[allMonths.length - 1];
  const cutoff = getDateCutoff(maxDate);
  if (cutoff) rows = rows.filter((r) => r.year_month >= cutoff);

  // Aggregate per bank
  const bankMap = {};
  rows.forEach((r) => {
    if (!bankMap[r.bank]) bankMap[r.bank] = { reply: 0, total: 0 };
    bankMap[r.bank].reply += num(r.reply_count);
    bankMap[r.bank].total += num(r.review_count);
  });

  const sorted = Object.entries(bankMap)
    .map(([bank, g]) => ({ bank, reply_rate: g.total > 0 ? g.reply / g.total : 0 }))
    .sort((a, b) => b.reply_rate - a.reply_rate);

  const labels = sorted.map((r) => r.bank);
  const data = sorted.map((r) => +(r.reply_rate * 100).toFixed(1));
  const colors = sorted.map((r) => r.bank === YUANTA ? "#f97316" : "#cbd5e1");
  const borderColors = sorted.map((r) => r.bank === YUANTA ? "#ea580c" : "#94a3b8");
  const borderWidths = sorted.map((r) => r.bank === YUANTA ? 3 : 1);

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "回覆率 (%)",
        data,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw}%` } },
      },
      scales: {
        x: {
          min: 0, max: 100,
          ticks: { color: "#94a3b8", callback: (v) => v + "%" },
          grid: { color: "#f1f5f9" },
        },
        y: {
          ticks: {
            color: (ctx) => sorted[ctx.index]?.bank === YUANTA ? "#f97316" : "#64748b",
            font: { size: 11 },
          },
          grid: { display: false },
        },
      },
    },
  };

  if (chartRate) {
    chartRate.data = config.data;
    chartRate.options = config.options;
    chartRate.update();
  } else {
    chartRate = new Chart(canvas, config);
  }
}

function renderSpeedLine(summaryMonthly, selectedBanks, platform, dateRange, metadata) {
  const canvas = document.getElementById("chart-response-speed");
  if (!canvas) return;

  const platFilter = platform === "all" ? null : platform;
  let rows = summaryMonthly.filter((r) => {
    if (!selectedBanks.includes(r.bank)) return false;
    if (platFilter && r.platform !== platFilter) return false;
    if (!r.avg_reply_days || num(r.avg_reply_days) <= 0) return false;
    return true;
  });

  const allMonths = [...new Set(rows.map((r) => r.year_month))].sort();
  const maxDate = allMonths[allMonths.length - 1];
  const cutoff = getDateCutoff(maxDate);
  const yuantaStart = getYuantaEarliestMonth(summaryMonthly);
  const months = allMonths.filter((m) => {
    if (cutoff && m < cutoff) return false;
    if (yuantaStart && m < yuantaStart) return false;
    return true;
  });

  // If all platforms, average per bank/month
  if (!platFilter) {
    const grouped = {};
    rows.forEach((r) => {
      const key = `${r.bank}||${r.year_month}`;
      if (!grouped[key]) grouped[key] = { bank: r.bank, year_month: r.year_month, vals: [] };
      if (num(r.avg_reply_days) > 0) grouped[key].vals.push(num(r.avg_reply_days));
    });
    rows = Object.values(grouped)
      .filter((g) => g.vals.length)
      .map((g) => ({
        bank: g.bank,
        year_month: g.year_month,
        avg_reply_days: g.vals.reduce((a, b) => a + b, 0) / g.vals.length,
      }));
  }

  const datasets = selectedBanks.map((bank) => {
    const bankRows = rows.filter((r) => r.bank === bank);
    const byMonth = {};
    bankRows.forEach((r) => { byMonth[r.year_month] = r; });
    const isYuanta = bank === YUANTA;
    const hasExtraHighlight = highlightedSpeedBanks.size > 0;
    const isFocused = isYuanta || highlightedSpeedBanks.has(bank);
    const baseColor = BANK_COLORS[bank] || "#94a3b8";

    let borderColor, borderWidth, pointRadius, pointHoverRadius;
    if (hasExtraHighlight) {
      borderColor = isFocused ? baseColor : baseColor + "18";
      borderWidth = isFocused ? (isYuanta ? 4 : 3) : 1;
      pointRadius = isFocused ? 5 : 0;
      pointHoverRadius = isFocused ? 6 : 2;
    } else {
      borderColor = isYuanta ? baseColor : baseColor + "30";
      borderWidth = isYuanta ? 4 : 1;
      pointRadius = isYuanta ? 5 : 0;
      pointHoverRadius = isYuanta ? 6 : 3;
    }

    // Stable order: use ALL_BANKS index
    const stableOrder = ALL_BANKS.indexOf(bank);

    return {
      label: bank,
      data: months.map((m) => byMonth[m] ? num(byMonth[m].avg_reply_days) : null),
      borderColor,
      backgroundColor: "transparent",
      borderWidth,
      pointRadius,
      pointHoverRadius,
      tension: 0.3,
      spanGaps: true,
      order: stableOrder >= 0 ? stableOrder + 1 : 99,
    };
  });

  // Benchmark line at 3 days — render behind all bank lines
  datasets.push({
    label: "3天基準線",
    data: months.map(() => 3),
    borderColor: "#ef4444",
    borderWidth: 1,
    borderDash: [6, 4],
    pointRadius: 0,
    tension: 0,
    order: 999,
  });

  const config = {
    type: "line",
    data: { labels: months, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw != null && ctx.raw > 0 ? ctx.raw.toFixed(1) + " 天" : "—"}` } },
      },
      scales: {
        x: { ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 10 } }, grid: { color: "#f1f5f9" } },
        y: {
          min: 0,
          ticks: { color: "#94a3b8" },
          grid: { color: "#f1f5f9" },
          title: { display: true, text: "平均回覆天數", color: "#94a3b8" },
        },
      },
    },
  };

  if (chartSpeed) {
    chartSpeed.data = config.data;
    chartSpeed.options = config.options;
    chartSpeed.update();
  } else {
    chartSpeed = new Chart(canvas, config);
  }

  // Render custom HTML legend
  const legendContainer = document.getElementById("speed-legend");
  if (legendContainer) {
    const hasHighlight = highlightedSpeedBanks.size > 0;
    legendContainer.innerHTML = selectedBanks.map(bank => {
      const color = BANK_COLORS[bank] || "#94a3b8";
      const logoSrc = BANK_LOGOS[bank] || "";
      const isYuanta = bank === YUANTA;
      const isHighlighted = isYuanta || highlightedSpeedBanks.has(bank);
      const dimmed = hasHighlight && !isHighlighted;
      return `<span class="speed-legend-item" data-bank="${bank}"
        style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;
               font-size:11px;color:#64748b;user-select:none;
               cursor:${isYuanta ? "default" : "pointer"};
               opacity:${dimmed ? 0.3 : 1};
               font-weight:${isHighlighted && !isYuanta ? 600 : 400};
               border-bottom:2px solid ${color};">
        <img src="${logoSrc}" width="13" height="13" style="object-fit:contain;border-radius:2px;" onerror="this.style.display='none'">
        ${bank}
      </span>`;
    }).join("") + `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;font-size:11px;color:#ef4444;border-bottom:2px dashed #ef4444;">3天基準線</span>`;

    legendContainer.querySelectorAll(".speed-legend-item").forEach(el => {
      const bank = el.dataset.bank;
      if (bank === YUANTA) return;
      el.addEventListener("click", () => {
        if (highlightedSpeedBanks.has(bank)) {
          highlightedSpeedBanks.delete(bank);
        } else {
          highlightedSpeedBanks.add(bank);
        }
        renderSpeedLine(_lastSummaryMonthly, _lastFilterState.selectedBanks, _lastFilterState.platform, _lastFilterState.dateRange, _lastMetadata);
      });
    });
  }

  // Update subtitle with data start date
  const noteEl = document.getElementById("speed-data-note");
  if (noteEl) {
    const startDate = metadata && metadata[0] && metadata[0].yuanta_data_start_date
      ? metadata[0].yuanta_data_start_date
      : yuantaStart || "";
    noteEl.textContent = startDate
      ? `📅 資料起始日期：${startDate}（元大銀行上線後）`
      : "";
  }

  // Show/hide cancel button
  const cancelBtn = document.getElementById("btn-cancel-speed");
  if (cancelBtn) {
    cancelBtn.style.display = highlightedSpeedBanks.size > 0 ? "inline-block" : "none";
    cancelBtn.onclick = () => {
      highlightedSpeedBanks.clear();
      renderSpeedLine(_lastSummaryMonthly, _lastFilterState.selectedBanks, _lastFilterState.platform, _lastFilterState.dateRange, _lastMetadata);
    };
  }
}
