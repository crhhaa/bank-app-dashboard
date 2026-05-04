// overview.js — KPI Scorecards section
// Computes from summaryMonthly (same dataset as ratingTrend) for consistency.
import { YUANTA } from "../config.js";
import { num } from "../dataLoader.js";

// Get Yuanta's earliest year_month
function getYuantaEarliestMonth(summaryMonthly) {
  const months = summaryMonthly
    .filter((r) => r.bank === YUANTA && r.year_month)
    .map((r) => r.year_month)
    .sort();
  return months[0] || null;
}

// Weighted-average aggregation from summaryMonthly rows for one bank+platform combo.
// platform: "App Store" | "Google Play" | null (= all platforms)
function aggregateFromMonthly(summaryMonthly, bank, platform, yuantaStart) {
  let rows = summaryMonthly.filter((r) => r.bank === bank);
  if (platform) rows = rows.filter((r) => r.platform === platform);
  if (yuantaStart) rows = rows.filter((r) => r.year_month >= yuantaStart);

  const totalCount = rows.reduce((s, r) => s + num(r.review_count), 0);
  if (totalCount === 0) return null;

  const avgRating = rows.reduce((s, r) => s + num(r.avg_rating) * num(r.review_count), 0) / totalCount;
  const replyCount = rows.reduce((s, r) => s + num(r.reply_count), 0);
  const replyRate = replyCount / totalCount;

  // Weighted avg reply days (weighted by reply_count, only months with reply data)
  const repliedRows = rows.filter((r) => r.avg_reply_days && num(r.avg_reply_days) > 0);
  const replyDaysWeight = repliedRows.reduce((s, r) => s + num(r.reply_count), 0);
  const avgReplyDays = replyDaysWeight > 0
    ? repliedRows.reduce((s, r) => s + num(r.avg_reply_days) * num(r.reply_count), 0) / replyDaysWeight
    : null;

  return { avgRating, totalReviews: totalCount, replyRate, avgReplyDays };
}

// Compute latest month's weighted avg rating — same formula as ratingTrend weighted aggregation.
// This ensures the "整體平均評分" KPI matches the most recent data point on the trend curve.
function getLatestMonthAvgRating(summaryMonthly, bank, platform, yuantaStart) {
  let rows = summaryMonthly.filter((r) => r.bank === bank);
  if (platform) rows = rows.filter((r) => r.platform === platform);
  if (yuantaStart) rows = rows.filter((r) => r.year_month >= yuantaStart);
  if (!rows.length) return null;

  const latestMonth = rows.map((r) => r.year_month).sort().pop();
  const monthRows = rows.filter((r) => r.year_month === latestMonth);

  const totalCount = monthRows.reduce((s, r) => s + num(r.review_count), 0);
  if (totalCount === 0) return null;
  return monthRows.reduce((s, r) => s + num(r.avg_rating) * num(r.review_count), 0) / totalCount;
}

