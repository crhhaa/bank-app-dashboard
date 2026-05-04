// complaintTimeline.js — Monthly complaint volume timeline with version markers
import { YUANTA, ALL_BANKS } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

let chart = null;
let allReviews = null;

export function initComplaintTimeline(reviews) {
  allReviews = reviews;
}

export function renderComplaintTimeline(versionImpact, filterState) {
  _initBankSelect(versionImpact, filterState.selectedBanks);
  _renderChart(versionImpact, filterState.platform);
}

function _initBankSelect(versionImpact, selectedBanks) {
  const sel = document.getElementById("complaint-bank-select");
  if (!sel) return;

  const banksInFilter = selectedBanks && selectedBanks.length ? selectedBanks : [YUANTA];
  const ordered = [YUANTA, ...ALL_BANKS.filter((b) => b !== YUANTA && banksInFilter.includes(b))];
  const opts = ordered.filter((b) => banksInFilter.includes(b));

  // Only repopulate if bank list changed
  const newKey = opts.join(",");
  if (sel.dataset.bankKey === newKey) return;

  const prev = sel.value;
  sel.innerHTML = opts.map((b) => `<option value="${b}">${b}</option>`).join("");
  sel.value = opts.includes(prev) ? prev : YUANTA;
  sel.dataset.bankKey = newKey;

  sel.onchange = () => {
    const evt = new CustomEvent("complaint-bank-change");
    document.dispatchEvent(evt);
  };
}

function _getSelectedBank() {
  const sel = document.getElementById("complaint-bank-select");
  return sel ? sel.value : YUANTA;
}

