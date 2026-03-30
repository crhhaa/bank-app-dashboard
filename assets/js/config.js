// ============================================================
// config.js — Update these values after creating your Google Spreadsheet
// ============================================================

// 1. Your Google Spreadsheet ID (from the URL)
export const SHEET_ID = "1dN0PnqLdkYX4EjCqPyiI7HfaB0TC1kUTjwywK6KDRSw";

// 1b. Published ID — from "Publish to web" URL:
//     https://docs.google.com/spreadsheets/d/e/{PUBLISHED_ID}/pub?output=csv
export const PUBLISHED_ID = "2PACX-1vRNsy5C78_owfwMm0z_f0SbQZded4an-ffTwtbzmtvsMlgOl1w5RWZIiYnvvOdwv8g_lqOTsBz2Iyx6";

// 2. Tab GIDs — find these by clicking each tab and checking the URL (?gid=XXXXXXX)
export const TAB_GIDS = {
  reviews:        "1359466342",          // Replace with actual GID
  versions:       "826572784",  // Replace with actual GID
  summaryMonthly: "1804124211",  // Replace with actual GID
  summaryBank:    "721331060",  // Replace with actual GID
  keywords:       "689988802",  // Replace with actual GID
  versionImpact:  "897416170",  // Replace with actual GID
  metadata:       "1584438192",  // Replace with actual GID
  // After running upload_to_sheets.py, open the spreadsheet, click each new tab,
  // copy the gid=XXXXXX from the URL, and replace the placeholders below:
  voiceSummary:   "360251231",
  voiceReviews:   "160118393",
};

// Sheets CSV base URL — uses "Publish to web" endpoint (CORS-friendly, works from file:// and GitHub Pages)
export function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv&gid=${gid}`;
}

// All banks in display order
export const ALL_BANKS = [
  "元大銀行", "台灣銀行", "土地銀行", "合作金庫", "第一銀行", "華南銀行",
  "彰化銀行", "台北富邦", "國泰世華", "玉山銀行", "台新銀行", "中國信託",
  "兆豐銀行", "台灣企銀", "永豐銀行", "凱基銀行", "星展銀行", "渣打銀行",
  "遠東商銀"
];

export const YUANTA = "元大銀行";

// Colors for banks in charts (first = Yuanta, always orange; others use saturated colors for light bg)
export const BANK_COLORS = {
  "元大銀行": "#f97316",
  "台灣銀行": "#2563eb",
  "土地銀行": "#7c3aed",
  "合作金庫": "#059669",
  "第一銀行": "#ea580c",
  "華南銀行": "#db2777",
  "彰化銀行": "#475569",
  "台北富邦": "#0284c7",
  "國泰世華": "#9333ea",
  "玉山銀行": "#16a34a",
  "台新銀行": "#e11d48",
  "中國信託": "#d97706",
  "兆豐銀行": "#c026d3",
  "台灣企銀": "#0891b2",
  "永豐銀行": "#15803d",
  "凱基銀行": "#dc2626",
  "星展銀行": "#1d4ed8",
  "渣打銀行": "#6d28d9",
  "遠東商銀": "#0f766e",
};
