// versionImpact.js — Version release impact table and chart
import { YUANTA, ALL_BANKS } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";

let chart = null;

// Get 元大's earliest year_month from summaryMonthly
function getYuantaEarliestMonth(summaryMonthly) {
  const months = summaryMonthly
    .filter((r) => r.bank === YUANTA && r.year_month)
    .map((r) => r.year_month)
    .sort();
  return months[0] || null;
}

export function renderVersionImpact(versionImpact, summaryMonthly, { selectedBanks, platform }, metadata) {
  const platFilter = platform === "all" ? null : platform;

  // Populate bank selector on first render
  _initVersionBankSelect(versionImpact, selectedBanks);

  const bankSel = document.getElementById("version-bank-select");
  const selectedBank = bankSel ? bankSel.value : YUANTA;

  renderImpactTableIOS(versionImpact, selectedBank);
  renderImpactTableAndroid(versionImpact, selectedBank);
  renderImpactChart(versionImpact, summaryMonthly, selectedBank, platFilter, metadata);
}

function _initVersionBankSelect(versionImpact, selectedBanks) {
  const bankSel = document.getElementById("version-bank-select");
  if (!bankSel) return;

  const banksWithData = [...new Set(versionImpact.map((r) => r.bank))].sort((a, b) => {
    if (a === YUANTA) return -1;
    if (b === YUANTA) return 1;
    return ALL_BANKS.indexOf(a) - ALL_BANKS.indexOf(b);
  });

  if (bankSel.dataset.populated !== "1") {
    bankSel.innerHTML = banksWithData
      .map((b) => `<option value="${b}" ${b === YUANTA ? "selected" : ""}>${b}</option>`)
      .join("");
    bankSel.dataset.populated = "1";
    bankSel.onchange = () => {
      const evt = new CustomEvent("version-bank-change");
      document.dispatchEvent(evt);
    };
  }
}

function _buildVersionRows(versionImpact, bank, platform) {
  let rows = versionImpact.filter((r) => r.bank === bank && r.platform === platform);

  if (rows.length) {
    const allDates = rows.map((r) => r.release_date).filter(Boolean).sort();
    const maxDate = allDates[allDates.length - 1];
    if (maxDate) {
      const cutoff = getDateCutoff(maxDate);
      if (cutoff) rows = rows.filter((r) => r.release_date && r.release_date >= cutoff);
    }
  }

  rows.sort((a, b) => b.release_date.localeCompare(a.release_date));
  return rows;
}

function _rowHtml(r) {
  const delta = num(r.rating_delta);
  const deltaColor = delta > 0.1 ? "color:#16a34a" : delta < -0.1 ? "color:#dc2626" : "color:#94a3b8";
  const deltaStr = r.rating_delta ? (delta > 0 ? "+" : "") + delta.toFixed(2) : "—";
  const notes = (r.release_notes_preview || "").trim();
  const short = notes.slice(0, 60);
  const expandHtml = notes.length > 60
    ? `<details style="display:inline"><summary style="color:var(--accent);cursor:pointer;font-size:0.75rem;display:inline;margin-left:0.25rem">展開</summary><span style="color:var(--text-secondary)"> ${notes.slice(60)}</span></details>`
    : "";
  const isYuanta = r.bank === YUANTA;
  return `<tr>
    <td class="px-3 py-2 text-sm" style="color:var(--text-secondary)">${r.release_date}</td>
    <td class="px-3 py-2 text-sm font-mono font-semibold" style="color:${isYuanta ? "var(--accent)" : "var(--blue)"}">${r.version}</td>
    <td class="px-3 py-2 text-sm max-w-xs" style="color:var(--text-secondary)">${short || "—"}${expandHtml}</td>
    <td class="px-3 py-2 text-sm text-right" style="color:var(--text-primary)">${r.pre_release_avg_rating ? num(r.pre_release_avg_rating).toFixed(2) : "—"}</td>
    <td class="px-3 py-2 text-sm text-right" style="color:var(--text-primary)">${r.post_release_avg_rating ? num(r.post_release_avg_rating).toFixed(2) : "—"}</td>
    <td class="px-3 py-2 text-sm text-right font-semibold" style="${deltaColor}">${deltaStr}</td>
  </tr>`;
}

