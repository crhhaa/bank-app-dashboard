// filters.js — Global filter state management
import { ALL_BANKS, YUANTA } from "./config.js";

export const state = {
  selectedBanks: [...ALL_BANKS],
  platform: "all", // "all" | "App Store" | "Google Play"
  dateRange: null, // null = all time (time range filter removed from UI)
};

const listeners = [];

export function onFilterChange(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function initFilters(banks) {
  const container = document.getElementById("bank-filters");
  if (!container) return;

  // Wire up "全選/全不選" button (already in HTML)
  const selectAllBtn = document.getElementById("select-all-banks");
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      const allChecked = banks
        .filter((b) => b !== YUANTA)
        .every((b) => state.selectedBanks.includes(b));

      if (allChecked) {
        state.selectedBanks = [YUANTA];
        selectAllBtn.textContent = "全選";
        container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
          if (cb.value !== YUANTA) cb.checked = false;
        });
      } else {
        state.selectedBanks = [...ALL_BANKS];
        selectAllBtn.textContent = "全不選";
        container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
          if (cb.value !== YUANTA) cb.checked = true;
        });
      }
      notify();
    });
  }

  banks.forEach((bank) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 cursor-pointer py-1 px-2 rounded transition";
    label.style.cssText = "transition:background 0.15s";
    label.dataset.bank = bank;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.value = bank;
    cb.className = "rounded";
    if (bank === YUANTA) {
      cb.disabled = true; // Yuanta always selected
      label.className += " opacity-100";
    }

    const span = document.createElement("span");
    span.textContent = bank;
    span.style.fontSize = "0.8rem";
    span.style.color = bank === YUANTA ? "var(--accent)" : "var(--text-primary)";
    if (bank === YUANTA) span.style.fontWeight = "600";

    if (bank === YUANTA) {
      const dot = document.createElement("span");
      dot.style.cssText = "width:0.5rem;height:0.5rem;border-radius:50%;background:var(--accent);display:inline-block;margin-right:0.25rem";
      label.appendChild(dot);
    }

    cb.addEventListener("change", () => {
      if (cb.checked) {
        state.selectedBanks.push(bank);
      } else {
        state.selectedBanks = state.selectedBanks.filter((b) => b !== bank);
        if (!state.selectedBanks.includes(YUANTA)) {
          state.selectedBanks.push(YUANTA);
        }
      }

      // Sync 全選 button label
      const btn = document.getElementById("select-all-banks");
      if (btn) {
        const allChecked = banks
          .filter((b) => b !== YUANTA)
          .every((b) => state.selectedBanks.includes(b));
        btn.textContent = allChecked ? "全不選" : "全選";
      }

      notify();
    });

    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });

  // Platform toggle
  document.querySelectorAll("[data-platform]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-platform]").forEach((b) =>
        b.classList.remove("active-platform")
      );
      btn.classList.add("active-platform");
      state.platform = btn.dataset.platform;
      notify();
    });
  });

  // Date range selector (UI removed; dateRange fixed to null = all time)
}

// Computes each bank's earliest year_month from summaryMonthly and adds
// a "YYYY-MM 起" label in the sidebar bank filter.
export function updateBankDataCoverage(summaryMonthly) {
  const container = document.getElementById("bank-filters");
  if (!container) return;

  // Find earliest month per bank (across all platforms)
  const bankStart = {};
  summaryMonthly.forEach((r) => {
    if (!r.bank || !r.year_month) return;
    if (!bankStart[r.bank] || r.year_month < bankStart[r.bank]) {
      bankStart[r.bank] = r.year_month;
    }
  });

  // Find global earliest month (to know which banks are "late starters")
  const allStarts = Object.values(bankStart).filter(Boolean).sort();
  const globalStart = allStarts[0];
  if (!globalStart) return;

  container.querySelectorAll("label[data-bank]").forEach((label) => {
    const bank = label.dataset.bank;
    const start = bankStart[bank];
    if (!start) return;

    // Remove any existing badge
    label.querySelector(".bank-data-since")?.remove();

    const badge = document.createElement("span");
    badge.className = "bank-data-since";
    badge.textContent = start + " 起";
    // Highlight in amber if data starts 3+ months after global start
    const [gy, gm] = globalStart.split("-").map(Number);
    const [sy, sm] = start.split("-").map(Number);
    const monthsLate = (sy - gy) * 12 + (sm - gm);
    if (monthsLate >= 3) {
      badge.style.color = "#d97706";
      badge.title = `資料起點比其他銀行晚 ${monthsLate} 個月`;
    }
    label.appendChild(badge);
  });
}

// Returns the cutoff date based on dateRange state and the max date in the dataset
export function getDateCutoff(maxDate) {
  if (!state.dateRange) return null;
  const d = new Date(maxDate);
  d.setMonth(d.getMonth() - state.dateRange);
  return d.toISOString().slice(0, 7); // YYYY-MM
}
