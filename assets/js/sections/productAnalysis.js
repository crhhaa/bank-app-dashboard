// productAnalysis.js — Product line analysis: Pie + Bar chart + paginated review list
import { YUANTA } from "../config.js";
import { num } from "../dataLoader.js";

const PAGE_SIZE = 10;
const PRODUCT_CATEGORIES = ["存款", "信用卡", "基金", "貸款", "外匯", "其他"];

const PRODUCT_COLORS = {
  "存款":   "#0ea5e9",
  "信用卡": "#f97316",
  "基金":   "#8b5cf6",
  "貸款":   "#10b981",
  "外匯":   "#f59e0b",
  "其他":   "#94a3b8",
};

// ── Module-level memoization state ──────────────────────────────────
let _productSummary = [];
let _productReviews = [];
let _lastFilterKey = null;
let _lastGlobalFilterState = null;
let _selectedProductBank = YUANTA; // section-level bank override

// Computed caches — set to null to invalidate
let _filteredSummary = null;
let _aggregatedByProduct = null;
let _selectedProduct = null;
let _selectedStarGroup = null;  // null | "low" | "mid" | "high"
let _filteredReviews = null;
let _currentPage = 1;

// Chart instances
let _chartPie = null;
let _chartBar = null;

// Lookup map for alertReviews integration: key → product_line
let _reviewProductMap = new Map();

let _chartOtherBar = null;
let _activeTab = "products";
let _otherStarGroup = null;
let _otherCurrentPage = 1;

// ── Public API ────────────────────────────────────────────────────────

export function initProductReviews(productReviews) {
  _productReviews = productReviews || [];
  _reviewProductMap = new Map();
  for (const r of _productReviews) {
    const key = `${r.bank}||${r.platform}||${String(r.date || "").slice(0, 10)}||${String(r.review || "").slice(0, 50)}`;
    _reviewProductMap.set(key, r.product_line);
  }
  if (_selectedProduct) {
    _filteredReviews = null;
    _renderReviewList();
  }
}

export function getProductLineForReview(bank, platform, date, reviewText) {
  const key = `${bank}||${platform}||${String(date || "").slice(0, 10)}||${String(reviewText || "").slice(0, 50)}`;
  return _reviewProductMap.get(key) || null;
}

export function renderProductAnalysis(productSummary, filterState) {
  _productSummary = productSummary || [];
  _lastGlobalFilterState = filterState;

  // Ensure _selectedProductBank is still valid for the current bank selection
  if (_selectedProductBank !== "all" && !filterState.selectedBanks.includes(_selectedProductBank)) {
    _selectedProductBank = "all";
  }

  const filterKey = JSON.stringify({
    banks: filterState.selectedBanks,
    platform: filterState.platform,
    productBank: _selectedProductBank,
  });
  if (filterKey !== _lastFilterKey) {
    _lastFilterKey = filterKey;
    _filteredSummary = null;
    _aggregatedByProduct = null;
    _filteredReviews = null;
    _selectedStarGroup = null;
    _otherStarGroup = null;
    _currentPage = 1;
    _otherCurrentPage = 1;
  }

  _renderBankSelect(filterState.selectedBanks);
  _ensureFilteredSummary(filterState);
  _renderPieChart();
  _renderProductPills();
  if (_selectedProduct) {
    _renderBarChart();
    _renderReviewList(filterState);
  }
  if (_activeTab === "other") _renderOtherBarChart();
}

// ── Memoization helpers ───────────────────────────────────────────────

function _ensureFilteredSummary(filterState) {
  if (_filteredSummary !== null) return;

  const { selectedBanks, platform } = filterState || {};
  _filteredSummary = _productSummary.filter((r) => {
    if (selectedBanks && selectedBanks.length && !selectedBanks.includes(r.bank)) return false;
    if (_selectedProductBank !== "all" && r.bank !== _selectedProductBank) return false;
    if (platform && platform !== "all" && r.platform !== platform) return false;
    return true;
  });

  _aggregatedByProduct = {};
  for (const cat of PRODUCT_CATEGORIES) {
    _aggregatedByProduct[cat] = { total: 0, low: 0, mid: 0, high: 0 };
  }
  for (const r of _filteredSummary) {
    const cat = r.product_line;
    if (!_aggregatedByProduct[cat]) continue;
    _aggregatedByProduct[cat].total += num(r.total_count);
    _aggregatedByProduct[cat].low   += num(r.low_count);
    _aggregatedByProduct[cat].mid   += num(r.mid_count);
    _aggregatedByProduct[cat].high  += num(r.high_count);
  }
}

