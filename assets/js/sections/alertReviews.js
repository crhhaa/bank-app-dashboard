// alertReviews.js — Reviews table with platform & category columns
import { YUANTA } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";
import { getCategoryForReview } from "./keywords.js";

let allReviews = null;

export function initAlertReviews(reviews) {
  allReviews = reviews;
}

export function renderAlertReviews({ selectedBanks, platform }, focusedBank = null) {
  const bank = focusedBank || YUANTA;

  const bankSel = document.getElementById("alert-bank-select");
  if (bankSel) {
    bankSel.innerHTML = selectedBanks
      .map((b) => `<option value="${b}" ${b === bank ? "selected" : ""}>${b}</option>`)
      .join("");
    bankSel.onchange = () => renderAlertReviews({ selectedBanks, platform }, bankSel.value);
  }

  // Local platform filter (overrides global if set)
  const localPlatSel = document.getElementById("alert-platform-select");
  const localPlat = localPlatSel ? localPlatSel.value : "all";
  const platFilter = localPlat !== "all" ? localPlat : (platform === "all" ? null : platform);

  const checkedStars = [...document.querySelectorAll(".star-filter:checked")].map((cb) => parseInt(cb.value));
  const selectedRatings = checkedStars.length ? new Set(checkedStars) : new Set([1, 2, 3, 4, 5]);
  const showAll = document.getElementById("alert-show-all")?.checked;
  const categorySel = document.getElementById("alert-category-select");
  const categoryFilter = categorySel && categorySel.value !== "all" ? categorySel.value : null;

  let rows = allReviews || [];

  const allDates = rows.map((r) => r.date?.slice(0, 10)).filter(Boolean).sort();
  const maxReviewDate = allDates[allDates.length - 1];
  const dateCutoff = maxReviewDate ? getDateCutoff(maxReviewDate) : null;

  rows = rows.filter((r) => {
    if (!showAll && r.bank !== bank) return false;
    if (showAll && !selectedBanks.includes(r.bank)) return false;
    if (platFilter && r.platform !== platFilter) return false;
    if (!selectedRatings.has(num(r.rating))) return false;
    if (dateCutoff && r.date && r.date.slice(0, 7) < dateCutoff) return false;
    if (categoryFilter) {
      const cat = getCategoryForReview(r.bank, r.platform, r.date, r.review);
      if (cat !== categoryFilter) return false;
    }
    return true;
  });

  rows = rows.slice(0, 100);

  const tbody = document.getElementById("alert-tbody");
  const countEl = document.getElementById("alert-count");
  if (countEl) countEl.textContent = rows.length;

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-sm" style="color:var(--text-secondary)">無符合條件的評論</td></tr>';
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

  tbody.innerHTML = rows
    .map((r) => {
      const stars = "★".repeat(num(r.rating)) + "☆".repeat(5 - num(r.rating));
      const starColor = num(r.rating) <= 2 ? "#dc2626" : num(r.rating) === 3 ? "#d97706" : "#16a34a";
      const platformLabel = r.platform === "App Store" ? "🍎 iOS" : "🤖 Android";
      const hasReply = r.has_reply === "1" || r.has_reply === 1;
      const replyBadge = hasReply
        ? '<span class="badge-replied">已回覆</span>'
        : '<span class="badge-unreplied">未回覆</span>';
      const reviewText = (r.review || "").trim();
      const short = reviewText.slice(0, 120);
      const full = reviewText.length > 120
        ? `<details class="inline"><summary style="color:var(--accent);cursor:pointer;font-size:0.75rem;margin-left:0.25rem">展開</summary><span style="color:var(--text-primary)"> ${reviewText.slice(120)}</span></details>`
        : "";
      const isYuanta = r.bank === YUANTA;

      // Look up voice category
      const category = getCategoryForReview(r.bank, r.platform, r.date, r.review);
      const catColor = category ? (CATEGORY_COLORS[category] || "#64748b") : null;
      const catBadge = category
        ? `<span style="padding:0.12rem 0.45rem;border-radius:999px;border:1.5px solid ${catColor};color:${catColor};font-weight:600;font-size:0.7rem;white-space:nowrap">${category}</span>`
        : '<span style="color:#cbd5e1;font-size:0.7rem">—</span>';

      const replyText = (r.developer_reply || "").trim();
      const replyDate = (r.developer_reply_date || "").trim();
      let replyRow = "";
      if (hasReply && replyText) {
        const replyDateStr = replyDate ? ` · ${replyDate}` : "";
        replyRow = `<tr class="reply-row">
          <td colspan="7">
            <div class="reply-bubble">
              <div class="reply-bubble-meta">💬 開發者回覆${replyDateStr}</div>
              ${replyText}
            </div>
          </td>
        </tr>`;
      }

      const reviewRow = `<tr style="border-bottom:${replyRow ? "none" : "1px solid var(--border)"}; background:${isYuanta ? "#fffbeb" : "#ffffff"}">
        <td class="px-3 py-2 text-xs whitespace-nowrap" style="color:var(--text-secondary)">${r.date?.slice(0, 10) || ""}</td>
        <td class="px-3 py-2 text-sm font-medium" style="${isYuanta ? "color:var(--accent)" : "color:var(--text-primary)"}">${r.bank}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap" style="color:var(--text-secondary)">${platformLabel}</td>
        <td class="px-3 py-2 text-sm whitespace-nowrap" style="color:${starColor}">${stars}</td>
        <td class="px-3 py-2 text-xs">${catBadge}</td>
        <td class="px-3 py-2 text-sm max-w-sm" style="color:var(--text-primary)">${short}${full}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">${replyBadge}</td>
      </tr>`;

      return reviewRow + replyRow;
    })
    .join("");
}
