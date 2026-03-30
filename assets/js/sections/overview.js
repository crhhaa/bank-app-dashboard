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

export function renderOverview(summaryBank, summaryMonthly, { selectedBanks, platform }) {
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

  const cards = [
    {
      label: "整體平均本月評分",
      value: yuantaLatestAvgRating != null ? yuantaLatestAvgRating.toFixed(2) : yuantaStats.avgRating.toFixed(2),
      sub: compAvgRating ? `競品均 ${compAvgRating.toFixed(2)}` : "",
      delta: compAvgRating && yuantaLatestAvgRating != null ? yuantaLatestAvgRating - compAvgRating : (compAvgRating ? yuantaStats.avgRating - compAvgRating : null),
      suffix: "/ 5",
      icon: "⭐",
    },
    {
      label: "iOS 本月評分",
      value: yuantaIOS ? yuantaIOS.avgRating.toFixed(2) : "—",
      sub: yuantaIOS ? `${yuantaIOS.totalReviews} 則評論` : "",
      delta: null,
      suffix: "/ 5",
      icon: "",
    },
    {
      label: "Android 本月評分",
      value: yuantaAndroid ? yuantaAndroid.avgRating.toFixed(2) : "—",
      sub: yuantaAndroid ? `${yuantaAndroid.totalReviews} 則評論` : "",
      delta: null,
      suffix: "/ 5",
      icon: "",
    },
    {
      label: "開發者本月回覆率",
      value: (yuantaStats.replyRate * 100).toFixed(1) + "%",
      sub: compAvgReplyRate ? `競品均 ${(compAvgReplyRate * 100).toFixed(1)}%` : "",
      delta: compAvgReplyRate ? yuantaStats.replyRate - compAvgReplyRate : null,
      suffix: "",
      icon: "💬",
    },
    {
      label: "本月平均回覆天數",
      value: yuantaStats.avgReplyDays ? yuantaStats.avgReplyDays.toFixed(1) : "—",
      sub: compAvgReplyDays ? `競品均 ${compAvgReplyDays.toFixed(1)} 天` : "",
      delta: compAvgReplyDays && yuantaStats.avgReplyDays
        ? -(yuantaStats.avgReplyDays - compAvgReplyDays) // inverted: lower is better
        : null,
      suffix: " 天",
      icon: "⏱",
    },
  ];

  container.innerHTML = cards
    .map((card) => {
      const deltaHtml = card.delta !== null
        ? (() => {
            const positive = card.delta > 0;
            const color = positive ? "color:#16a34a" : card.delta < 0 ? "color:#dc2626" : "color:#94a3b8";
            const arrow = positive ? "▲" : card.delta < 0 ? "▼" : "—";
            const sign = card.delta > 0 ? "+" : "";
            return `<span style="${color};font-size:0.75rem;font-weight:500;margin-left:0.2rem">${arrow} ${sign}${card.delta.toFixed(2)}</span>`;
          })()
        : "";
      return `
        <div class="kpi-card">
          <div class="kpi-icon">${card.icon}</div>
          <div class="kpi-value">${card.value}<span class="kpi-suffix">${card.suffix}</span>${deltaHtml}</div>
          <div class="kpi-label">${card.label}</div>
          ${card.sub ? `<div class="kpi-sub">${card.sub}</div>` : ""}
        </div>`;
    })
    .join("");
}
