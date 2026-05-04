// platformCompare.js — Competitive ranking matrix
import { YUANTA, BANK_COLORS, ALL_BANKS } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

let chartIos = null;
let chartAndroid = null;

// Compute weighted avg_rating per bank for a given platform from summaryMonthly,
// respecting the current dateRange via getDateCutoff.
function computeBankStats(summaryMonthly, selectedBanks, targetPlatform) {
  // targetPlatform = "App Store" | "Google Play" | null (= all platforms combined)
  let rows = summaryMonthly.filter((r) => selectedBanks.includes(r.bank));
  if (targetPlatform) rows = rows.filter((r) => r.platform === targetPlatform);

  const allMonths = [...new Set(rows.map((r) => r.year_month))].sort();
  const maxDate = allMonths[allMonths.length - 1];
  const cutoff = getDateCutoff(maxDate);
  if (cutoff) rows = rows.filter((r) => r.year_month >= cutoff);

  const grouped = {};
  rows.forEach((r) => {
    if (!grouped[r.bank]) grouped[r.bank] = { weight: 0, count: 0 };
    const cnt = num(r.review_count);
    grouped[r.bank].weight += num(r.avg_rating) * cnt;
    grouped[r.bank].count += cnt;
  });

  return Object.entries(grouped).map(([bank, g]) => ({
    bank,
    avg_rating: g.count > 0 ? g.weight / g.count : 0,
    total_reviews: g.count,
  }));
}

function buildRankingChart(canvasId, stats, platformLabel, existingChart) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return existingChart;

  const sorted = [...stats].sort((a, b) => num(b.avg_rating) - num(a.avg_rating));

  const labels = sorted.map((r) => r.bank);
  const data = sorted.map((r) => num(r.avg_rating));
  const colors = sorted.map((r) => r.bank === YUANTA ? "#f97316" : "#cbd5e1");
  const borderColors = sorted.map((r) => r.bank === YUANTA ? "#ea580c" : "#94a3b8");
  const borderWidths = sorted.map((r) => r.bank === YUANTA ? 3 : 1);

  const yuantaIdx = sorted.findIndex((r) => r.bank === YUANTA);
  const yuantaLabelPlugin = {
    id: "yuantaLabel_" + canvasId,
    afterDraw(chart) {
      if (yuantaIdx < 0) return;
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      const bar = meta.data[yuantaIdx];
      if (!bar) return;
      ctx.save();
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${data[yuantaIdx].toFixed(2)} ★`, bar.x + 5, bar.y + 4);
      ctx.restore();
    },
  };

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: `${platformLabel} 評論均分`,
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
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw.toFixed(2)} / 5` } },
      },
      scales: {
        x: {
          min: 1, max: 5,
          ticks: { color: "#94a3b8", font: { size: 11 } },
          grid: { color: "#f1f5f9" },
        },
        y: {
          ticks: {
            color: (ctx) => sorted[ctx.index]?.bank === YUANTA ? "#f97316" : "#64748b",
            font: (ctx) => sorted[ctx.index]?.bank === YUANTA ? { size: 12, weight: "bold" } : { size: 11 },
          },
          grid: { display: false },
        },
      },
    },
    plugins: [yuantaLabelPlugin],
  };

  if (existingChart) {
    existingChart.data = config.data;
    existingChart.options = config.options;
    existingChart.update();
    return existingChart;
  }
  return new Chart(canvas, config);
}

export function renderPlatformCompare(summaryBank, summaryMonthly, { selectedBanks, platform, dateRange }) {
  // Bar charts always show per-platform rankings (iOS and Android separately)
  const iosStats = computeBankStats(summaryMonthly, selectedBanks, "App Store");
  const androidStats = computeBankStats(summaryMonthly, selectedBanks, "Google Play");
  chartIos = buildRankingChart("chart-rank-ios", iosStats, "App Store", chartIos);
  chartAndroid = buildRankingChart("chart-rank-android", androidStats, "Google Play", chartAndroid);

  // Delta table removed per user request
}

function buildDeltaTable(stats, selectedBanks, platform) {
  const tbody = document.getElementById("delta-table-body");
  if (!tbody) return;

  // Update table title dynamically
  const titleEl = document.getElementById("delta-table-title");
  if (titleEl) {
    titleEl.textContent = platform === "App Store" ? "排名（App Store）"
      : platform === "Google Play" ? "排名（Google Play）"
      : "綜合排名 (iOS + Android)";
  }

  const sorted = [...stats].sort((a, b) => num(b.avg_rating) - num(a.avg_rating));
  const yuantaRating = num(sorted.find((r) => r.bank === YUANTA)?.avg_rating || 0);

  tbody.innerHTML = sorted
    .map((r, i) => {
      const gap = (num(r.avg_rating) - yuantaRating).toFixed(2);
      const gapColor = r.bank === YUANTA
        ? "color:var(--accent)"
        : parseFloat(gap) > 0 ? "color:#dc2626" : "color:#16a34a";
      const gapStr = r.bank === YUANTA ? "—" : (parseFloat(gap) > 0 ? "+" : "") + gap;
      const isYuanta = r.bank === YUANTA;
      return `<tr style="background:${isYuanta ? "#fff7ed" : ""}">
        <td class="px-3 py-2 text-sm" style="color:var(--text-secondary)">${i + 1}</td>
        <td class="px-3 py-2 text-sm" style="${isYuanta ? "color:var(--accent);font-weight:600" : "color:var(--text-primary)"}">${r.bank}</td>
        <td class="px-3 py-2 text-sm text-right" style="color:var(--text-primary)">${num(r.avg_rating).toFixed(2)}</td>
        <td class="px-3 py-2 text-sm text-right" style="color:var(--text-secondary)">${r.total_reviews}</td>
        <td class="px-3 py-2 text-sm text-right font-medium" style="${gapColor}">${gapStr}</td>
      </tr>`;
    })
    .join("");
}