function _ensureFilteredReviews(filterState) {
  if (_filteredReviews !== null) return;

  const { selectedBanks, platform } = filterState || {};
  _filteredReviews = _productReviews.filter((r) => {
    if (r.product_line !== _selectedProduct) return false;
    if (selectedBanks && selectedBanks.length && !selectedBanks.includes(r.bank)) return false;
    if (_selectedProductBank !== "all" && r.bank !== _selectedProductBank) return false;
    if (platform && platform !== "all" && r.platform !== platform) return false;
    return true;
  });
  _filteredReviews.sort((a, b) => {
    const rDiff = num(a.rating) - num(b.rating);
    if (rDiff !== 0) return rDiff;
    return (b.date || "").localeCompare(a.date || "");
  });
}

function _getStarGroupRows(rows) {
  if (!_selectedStarGroup) return rows;
  return rows.filter((r) => {
    const rating = num(r.rating);
    if (_selectedStarGroup === "low")  return rating >= 1 && rating <= 2;
    if (_selectedStarGroup === "mid")  return rating === 3;
    if (_selectedStarGroup === "high") return rating >= 4;
    return true;
  });
}

// ── Bank select ───────────────────────────────────────────────────────

function _renderBankSelect(availableBanks) {
  const sel = document.getElementById("product-bank-select");
  if (!sel) return;

  sel.innerHTML = `<option value="all">全部銀行</option>` +
    availableBanks.map((b) => `<option value="${b}">${b}</option>`).join("");
  sel.value = _selectedProductBank;

  sel.onchange = () => {
    _selectedProductBank = sel.value;
    _lastFilterKey = null; // force cache invalidation
    _filteredSummary = null;
    _aggregatedByProduct = null;
    _filteredReviews = null;
    _selectedStarGroup = null;
    _currentPage = 1;
    renderProductAnalysis(_productSummary, _lastGlobalFilterState);
  };
}

// ── Pie chart ──────────────────────────────────────────────────────────

function _renderPieChart() {
  const canvas = document.getElementById("chart-product-pie");
  if (!canvas) return;

  const grandTotal = PRODUCT_CATEGORIES.reduce((s, cat) => s + (_aggregatedByProduct[cat]?.total || 0), 0);
  const labels = PRODUCT_CATEGORIES.filter((cat) => cat !== "其他" && (_aggregatedByProduct[cat]?.total || 0) > 0);
  const data   = labels.map((cat) => _aggregatedByProduct[cat].total);
  const colors = labels.map((cat) => PRODUCT_COLORS[cat]);

  const pieData = {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.map((c) => c + "cc"),
      borderColor: colors,
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: { size: 12 }, padding: 12, color: "#334155" },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const cat = ctx.label;
            const agg = _aggregatedByProduct[cat] || {};
            const total = agg.total || 0;
            const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : "0.0";
            return [
              ` 共 ${total} 則 (${pct}%)`,
              ` 低評 1-2★: ${agg.low || 0} 則`,
              ` 中評 3★:   ${agg.mid || 0} 則`,
              ` 高評 4-5★: ${agg.high || 0} 則`,
            ];
          },
        },
      },
    },
    onClick: (_e, elements) => {
      if (!elements.length) return;
      const cat = labels[elements[0].index];
      _selectProduct(cat);
    },
  };

  if (_chartPie) {
    _chartPie.data = pieData;
    _chartPie.options = options;
    _chartPie.update();
  } else {
    _chartPie = new Chart(canvas, { type: "pie", data: pieData, options });
  }
}

// ── Product pills ──────────────────────────────────────────────────────

