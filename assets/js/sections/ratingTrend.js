// ratingTrend.js — Monthly rating trend line chart
import { YUANTA, BANK_COLORS, ALL_BANKS, BANK_LOGOS } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

let chart = null;
let highlightedBanks = new Set(); // extra highlighted banks (Yuanta is always bright)
let _lastSummaryMonthly = null;
let _lastVersionImpact = null;
let _lastFilterState = null;
let _lastMetadata = null;

// Compute 元大's earliest year_month from summaryMonthly
function getYuantaEarliestMonth(summaryMonthly) {
  const months = summaryMonthly
    .filter((r) => r.bank === YUANTA && r.year_month)
    .map((r) => r.year_month)
    .sort();
  return months[0] || null;
}

function renderHtmlLegend(banks) {
  const container = document.getElementById("trend-legend");
  if (!container) return;

  const hasHighlight = highlightedBanks.size > 0;

  container.innerHTML = banks.map(bank => {
    const color = BANK_COLORS[bank] || "#94a3b8";
    const logoUrl = BANK_LOGOS[bank] || "";
    const isYuanta = bank === YUANTA;
    const isHighlighted = isYuanta || highlightedBanks.has(bank);
    const dimmed = hasHighlight && !isHighlighted;

    return `<span class="trend-legend-item" data-bank="${bank}"
      style="display:inline-flex;align-items:center;gap:3px;
             padding:2px 6px;border-radius:4px;font-size:11px;
             color:#64748b;user-select:none;
             cursor:${isYuanta ? "default" : "pointer"};
             opacity:${dimmed ? 0.3 : 1};
             font-weight:${isHighlighted && !isYuanta ? 600 : 400};
             border-bottom:2px solid ${color};">
      <img src="${logoUrl}" width="13" height="13"
           style="object-fit:contain;border-radius:2px;"
           onerror="this.style.display='none'">
      ${bank}
    </span>`;
  }).join("");

  container.querySelectorAll(".trend-legend-item").forEach(el => {
    const bank = el.dataset.bank;
    if (bank === YUANTA) return;
    el.addEventListener("click", () => {
      if (highlightedBanks.has(bank)) {
        highlightedBanks.delete(bank);
      } else {
        highlightedBanks.add(bank);
      }
      renderRatingTrend(_lastSummaryMonthly, _lastVersionImpact, _lastFilterState, _lastMetadata);
    });
  });
}