function _renderChart(versionImpact, globalPlatform) {
  const canvas = document.getElementById("chart-complaint-timeline");
  if (!canvas) return;

  const noteEl = document.getElementById("complaint-data-note");

  if (!allReviews || allReviews.length === 0) {
    if (noteEl) noteEl.textContent = "⏳ 評論資料載入中，請稍候…";
    return;
  }

  const bank = _getSelectedBank();

  // Filter reviews for this bank (ignore global platform filter — show both platforms)
  let bankReviews = allReviews.filter((r) => r.bank === bank && r.date);

  if (!bankReviews.length) {
    if (noteEl) noteEl.textContent = "此銀行無評論資料";
    return;
  }

  // Date cutoff — based on latest review date
  const allDates = bankReviews.map((r) => r.date.slice(0, 10)).filter(Boolean).sort();
  const maxDate = allDates[allDates.length - 1];
  const cutoff = maxDate ? getDateCutoff(maxDate) : null;
  if (cutoff) bankReviews = bankReviews.filter((r) => r.date >= cutoff);

  // Group by year_month
  const monthMap = {};
  for (const r of bankReviews) {
    const ym = r.date.slice(0, 7);
    if (!monthMap[ym]) monthMap[ym] = { total: 0, complaints: 0 };
    monthMap[ym].total++;
    const rating = parseInt(r.rating, 10);
    if (rating <= 2) monthMap[ym].complaints++;
  }

  const labels = Object.keys(monthMap).sort();
  if (!labels.length) {
    if (noteEl) noteEl.textContent = "此期間無評論資料";
    return;
  }

  const totalData = labels.map((m) => monthMap[m].total);
  const complaintData = labels.map((m) => monthMap[m].complaints);
  const rateData = labels.map((m, i) => {
    const t = totalData[i];
    return t > 0 ? parseFloat(((complaintData[i] / t) * 100).toFixed(1)) : 0;
  });

  const monthIndexMap = Object.fromEntries(labels.map((m, i) => [m, i]));

  // iOS version markers
  const releases = versionImpact.filter((r) => r.bank === bank && r.platform === "App Store" && r.release_date);
  const releasePoints = releases
    .filter((r) => monthIndexMap.hasOwnProperty(r.release_date.slice(0, 7)))
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .map((r) => {
      const ym = r.release_date.slice(0, 7);
      const baseIdx = monthIndexMap[ym];
      const day = parseInt(r.release_date.slice(8, 10), 10);
      const year = parseInt(r.release_date.slice(0, 4), 10);
      const mon = parseInt(r.release_date.slice(5, 7), 10);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const x = baseIdx + (day - 1) / daysInMonth;
      const delta = r.rating_delta ? num(r.rating_delta) : null;
      // Position marker at complaint count of that month
      const yVal = complaintData[baseIdx] ?? 0;
      return {
        x,
        y: yVal,
        releaseDate: r.release_date,
        version: r.version,
        delta,
        color: delta !== null ? (delta > 0.05 ? "#16a34a" : delta < -0.05 ? "#dc2626" : "#94a3b8") : "#94a3b8",
        rotation: delta !== null && delta < -0.05 ? 180 : 0,
      };
    });

  const isYuanta = bank === YUANTA;
  const barColor = isYuanta ? "rgba(249,115,22,0.75)" : "rgba(29,78,216,0.65)";
  const barBorder = isYuanta ? "#f97316" : "#1d4ed8";
  const rateColor = isYuanta ? "#f97316" : "#1d4ed8";

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "客訴量（1-2★）",
          data: complaintData,
          backgroundColor: barColor,
          borderColor: barBorder,
          borderWidth: 1,
          order: 3,
          yAxisID: "yCount",
        },
        {
          label: "客訴率（%）",
          data: rateData,
          type: "line",
          borderColor: rateColor,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          order: 2,
          yAxisID: "yRate",
        },
        {
          label: "版本發布（iOS）",
          data: releasePoints.map((p) => ({ x: p.x, y: p.y })),
          type: "scatter",
          pointStyle: "triangle",
          pointRadius: 9,
          pointHoverRadius: 11,
          pointBackgroundColor: releasePoints.map((p) => p.color),
          pointRotation: releasePoints.map((p) => p.rotation),
          borderWidth: 0,
          showLine: false,
          order: 1,
          yAxisID: "yCount",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#64748b", font: { size: 11 }, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const versionItem = items.find((it) => it.dataset.label === "版本發布（iOS）");
              if (versionItem) {
                const p = releasePoints[versionItem.dataIndex];
                return p ? p.releaseDate : items[0]?.label || "";
              }
              return items[0]?.label || "";
            },
            label: (ctx) => {
              if (ctx.dataset.label === "版本發布（iOS）") {
                const p = releasePoints[ctx.dataIndex];
                if (!p) return null;
                const deltaStr = p.delta !== null ? ` (Δ${p.delta > 0 ? "+" : ""}${p.delta.toFixed(2)})` : "";
                return ` 版本 ${p.version}${deltaStr}`;
              }
              if (ctx.dataset.label === "客訴量（1-2★）") {
                return ` 客訴數：${ctx.parsed.y} 則`;
              }
              if (ctx.dataset.label === "客訴率（%）") {
                return ` 客訴率：${ctx.parsed.y}%`;
              }
              return null;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxRotation: 45, font: { size: 10 } },
          grid: { color: "rgba(241,245,249,0.6)" },
        },
        yCount: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { color: "#94a3b8", stepSize: 1 },
          grid: { color: "rgba(241,245,249,0.6)" },
          title: { display: true, text: "客訴數（則）", color: "#94a3b8", font: { size: 11 } },
        },
        yRate: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          max: 100,
          ticks: {
            color: rateColor,
            callback: (v) => v + "%",
          },
          grid: { drawOnChartArea: false },
          title: { display: true, text: "客訴率（%）", color: rateColor, font: { size: 11 } },
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

  // Summary stats
  const totalComplaints = complaintData.reduce((s, v) => s + v, 0);
  const peakMonth = labels[complaintData.indexOf(Math.max(...complaintData))];
  const peakCount = Math.max(...complaintData);
  const avgRate = rateData.length ? (rateData.reduce((s, v) => s + v, 0) / rateData.length).toFixed(1) : 0;

  if (noteEl) {
    noteEl.innerHTML =
      `統計區間 ${labels[0]} ～ ${labels[labels.length - 1]}　|　` +
      `客訴總量 <strong>${totalComplaints}</strong> 則　|　` +
      `高峰月份 <strong>${peakMonth}</strong>（${peakCount} 則）　|　` +
      `平均客訴率 <strong>${avgRate}%</strong>　` +
      `<span style="font-size:0.7rem;color:#64748b">△綠=評分上升 △紅=下降（版本標記僅 iOS）</span>`;
  }
}