function _renderProductPills() {
  const container = document.getElementById("product-line-pills");
  if (!container) return;

  container.innerHTML = PRODUCT_CATEGORIES.map((cat) => {
    const isActive = cat === _selectedProduct;
    const color = PRODUCT_COLORS[cat];
    const count = _aggregatedByProduct[cat]?.total || 0;
    const style = isActive
      ? `background:${color};color:#fff;border-color:${color}`
      : `background:#fff;color:var(--text-primary);border-color:var(--border)`;
    return `<button class="product-line-pill" data-product="${cat}"
      style="padding:0.3rem 0.85rem;border-radius:999px;border:1.5px solid;font-size:0.8rem;cursor:pointer;transition:all 0.15s;${style}"
    >${cat} <span style="font-size:0.72rem;opacity:0.8">${count}</span></button>`;
  }).join("");

  container.querySelectorAll(".product-line-pill").forEach((btn) => {
    btn.addEventListener("click", () => _selectProduct(btn.dataset.product));
  });
}

function _selectProduct(cat) {
  const reviewCard = document.getElementById("product-reviews-card");

  if (_selectedProduct === cat) {
    _selectedProduct = null;
    _selectedStarGroup = null;
    _filteredReviews = null;
    _currentPage = 1;
    if (_chartBar) { _chartBar.destroy(); _chartBar = null; }
    const titleEl = document.getElementById("product-bar-title");
    if (titleEl) titleEl.textContent = "請選擇產品線";
    if (reviewCard) reviewCard.style.display = "none";
  } else {
    _selectedProduct = cat;
    _selectedStarGroup = null;
    _filteredReviews = null;
    _currentPage = 1;
    _renderBarChart();
    _renderReviewList();
  }
  _renderProductPills();
}

// ── Bar chart ──────────────────────────────────────────────────────────

