// alertReviews.js — Reviews table with platform & category columns
import { YUANTA } from "../config.js";
import { num } from "../dataLoader.js";
import { getDateCutoff } from "../filters.js";
import { getCategoryForReview } from "./keywords.js";
import { getProductLineForReview } from "./productAnalysis.js";

const PAGE_SIZE = 15;

let allReviews = null;
let currentPage = 1;
let lastFilterState = null;

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
    bankSel.onchange = () => {
      currentPage = 1;
      renderAlertReviews({ selectedBanks, platform }, bankSel.value);
    };
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
  const productLineSel = document.getElementById("alert-product-line-select");
  const productLineFilter = productLineSel && productLineSel.value !== "all" ? productLineSel.value : null;

  // Detect filter changes — reset to page 1
  const filterKey = JSON.stringify({ bank, platFilter, selectedRatings: [...selectedRatings].sort(), showAll, categoryFilter, productLineFilter });
  if (filterKey !== lastFilterState) {
    currentPage = 1;
    lastFilterState = filterKey;
  }

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
    if (productLineFilter) {
      const pl = getProductLineForReview(r.bank, r.platform, r.date, r.review);
      if (pl !== productLineFilter) return false;
    }
    return true;
  });

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalEl = document.getElementById("alert-total");
  const pageInfoEl = document.getElementById("alert-page-info");
  if (totalEl) totalEl.textContent = totalRows;
  if (pageInfoEl) pageInfoEl.textContent = `${currentPage} / ${totalPages}`;

  const tbody = document.getElementById("alert-tbody");
  if (!tbody) return;

  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-sm" style="color:var(--text-secondary)">無符合條件的評論</td></tr>';
    renderPagination(totalPages, selectedBanks, platform, focusedBank);
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

  tbody.innerHTML = pageRows
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

      // Look up product line
      const PRODUCT_LINE_COLORS = { "存款":"#0ea5e9","信用卡":"#f97316","基金":"#8b5cf6","貸款":"#10b981","外匯":"#f59e0b","其他":"#94a3b8" };
      const productLine = getProductLineForReview(r.bank, r.platform, r.date, r.review);
      const plColor = productLine ? (PRODUCT_LINE_COLORS[productLine] || "#94a3b8") : null;
      const plBadge = productLine
        ? `<span style="padding:0.12rem 0.45rem;border-radius:999px;border:1.5px solid ${plColor};color:${plColor};font-weight:600;font-size:0.7rem;white-space:nowrap">${productLine}</span>`
        : '<span style="color:#cbd5e1;font-size:0.7rem">—</span>';

      const replyText = (r.developer_reply || "").trim();
      const replyDate = (r.developer_reply_date || "").trim();
      let replyRow = "";
      if (hasReply && replyText) {
        const replyDateStr = replyDate ? ` · ${replyDate}` : "";
        replyRow = `<tr class="reply-row">
          <td colspan="8">
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
        <td class="px-3 py-2 text-xs">${plBadge}</td>
        <td class="px-3 py-2 text-sm max-w-sm" style="color:var(--text-primary)">${short}${full}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">${replyBadge}</td>
      </tr>`;

      return reviewRow + replyRow;
    })
    .join("");

  renderPagination(totalPages, selectedBanks, platform, focusedBank);
}

function renderPagination(totalPages, selectedBanks, platform, focusedBank) {
  const container = document.getElementById("alert-pagination");
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const btnStyle = (active) =>
    `style="padding:0.2rem 0.6rem;border-radius:0.375rem;border:1px solid var(--border);background:${active ? "var(--accent)" : "var(--bg-card)"};color:${active ? "#fff" : "var(--text-primary)"};cursor:${active ? "default" : "pointer"};font-size:0.78rem;min-width:2rem"`;

  const pages = getPaginationRange(currentPage, totalPages);

  const buttons = pages.map((p) => {
    if (p === "…") {
      return `<span style="padding:0.2rem 0.3rem;color:var(--text-secondary);font-size:0.78rem">…</span>`;
    }
    return `<button ${btnStyle(p === currentPage)} data-page="${p}" ${p === currentPage ? "disabled" : ""}>${p}</button>`;
  });

  const prevDisabled = currentPage === 1;
  const nextDisabled = currentPage === totalPages;
  const navStyle = (disabled) =>
    `style="padding:0.2rem 0.6rem;border-radius:0.375rem;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);cursor:${disabled ? 'default' : 'pointer'};font-size:0.78rem;min-width:2rem;opacity:${disabled ? '0.4' : '1'}"`;
  const prevBtn = `<button ${navStyle(prevDisabled)} data-page="${currentPage - 1}" ${prevDisabled ? 'disabled' : ''}>‹</button>`;
  const nextBtn = `<button ${navStyle(nextDisabled)} data-page="${currentPage + 1}" ${nextDisabled ? 'disabled' : ''}>›</button>`;

  container.innerHTML = prevBtn + buttons.join("") + nextBtn;

  container.querySelectorAll("button[data-page]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      currentPage = parseInt(btn.dataset.page);
      renderAlertReviews({ selectedBanks, platform }, focusedBank);
      document.getElementById("alert-tbody")?.closest(".chart-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