function renderImpactTableIOS(versionImpact, bank) {
  const tbody = document.getElementById("version-tbody-ios");
  if (!tbody) return;

  const rows = _buildVersionRows(versionImpact, bank, "App Store");

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-sm" style="color:var(--text-secondary)">無 App Store 版本資料</td></tr>';
    return;
  }

  const VISIBLE_LIMIT = 6;
  if (rows.length <= VISIBLE_LIMIT) {
    tbody.innerHTML = rows.map(_rowHtml).join("");
    return;
  }

  // Show first 6, collapse the rest inside <details>
  const visible = rows.slice(0, VISIBLE_LIMIT);
  const hidden = rows.slice(VISIBLE_LIMIT);
  const hiddenHtml = `<tr><td colspan="6" style="padding:0;border:none">
    <details>
      <summary style="cursor:pointer;padding:0.5rem 0.75rem;font-size:0.78rem;color:var(--accent);list-style:none;user-select:none">
        ▼ 顯示更多（共 ${hidden.length} 筆）
      </summary>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${hidden.map(_rowHtml).join("")}</tbody>
      </table>
    </details>
  </td></tr>`;
  tbody.innerHTML = visible.map(_rowHtml).join("") + hiddenHtml;
}

function renderImpactTableAndroid(versionImpact, bank) {
  const tbody = document.getElementById("version-tbody-android");
  if (!tbody) return;

  const rows = _buildVersionRows(versionImpact, bank, "Google Play");

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-sm" style="color:var(--text-secondary)">無 Google Play 版本資料</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(_rowHtml).join("");
}