function _renderBarChart() {
  const canvas = document.getElementById("chart-product-bar");
  if (!canvas || !_selectedProduct) return;

  const agg = _aggregatedByProduct[_selectedProduct] || {};
  const starGroupKeys = ["low", "mid", "high"];
  const labels = ["低評 1-2★", "中評 3★", "高評 4-5★"];
  const values = [agg.low || 0, agg.mid || 0, agg.high || 0];

  const baseColors  = ["#fca5a5", "#fcd34d", "#86efac"];
  const activeColors = ["#dc2626", "#d97706", "#16a34a"];
  const bgColors = baseColors.map((c, i) =>
    _selectedStarGroup === starGroupKeys[i] ? activeColors[i] : c
  );
  const borderColors = ["#dc2626", "#d97706", "#16a34a"];

  const barData = {
    labels,
    datasets: [{
      label: _selectedProduct,
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 2,
      borderRadius: 4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${ctx.raw} 則` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#334155", font: { size: 12 } } },
      y: { beginAtZero: true, ticks: { precision: 0, color: "#94a3b8" }, grid: { color: "#e2e8f0" } },
    },
    onClick: (_e, elements) => {
      if (!elements.length) {
        _selectedStarGroup = null;
      } else {
        const key = starGroupKeys[elements[0].index];
        _selectedStarGroup = _selectedStarGroup === key ? null : key;
      }
      _filteredReviews = null;
      _currentPage = 1;
      _renderBarChart();
      _renderReviewList();
    },
  };

  const title = document.getElementById("product-bar-title");
  if (title) title.textContent = `「${_selectedProduct}」評分分佈`;

  if (_chartBar) {
    _chartBar.data = barData;
    _chartBar.options = options;
    _chartBar.update();
  } else {
    _chartBar = new Chart(canvas, { type: "bar", data: barData, options });
  }
}

// ── Review list ────────────────────────────────────────────────────────

function _renderReviewList(filterState) {
  const card = document.getElementById("product-reviews-card");
  if (!card) return;
  if (!_selectedProduct) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";

  _ensureFilteredReviews(filterState || { selectedBanks: [], platform: "all" });
  const visibleRows = _getStarGroupRows(_filteredReviews);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  if (_currentPage > totalPages) _currentPage = totalPages;

  const titleEl = document.getElementById("product-reviews-title");
  const totalEl = document.getElementById("product-reviews-total");
  const badgeEl = document.getElementById("product-star-group-badge");
  const closeBtn = document.getElementById("product-reviews-close");

  if (titleEl) titleEl.textContent = `「${_selectedProduct}」相關評論`;
  if (totalEl) totalEl.textContent = `共 ${visibleRows.length} 則`;
  if (badgeEl) {
    const labels = { low: "低評 1-2★", mid: "中評 3★", high: "高評 4-5★" };
    badgeEl.textContent = _selectedStarGroup ? labels[_selectedStarGroup] : "";
    badgeEl.style.display = _selectedStarGroup ? "inline" : "none";
  }
  if (closeBtn) {
    closeBtn.onclick = () => _selectProduct(_selectedProduct);
  }

  const pageRows = visibleRows.slice((_currentPage - 1) * PAGE_SIZE, _currentPage * PAGE_SIZE);
  const tbody = document.getElementById("product-reviews-tbody");
  if (!tbody) return;

  if (!pageRows.length) {
    const msg = _productReviews.length === 0 ? "評論資料載入中..." : "無符合條件的評論";
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm" style="color:var(--text-secondary)">${msg}</td></tr>`;
  } else {
    const catColor = PRODUCT_COLORS[_selectedProduct] || "#94a3b8";
    tbody.innerHTML = pageRows.map((r) => {
      const rating = num(r.rating);
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const starColor = rating <= 2 ? "#dc2626" : rating === 3 ? "#d97706" : "#16a34a";
      const platformIcon = r.platform === "App Store" ? "🍎" : "🤖";
      const isYuanta = r.bank === YUANTA;
      const reviewText = (r.review || "").trim();
      const short = reviewText.slice(0, 120);
      const expandHtml = reviewText.length > 120
        ? `<details style="display:inline"><summary style="color:var(--accent);cursor:pointer;font-size:0.75rem;margin-left:0.25rem">展開</summary><span style="color:var(--text-primary)"> ${reviewText.slice(120)}</span></details>`
        : "";
      return `<tr style="background:${isYuanta ? "#fffbeb" : "#ffffff"}">
        <td class="px-3 py-2 text-xs whitespace-nowrap" style="color:var(--text-secondary)">${(r.date || "").slice(0, 10)}</td>
        <td class="px-3 py-2 text-sm">${platformIcon} <span style="${isYuanta ? "color:var(--accent);font-weight:600" : "color:var(--text-primary)"}">${r.bank}</span></td>
        <td class="px-3 py-2 text-sm whitespace-nowrap" style="color:${starColor}">${stars}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">
          <span style="padding:0.15rem 0.5rem;border-radius:999px;border:1.5px solid ${catColor};color:${catColor};font-weight:600;font-size:0.72rem">${r.product_line || ""}</span>
        </td>
        <td class="px-3 py-2 text-sm max-w-sm" style="color:var(--text-primary)">${short}${expandHtml}</td>
      </tr>`;
    }).join("");
  }

  _renderListPagination(totalPages, _currentPage, (p) => { _currentPage = p; _renderReviewList(); });
}

function _renderListPagination(totalPages, currentPage, onPageChange) {
  const container = document.getElementById("product-reviews-pagination");
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  const pages = _getPaginationRange(currentPage, totalPages);
  const btnBase = "padding:0.2rem 0.6rem;border-radius:0.375rem;border:1px solid var(--border);font-size:0.78rem;min-width:2rem;cursor:pointer";
  const activeBg = "background:var(--accent);color:#fff";
  const inactiveBg = "background:var(--bg-card);color:var(--text-primary)";
  const disabledStyle = "opacity:0.4;cursor:default";

  const buttons = pages.map((p) =>
    p === "…"
      ? `<span style="padding:0.2rem 0.3rem;color:var(--text-secondary);font-size:0.78rem">…</span>`
      : `<button style="${btnBase};${p === currentPage ? activeBg : inactiveBg}${p === currentPage ? ";cursor:default" : ""}" data-page="${p}" ${p === currentPage ? "disabled" : ""}>${p}</button>`
  );

  const prevDisabled = currentPage === 1;
  const nextDisabled = currentPage === totalPages;

  container.innerHTML =
    `<button style="${btnBase};${inactiveBg};${prevDisabled ? disabledStyle : ""}" data-page="${currentPage - 1}" ${prevDisabled ? "disabled" : ""}>‹</button>` +
    buttons.join("") +
    `<button style="${btnBase};${inactiveBg};${nextDisabled ? disabledStyle : ""}" data-page="${currentPage + 1}" ${nextDisabled ? "disabled" : ""}>›</button>`;

  container.querySelectorAll("button[data-page]:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      onPageChange(parseInt(btn.dataset.page));
      document.getElementById("product-reviews-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function _getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

// ── "其他" tab bar chart ───────────────────────────────────────────────

function _renderOtherBarChart() {
  const canvas = document.getElementById("chart-other-bar");
  if (!canvas || !_aggregatedByProduct) return;

  const agg = _aggregatedByProduct["其他"] || {};
  const starGroupKeys = ["low", "mid", "high"];
  const labels = ["低評 1-2★", "中評 3★", "高評 4-5★"];
  const values = [agg.low || 0, agg.mid || 0, agg.high || 0];

  const baseColors  = ["#fca5a5", "#fcd34d", "#86efac"];
  const activeColors = ["#dc2626", "#d97706", "#16a34a"];
  const bgColors = baseColors.map((c, i) => _otherStarGroup === starGroupKeys[i] ? activeColors[i] : c);
  const borderColors = ["#dc2626", "#d97706", "#16a34a"];

  const barData = {
    labels,
    datasets: [{
      label: "其他",
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 2,
      borderRadius: 4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} 則` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#334155", font: { size: 12 } } },
      y: { beginAtZero: true, ticks: { precision: 0, color: "#94a3b8" }, grid: { color: "#e2e8f0" } },
    },
    onClick: (_e, elements) => {
      if (!elements.length) {
        _otherStarGroup = null;
      } else {
        const key = starGroupKeys[elements[0].index];
        _otherStarGroup = _otherStarGroup === key ? null : key;
      }
      _otherCurrentPage = 1;
      _renderOtherBarChart();
      if (_otherStarGroup !== null) {
        _renderOtherReviewList();
      } else {
        const card = document.getElementById("product-reviews-card");
        if (card) card.style.display = "none";
      }
    },
  };

  if (_chartOtherBar) {
    _chartOtherBar.data = barData;
    _chartOtherBar.options = options;
    _chartOtherBar.update();
  } else {
    _chartOtherBar = new Chart(canvas, { type: "bar", data: barData, options });
  }
}

// ── "其他" tab review list ─────────────────────────────────────────────

function _renderOtherReviewList() {
  const card = document.getElementById("product-reviews-card");
  if (!card) return;

  const { selectedBanks, platform } = _lastGlobalFilterState || {};
  let rows = _productReviews.filter((r) => {
    if (r.product_line !== "其他") return false;
    if (selectedBanks?.length && !selectedBanks.includes(r.bank)) return false;
    if (_selectedProductBank !== "all" && r.bank !== _selectedProductBank) return false;
    if (platform && platform !== "all" && r.platform !== platform) return false;
    return true;
  });

  rows.sort((a, b) => num(a.rating) - num(b.rating) || (b.date || "").localeCompare(a.date || ""));

  if (_otherStarGroup) {
    rows = rows.filter((r) => {
      const rating = num(r.rating);
      if (_otherStarGroup === "low") return rating <= 2;
      if (_otherStarGroup === "mid") return rating === 3;
      if (_otherStarGroup === "high") return rating >= 4;
      return true;
    });
  }

  card.style.display = "block";

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (_otherCurrentPage > totalPages) _otherCurrentPage = totalPages;

  const titleEl = document.getElementById("product-reviews-title");
  const totalEl = document.getElementById("product-reviews-total");
  const badgeEl = document.getElementById("product-star-group-badge");
  const closeBtn = document.getElementById("product-reviews-close");

  if (titleEl) titleEl.textContent = `「其他」相關評論`;
  if (totalEl) totalEl.textContent = `共 ${rows.length} 則`;
  if (badgeEl) {
    const starLabels = { low: "低評 1-2★", mid: "中評 3★", high: "高評 4-5★" };
    badgeEl.textContent = _otherStarGroup ? starLabels[_otherStarGroup] : "";
    badgeEl.style.display = _otherStarGroup ? "inline" : "none";
  }
  if (closeBtn) {
    closeBtn.onclick = () => {
      _otherStarGroup = null;
      card.style.display = "none";
      _renderOtherBarChart();
    };
  }

  const pageRows = rows.slice((_otherCurrentPage - 1) * PAGE_SIZE, _otherCurrentPage * PAGE_SIZE);
  const tbody = document.getElementById("product-reviews-tbody");
  if (!tbody) return;

  if (!pageRows.length) {
    const msg = _productReviews.length === 0 ? "評論資料載入中..." : "無符合條件的評論";
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm" style="color:var(--text-secondary)">${msg}</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map((r) => {
      const rating = num(r.rating);
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const starColor = rating <= 2 ? "#dc2626" : rating === 3 ? "#d97706" : "#16a34a";
      const platformIcon = r.platform === "App Store" ? "🍎" : "🤖";
      const isYuanta = r.bank === YUANTA;
      const reviewText = (r.review || "").trim();
      const short = reviewText.slice(0, 120);
      const expandHtml = reviewText.length > 120
        ? `<details style="display:inline"><summary style="color:var(--accent);cursor:pointer;font-size:0.75rem;margin-left:0.25rem">展開</summary><span style="color:var(--text-primary)"> ${reviewText.slice(120)}</span></details>`
        : "";
      return `<tr style="background:${isYuanta ? "#fffbeb" : "#ffffff"}">
        <td class="px-3 py-2 text-xs whitespace-nowrap" style="color:var(--text-secondary)">${(r.date || "").slice(0, 10)}</td>
        <td class="px-3 py-2 text-sm">${platformIcon} <span style="${isYuanta ? "color:var(--accent);font-weight:600" : "color:var(--text-primary)"}">${r.bank}</span></td>
        <td class="px-3 py-2 text-sm whitespace-nowrap" style="color:${starColor}">${stars}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">
          <span style="padding:0.15rem 0.5rem;border-radius:999px;border:1.5px solid #94a3b8;color:#94a3b8;font-weight:600;font-size:0.72rem">其他</span>
        </td>
        <td class="px-3 py-2 text-sm max-w-sm" style="color:var(--text-primary)">${short}${expandHtml}</td>
      </tr>`;
    }).join("");
  }

  _renderListPagination(totalPages, _otherCurrentPage, (p) => { _otherCurrentPage = p; _renderOtherReviewList(); });
}

// ── Tab switcher (exported, exposed via window in index.html) ──────────

export function switchProductTab(tab) {
  _activeTab = tab;
  const productsPanel = document.getElementById("product-tab-products");
  const otherPanel    = document.getElementById("product-tab-other");
  const btnP = document.getElementById("product-tab-btn-products");
  const btnO = document.getElementById("product-tab-btn-other");

  if (tab === "products") {
    if (productsPanel) productsPanel.style.display = "";
    if (otherPanel)    otherPanel.style.display = "none";
    if (btnP) { btnP.style.color = "var(--accent)"; btnP.style.borderBottomColor = "var(--accent)"; }
    if (btnO) { btnO.style.color = "var(--text-secondary)"; btnO.style.borderBottomColor = "transparent"; }
    const reviewCard = document.getElementById("product-reviews-card");
    if (_selectedProduct) {
      _renderReviewList();
    } else if (reviewCard) {
      reviewCard.style.display = "none";
    }
  } else {
    if (productsPanel) productsPanel.style.display = "none";
    if (otherPanel)    otherPanel.style.display = "";
    if (btnP) { btnP.style.color = "var(--text-secondary)"; btnP.style.borderBottomColor = "transparent"; }
    if (btnO) { btnO.style.color = "var(--accent)"; btnO.style.borderBottomColor = "var(--accent)"; }
    if (_aggregatedByProduct) _renderOtherBarChart();
    const reviewCard = document.getElementById("product-reviews-card");
    if (reviewCard) reviewCard.style.display = "none";
  }
}
