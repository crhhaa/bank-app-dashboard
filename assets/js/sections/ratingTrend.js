// ratingTrend.js — Monthly rating trend line chart
import { YUANTA, BANK_COLORS, ALL_BANKS } from "../config.js";
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

// Compute fractional x index for a release date within the months array.
// e.g. "2025-03-11" in a 31-day March at index 5 → 5 + 10/31 ≈ 5.32
function releaseX(releaseDate, monthIndexMap) {
  if (!releaseDate) return null;
  const ym = releaseDate.slice(0, 7);
  const idx = monthIndexMap[ym];
  if (idx == null) return null;
  const day = parseInt(releaseDate.slice(8, 10), 10);
  const year = parseInt(releaseDate.slice(0, 4), 10);
  const mon = parseInt(releaseDate.slice(5, 7), 10);
  const daysInMonth = new Date(year, mon, 0).getDate();
  return idx + (day - 1) / daysInMonth;
}

export function renderRatingTrend(summaryMonthly, versionImpact, { selectedBanks, platform, dateRange }, metadata) {
  _lastSummaryMonthly = summaryMonthly;
  _lastVersionImpact = versionImpact;
  _lastFilterState = { selectedBanks, platform, dateRange };
  _lastMetadata = metadata;
  const canvas = document.getElementById("chart-rating-trend");
  if (!canvas) return;

  const platFilter = platform === "all" ? null : platform;

  // Filter rows
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

  // Date cutoff from date range filter
  const allMonths = [...new Set(rows.map((r) => r.year_month))].sort();
  const maxDate = allMonths[allMonths.length - 1];
  const cutoff = getDateCutoff(maxDate);

  // Lock start month to 元大's earliest month (prevents showing data before Yuanta exists)
  const yuantaStart = getYuantaEarliestMonth(summaryMonthly);
  const months = allMonths.filter((m) => {
    if (cutoff && m < cutoff) return false;
    if (yuantaStart && m < yuantaStart) return false;
    return true;
  });

  // Map month string → integer index for x positioning
  const monthIndexMap = Object.fromEntries(months.map((m, i) => [m, i]));

  // Build datasets — stable order based on ALL_BANKS index
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

    // Stable order: use ALL_BANKS index so legend never jumps
    const stableOrder = ALL_BANKS.indexOf(bank);

    return {
      label: bank,
      // Use { x: index, y: value } so the linear x-axis positions correctly
      data: months.map((m, i) => byMonth[m] ? { x: i, y: num(byMonth[m].avg_rating) } : null),
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

  // Yuanta review volume as bar dataset
  const yuantaRows = rows.filter((r) => r.bank === YUANTA);
  const yuantaByMonth = {};
  yuantaRows.forEach((r) => { yuantaByMonth[r.year_month] = r; });

  datasets.push({
    label: "元大評論量",
    type: "bar",
    data: months.map((m, i) => ({ x: i, y: yuantaByMonth[m] ? num(yuantaByMonth[m].review_count) : 0 })),
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderColor: "rgba(249, 115, 22, 0.3)",
    borderWidth: 1,
    yAxisID: "y2",
    order: 999,
  });

  // Build version release markers (iOS only — App Store has full historical version history)
  // One triangle per release, positioned with intra-month precision using fractional x index.
  const allMarkers = [];
  banks.forEach((bank) => {
    if (!versionImpact) return;
    const bankColor = BANK_COLORS[bank] || "#94a3b8";
    const releases = versionImpact.filter(
      (r) => r.bank === bank && r.platform === "App Store" && r.release_date
    );
    releases.forEach((r) => {
      // Only show releases within the visible month range
      const ym = r.release_date.slice(0, 7);
      if (!monthIndexMap.hasOwnProperty(ym)) return;
      // Apply same cutoff as line data
      if (cutoff && r.release_date < cutoff) return;

      const x = releaseX(r.release_date, monthIndexMap);
      if (x == null) return;

      const delta = r.rating_delta ? num(r.rating_delta) : null;
      const y = r.post_release_avg_rating
        ? num(r.post_release_avg_rating)
        : (monthIndexMap[ym] != null ? null : null); // fallback: skip if no y

      if (y == null || isNaN(y)) return;

      allMarkers.push({
        x,
        y,
        bank,
        bankColor,
        releaseDate: r.release_date,
        version: r.version || "—",
        delta,
        color: delta !== null ? (delta > 0.05 ? "#16a34a" : delta < -0.05 ? "#dc2626" : "#94a3b8") : "#94a3b8",
        rotation: delta !== null && delta < -0.05 ? 180 : 0,
      });
    });
  });

  // Sort markers by x so tooltip indices are stable
  allMarkers.sort((a, b) => a.x - b.x);

  if (allMarkers.length > 0) {
    datasets.push({
      label: "版本發布",
      type: "scatter",
      data: allMarkers.map((p) => ({ x: p.x, y: p.y })),
      pointStyle: "triangle",
      pointRadius: 9,
      pointHoverRadius: 11,
      pointBackgroundColor: allMarkers.map((p) => p.color),
      pointRotation: allMarkers.map((p) => p.rotation),
      borderWidth: 0,
      showLine: false,
      order: 0,
    });
  }

  const config = {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            color: "#64748b", font: { size: 11 }, boxWidth: 12,
          },
          onClick: (e, legendItem) => {
            const label = legendItem.text;
            if (label === "元大評論量" || label === YUANTA || label === "版本發布") return;
            if (highlightedBanks.has(label)) {
              highlightedBanks.delete(label);
            } else {
              highlightedBanks.add(label);
            }
            renderRatingTrend(_lastSummaryMonthly, _lastVersionImpact, _lastFilterState, _lastMetadata);
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              // Show the month label for non-marker items; for markers show release date
              const firstItem = items[0];
              if (!firstItem) return "";
              // Find if any item is a version marker
              const markerItem = items.find((it) => it.dataset.label === "版本發布");
              if (markerItem) {
                const p = allMarkers[markerItem.dataIndex];
                return p ? p.releaseDate : "";
              }
              const idx = Math.round(firstItem.parsed.x);
              return months[idx] || "";
            },
            label: (ctx) => {
              if (ctx.dataset.label === "版本發布") {
                const p = allMarkers[ctx.dataIndex];
                if (!p) return null;
                const sign = p.delta > 0 ? "+" : "";
                const deltaStr = p.delta != null ? ` (Δ${sign}${p.delta.toFixed(2)})` : "";
                return ` [${p.bank}] v${p.version}${deltaStr}`;
              }
              if (ctx.dataset.label === "元大評論量")
                return ` 評論量: ${ctx.raw?.y ?? ctx.raw}`;
              const val = ctx.raw?.y ?? ctx.raw;
              return ` ${ctx.dataset.label}: ${typeof val === "number" ? val.toFixed(2) : "—"}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: -0.5,
          max: months.length - 0.001,
          ticks: {
            stepSize: 1,
            callback: (val) => {
              if (!Number.isInteger(val)) return "";
              return (val >= 0 && val < months.length) ? months[val] : "";
            },
            color: "#94a3b8",
            maxRotation: 45,
            font: { size: 10 },
          },
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
  };

  if (chart) {
    chart.data = config.data;
    chart.options = config.options;
    chart.update();
  } else {
    chart = new Chart(canvas, config);
  }

  // Update subtitle with data start date
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