function renderImpactChart(versionImpact, summaryMonthly, bank, platFilter, metadata) {
  const canvas = document.getElementById("chart-version-impact");
  if (!canvas) return;

  let monthly = summaryMonthly.filter((r) => r.bank === bank);
  if (platFilter) {
    monthly = monthly.filter((r) => r.platform === platFilter);
  } else {
    const grouped = {};
    monthly.forEach((r) => {
      if (!grouped[r.year_month]) grouped[r.year_month] = [];
      grouped[r.year_month].push(num(r.avg_rating));
    });
    monthly = Object.entries(grouped).map(([ym, vals]) => ({
      year_month: ym,
      avg_rating: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));
  }

  monthly.sort((a, b) => a.year_month.localeCompare(b.year_month));

  // Find earliest iOS release for this bank — data starts from first scraped version
  const iosReleases = versionImpact
    .filter((r) => r.bank === bank && r.platform === "App Store" && r.release_date)
    .map((r) => r.release_date)
    .sort();
  const earliestReleaseDate = iosReleases[0] || null;
  const earliestReleaseYM = earliestReleaseDate ? earliestReleaseDate.slice(0, 7) : null;

  // Apply date-range filter and earliest-version floor
  if (monthly.length) {
    const cutoff = getDateCutoff(monthly[monthly.length - 1].year_month);
    monthly = monthly.filter((r) => {
      if (cutoff && r.year_month < cutoff) return false;
      if (earliestReleaseYM && r.year_month < earliestReleaseYM) return false;
      return true;
    });
  }

  const labels = monthly.map((r) => r.year_month);
  const monthIndexMap = Object.fromEntries(labels.map((m, i) => [m, i]));
  const data = monthly.map((r) => num(r.avg_rating));

  // Version release points — always iOS only (App Store has full historical version history)
  const releases = versionImpact.filter((r) => r.bank === bank && r.platform === "App Store");

  const isYuanta = bank === YUANTA;
  const lineColor = isYuanta ? "#f97316" : "#1d4ed8";
  const lineBg = isYuanta ? "rgba(249,115,22,0.08)" : "rgba(29,78,216,0.08)";

  // One release point per iOS release, positioned with fractional x for intra-month precision.
  // Linear x-axis (integer indices) is used so scatter and line datasets share the same scale.
  const releasePoints = releases
    .filter((r) => monthIndexMap.hasOwnProperty(r.release_date?.slice(0, 7)))
    .sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""))
    .map((r) => {
      const ym = r.release_date.slice(0, 7);
      const baseIdx = monthIndexMap[ym];
      const day = parseInt(r.release_date.slice(8, 10), 10);
      const year = parseInt(r.release_date.slice(0, 4), 10);
      const mon = parseInt(r.release_date.slice(5, 7), 10);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const x = baseIdx + (day - 1) / daysInMonth;
      const delta = r.rating_delta ? num(r.rating_delta) : null;
      return {
        x,
        xLabel: ym,
        releaseDate: r.release_date,
        y: num(r.post_release_avg_rating) || data[baseIdx],
        version: r.version,
        delta,
        color: delta !== null ? (delta > 0.05 ? "#16a34a" : delta < -0.05 ? "#dc2626" : "#94a3b8") : "#94a3b8",
        rotation: delta !== null && delta < -0.05 ? 180 : 0,
      };
    });

  const config = {
    type: "line",
    data: {
      datasets: [
        {
          label: `${bank} 月平均評分`,
          // Use {x, y} with integer indices so this line aligns with the linear x-axis
          data: data.map((v, i) => ({ x: i, y: v })),
          borderColor: lineColor,
          backgroundColor: lineBg,
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
        },
        {
          label: "版本發布",
          data: releasePoints.map((p) => ({ x: p.x, y: p.y })),
          type: "scatter",
          pointStyle: "triangle",
          pointRadius: 9,
          pointHoverRadius: 11,
          pointBackgroundColor: releasePoints.map((p) => p.color),
          pointRotation: releasePoints.map((p) => p.rotation),
          borderWidth: 0,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#64748b", font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            title: (items) => {
              const first = items[0];
              if (!first) return "";
              // For version markers, show the exact release date as title
              const markerItem = items.find((it) => it.dataset.label === "版本發布");
              if (markerItem) {
                const p = releasePoints[markerItem.dataIndex];
                return p ? p.releaseDate : "";
              }
              const idx = Math.round(first.parsed.x);
              return labels[idx] || "";
            },
            label: (ctx) => {
              if (ctx.dataset.label === "版本發布") {
                const p = releasePoints[ctx.dataIndex];
                if (!p) return null;
                const deltaStr = p.delta !== null ? ` (Δ${p.delta > 0 ? "+" : ""}${p.delta.toFixed(2)})` : "";
                return ` 版本 ${p.version}${deltaStr}`;
              }
              const val = ctx.parsed?.y ?? ctx.raw?.y ?? ctx.raw;
              return ` 評分: ${typeof val === "number" ? val.toFixed(2) : "—"}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: -0.5,
          max: labels.length - 0.001,
          ticks: {
            stepSize: 1,
            callback: (val) => {
              if (!Number.isInteger(val)) return "";
              return (val >= 0 && val < labels.length) ? labels[val] : "";
            },
            color: "#94a3b8",
            maxRotation: 45,
            font: { size: 10 },
          },
          grid: { color: "#f1f5f9" },
        },
        y: {
          min: 0, max: 6,
          ticks: { color: "#94a3b8" },
          grid: { color: "#f1f5f9" },
          title: { display: true, text: "平均評分", color: "#94a3b8" },
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

  // Update subtitle: data starts from earliest scraped version (applies to all banks)
  const noteEl = document.getElementById("version-data-note");
  if (noteEl) {
    noteEl.textContent = earliestReleaseDate
      ? `📅 資料起始日期：${earliestReleaseDate}（能爬取到的第一個版本號）`
      : "";
  }
}
