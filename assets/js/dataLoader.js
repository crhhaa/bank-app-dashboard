// dataLoader.js — Fetches and parses all Google Sheets CSV tabs
import { sheetUrl, TAB_GIDS } from "./config.js";

const cache = {};

// Parse CSV text → array of objects using PapaParse
function parseCSV(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings, we coerce manually
  });
  return result.data;
}

async function fetchTab(tabName) {
  if (cache[tabName]) return cache[tabName];

  const gid = TAB_GIDS[tabName];
  if (!gid) throw new Error(`Unknown tab: ${tabName}`);

  const url = sheetUrl(gid);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${tabName}: ${resp.status}`);

  const text = await resp.text();
  const data = parseCSV(text);
  cache[tabName] = data;
  return data;
}

function normalizeYearMonth(rows) {
  return rows.map((r) => {
    if (!r.year_month) return r;
    const parts = r.year_month.split("-");
    if (parts.length !== 2) return r;
    return { ...r, year_month: `${parts[0]}-${parts[1].padStart(2, "0")}` };
  });
}

// Load all summary tabs in parallel (fast, small data)
export async function loadSummaryData() {
  const [summaryBank, summaryMonthly, versionImpact, metadata, voiceSummary] =
    await Promise.all([
      fetchTab("summaryBank"),
      fetchTab("summaryMonthly"),
      fetchTab("versionImpact"),
      fetchTab("metadata"),
      fetchTab("voiceSummary").catch(() => []),  // graceful fallback if tab not yet created
    ]);
  return { summaryBank, summaryMonthly: normalizeYearMonth(summaryMonthly), versionImpact, metadata, voiceSummary };
}

// Load tagged voice reviews (large — background load for voice analysis section)
export async function loadVoiceReviews() {
  return fetchTab("voiceReviews");
}

// Load product line summary + tagged reviews (background load for product analysis section)
export async function loadProductData() {
  const [productSummary, productReviews] = await Promise.all([
    fetchTab("productSummary").catch(() => []),
    fetchTab("productReviews").catch(() => []),
  ]);
  return { productSummary, productReviews };
}

// Load raw reviews (large — only for the alerts section)
export async function loadReviews() {
  return fetchTab("reviews");
}

// Load version history
export async function loadVersions() {
  return fetchTab("versions");
}

// Helper: parse float safely
export function num(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// Helper: filter data by bank list and platform
export function filterData(rows, { banks, platform }) {
  return rows.filter((r) => {
    if (banks && banks.length && !banks.includes(r.bank)) return false;
    if (platform && platform !== "all" && r.platform !== platform) return false;
    return true;
  });
}