export function renderRatingTrend(summaryMonthly, versionImpact, { selectedBanks, platform, dateRange }, metadata) {
  _lastSummaryMonthly = summaryMonthly;
  _lastVersionImpact = versionImpact;
  _lastFilterState = { selectedBanks, platform, dateRange };
  _lastMetadata = metadata;
  const canvas = document.getElementById("chart-rating-trend");
  if (!canvas) return;

  const platFilter = platform === "all" ? null : platform;

  // Filter rows by selected banks + platform
  let rows = summaryMonthly.filter((r) => {
    if (!selectedBanks.includes(r.bank)) return false;
    if (platFilter && r.platform !== platFilter) return false;
    return true;
  });

  // If "all" platforms, average iOS + Android for each bank/month
  if (!platFilter) {
    const grouped = {};
    rows.forEach((r) => {
      const key = `${r.bank}||${r.year_month}`;
      if (!grouped[key]) {
        grouped[key] = { bank: r.bank, year_month: r.year_month, ratings: [], counts: [] };
      }
      grouped[key].ratings.push(num(r.avg_rating));
      grouped[key].counts.push(num(r.review_count));
    });
    rows = Object.values(grouped).map((g) => {
      const totalCount = g.counts.reduce((a, b) => a + b, 0);
      return {
        bank: g.bank,
        year_month: g.year_month,
        avg_rating: totalCount > 0
          ? g.ratings.reduce((s, r, i) => s + r * g.counts[i], 0) / totalCount
          : g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length,
        review_count: totalCount,
      };
    });
  }

  // Build months axis from ALL platforms — keeps x-axis labels stable across iOS/Android switches
  const allPlatformRows = summaryMonthly.filter((r) => selectedBanks.includes(r.bank));
  const allMonths = [...new Set(allPlatformRows.map((r) => r.year_month))].sort();
  const maxDate = allMonths[allMonths.length - 1];
  const cutoff = getDateCutoff(maxDate);

  const yuantaStart = getYuantaEarliestMonth(summaryMonthly);
  const months = allMonths.filter((m) => {
    if (cutoff && m < cutoff) return false;
    if (yuantaStart && m < yuantaStart) return false;
    return true;
  });

  if (months.length === 0) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  // Build datasets using positional (category) data — no explicit x values
  const banks = selectedBanks;
  const datasets = banks.map((bank) => {
    const bankRows = rows.filter((r) => r.bank === bank);
    const byMonth = {};
    bankRows.forEach((r) => { byMonth[r.year_month] = r; });

    const isYuanta = bank === YUANTA;
    const hasExtraHighlight = highlightedBanks.size > 0;
    const isFocused = isYuanta || highlightedBanks.has(bank);
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

    const stableOrder = ALL_BANKS.indexOf(bank);

    return {
      label: bank,
      data: months.map((m) => byMonth[m] ? num(byMonth[m].avg_rating) : null),
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

  // Yuanta review volume bar
  const yuantaRows = rows.filter((r) => r.bank === YUANTA);
  const yuantaByMonth = {};
  yuantaRows.forEach((r) => { yuantaByMonth[r.year_month] = r; });

  datasets.push({
    label: "元大評論量",
    type: "bar",
    data: months.map((m) => yuantaByMonth[m] ? num(yuantaByMonth[m].review_count) : 0),
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderColor: "rgba(249, 115, 22, 0.3)",
    borderWidth: 1,
    yAxisID: "y2",
    order: 999,
  });

  if (chart) {
    chart.data.labels = months;
    chart.data.datasets = datasets;
    chart.update();
    renderHtmlLegend(banks);
  } else {
    chart = new Chart(canvas, {
      type: "line",
      data: { labels: months, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label || "",
              label: (ctx) => {
                if (ctx.dataset.label === "元大評論量")
                  return ` 評論量: ${ctx.raw}`;
                const val = ctx.raw;
                return ` ${ctx.dataset.label}: ${typeof val === "number" ? val.toFixed(2) : "—"}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "category",
            ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 10 } },
            grid: { color: "#f1f5f9" },
          },
          y: {
            min: 1,
            max: 5,
            ticks: { color: "#94a3b8", font: { size: 11 } },
            grid: { color: "#f1f5f9" },
            title: { display: true, text: "平均評分", color: "#94a3b8" },
          },
          y2: {
            position: "right",
            ticks: { color: "#94a3b8", font: { size: 10 } },
            grid: { display: false },
            title: { display: true, text: "評論數", color: "#94a3b8" },
          },
        },
      },
    });
  }

  renderHtmlLegend(banks);

  // Update subtitle
  const noteEl = document.getElementById("trend-data-note");
  if (noteEl) {
    const startDate = metadata && metadata[0] && metadata[0].yuanta_data_start_date
      ? metadata[0].yuanta_data_start_date
      : yuantaStart || "";
    noteEl.textContent = startDate
      ? `📅 資料起始日期：${startDate}（元大銀行上線後）`
      : "";
  }

  // Show/hide cancel button
  const cancelBtn = document.getElementById("btn-cancel-trend");
  if (cancelBtn) {
    cancelBtn.style.display = highlightedBanks.size > 0 ? "inline-block" : "none";
    cancelBtn.onclick = () => {
      highlightedBanks.clear();
      renderRatingTrend(_lastSummaryMonthly, _lastVersionImpact, _lastFilterState, _lastMetadata);
    };
  }
}