export function renderOverview(summaryBank, summaryMonthly, { selectedBanks, platform }, appRatings = []) {
  const container = document.getElementById("section-overview");
  if (!container) return;

  const yuantaStart = getYuantaEarliestMonth(summaryMonthly);

  // Determine platform filter for combined view
  const platFilter = platform === "all" ? null : platform;

  // Yuanta stats (combined / filtered platform)
  const yuantaStats = aggregateFromMonthly(summaryMonthly, YUANTA, platFilter, yuantaStart);
  // Latest month avg rating — matches the most recent data point on the rating trend curve
  const yuantaLatestAvgRating = getLatestMonthAvgRating(summaryMonthly, YUANTA, platFilter, yuantaStart);
  // Yuanta per-platform (always shown for iOS/Android cards)
  const yuantaIOS = aggregateFromMonthly(summaryMonthly, YUANTA, "App Store", yuantaStart);
  const yuantaAndroid = aggregateFromMonthly(summaryMonthly, YUANTA, "Google Play", yuantaStart);

  if (!yuantaStats) {
    container.innerHTML = '<p class="text-gray-500 text-sm">No data for 元大銀行</p>';
    return;
  }

  // Competitor averages (same period, same platform filter)
  const compBanks = selectedBanks.filter((b) => b !== YUANTA);
  const compStatsList = compBanks
    .map((b) => aggregateFromMonthly(summaryMonthly, b, platFilter, yuantaStart))
    .filter(Boolean);

  const compAvgRating = compStatsList.length
    ? compStatsList.reduce((s, r) => s + r.avgRating, 0) / compStatsList.length
    : null;
  const compAvgReplyRate = compStatsList.length
    ? compStatsList.reduce((s, r) => s + r.replyRate, 0) / compStatsList.length
    : null;
  const compAvgReplyDaysList = compStatsList.filter((r) => r.avgReplyDays != null);
  const compAvgReplyDays = compAvgReplyDaysList.length
    ? compAvgReplyDaysList.reduce((s, r) => s + r.avgReplyDays, 0) / compAvgReplyDaysList.length
    : null;

  // iOS / Android overall ratings from iTunes Lookup + Google Play app()
  const iosOverallRow    = (appRatings || []).find((r) => r.bank === YUANTA && r.platform === "App Store");
  const androidOverallRow = (appRatings || []).find((r) => r.bank === YUANTA && r.platform === "Google Play");

  const iosOverallAvg   = iosOverallRow?.avg_rating_overall   ? parseFloat(iosOverallRow.avg_rating_overall)   : null;
  const iosOverallCount = iosOverallRow?.rating_count_overall ? parseInt(iosOverallRow.rating_count_overall, 10) : null;
  const andOverallAvg   = androidOverallRow?.avg_rating_overall   ? parseFloat(androidOverallRow.avg_rating_overall)   : null;
  const andOverallCount = androidOverallRow?.rating_count_overall ? parseInt(androidOverallRow.rating_count_overall, 10) : null;

  function renderDelta(delta, decimals = 2) {
    if (delta === null || delta === undefined) return "";
    const cls  = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
    const sign  = delta > 0 ? "+" : "";
    return `<span class="kpi-delta ${cls}">${arrow} ${sign}${delta.toFixed(decimals)}</span>`;
  }

  function renderCard(card) {
    return `
      <div class="kpi-card" data-accent="${card.accent}">
        <div class="kpi-label">${card.label}</div>
        <div class="kpi-value-row">
          <span class="kpi-value">${card.value}</span>
          ${card.unit ? `<span class="kpi-unit">${card.unit}</span>` : ""}
          ${renderDelta(card.delta, card.deltaDecimals ?? 2)}
        </div>
        ${card.compare ? `<div class="kpi-compare">${card.compare}</div>` : ""}
      </div>`;
  }

  const latestRating = yuantaLatestAvgRating ?? yuantaStats.avgRating;
  const ratingDelta  = compAvgRating != null ? latestRating - compAvgRating : null;

  const ratingCards = [
    {
      label: "iOS 商店總評分",
      value: iosOverallAvg != null ? iosOverallAvg.toFixed(1) : "—",
      unit: iosOverallAvg != null ? "/ 5" : "",
      delta: null,
      compare: iosOverallCount != null
        ? `${iosOverallCount.toLocaleString()} 人評分（含純評星）`
        : "執行 --overall-only 取得",
      accent: "indigo",
    },
    {
      label: "iOS 評論評分",
      value: yuantaIOS ? yuantaIOS.avgRating.toFixed(2) : "—",
      unit: "/ 5",
      delta: null,
      compare: yuantaIOS ? `${yuantaIOS.totalReviews.toLocaleString()} 則含留言評分` : "",
      accent: "blue",
    },
    {
      label: "Android 商店總評分",
      value: andOverallAvg != null ? andOverallAvg.toFixed(1) : "—",
      unit: andOverallAvg != null ? "/ 5" : "",
      delta: null,
      compare: andOverallCount != null
        ? `${andOverallCount.toLocaleString()} 人評分（含純評星）`
        : "執行 --overall-only 取得",
      accent: "indigo",
    },
    {
      label: "Android 評論評分",
      value: yuantaAndroid ? yuantaAndroid.avgRating.toFixed(2) : "—",
      unit: "/ 5",
      delta: null,
      compare: yuantaAndroid ? `${yuantaAndroid.totalReviews.toLocaleString()} 則含留言評分` : "",
      accent: "blue",
    },
  ];

  const opsCards = [
    {
      label: "本月平均評論評分",
      value: latestRating.toFixed(2),
      unit: "/ 5",
      delta: ratingDelta,
      compare: compAvgRating ? `競品均 ${compAvgRating.toFixed(2)}` : "",
      accent: "blue",
    },
    {
      label: "開發者本月回覆率",
      value: (yuantaStats.replyRate * 100).toFixed(1) + "%",
      unit: "",
      delta: compAvgReplyRate != null ? yuantaStats.replyRate - compAvgReplyRate : null,
      deltaDecimals: 1,
      compare: compAvgReplyRate ? `競品均 ${(compAvgReplyRate * 100).toFixed(1)}%` : "",
      accent: "green",
    },
    {
      label: "本月平均回覆天數",
      value: yuantaStats.avgReplyDays ? yuantaStats.avgReplyDays.toFixed(1) : "—",
      unit: yuantaStats.avgReplyDays ? "天" : "",
      delta: compAvgReplyDays && yuantaStats.avgReplyDays
        ? -(yuantaStats.avgReplyDays - compAvgReplyDays)
        : null,
      deltaDecimals: 1,
      compare: compAvgReplyDays ? `競品均 ${compAvgReplyDays.toFixed(1)} 天` : "",
      accent: "orange",
    },
  ];

  container.innerHTML = `
    <div class="kpi-group ratings">${ratingCards.map(renderCard).join("")}</div>
    <div class="kpi-group ops">${opsCards.map(renderCard).join("")}</div>
  `;
}
