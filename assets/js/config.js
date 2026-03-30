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

// Bank logo local paths (relative to dashboard/index.html)
export const BANK_LOGOS = {
  "元大銀行": "assets/logos/yuanta.png",
  "台灣銀行": "assets/logos/bot.png",
  "土地銀行": "assets/logos/landbank.png",
  "合作金庫": "assets/logos/tcb.png",
  "第一銀行": "assets/logos/firstbank.png",
  "華南銀行": "assets/logos/hncb.png",
  "彰化銀行": "assets/logos/bankchb.png",
  "台北富邦": "assets/logos/fubon.png",
  "國泰世華": "assets/logos/cathaybk.png",
  "玉山銀行": "assets/logos/esunbank.png",
  "台新銀行": "assets/logos/taishin.png",
  "中國信託": "assets/logos/ctbc.png",
  "兆豐銀行": "assets/logos/megabank.png",
  "台灣企銀": "assets/logos/tbb.png",
  "永豐銀行": "assets/logos/sinopac.png",
  "凱基銀行": "assets/logos/kgibank.png",
  "星展銀行": "assets/logos/dbs.png",
  "渣打銀行": "assets/logos/sc.png",
  "遠東商銀": "assets/logos/feib.png",
};

// Colors for banks in charts — derived from each bank's logo
export const BANK_COLORS = {
  "元大銀行": "#F7941D",  // 元大橘（維持）
  "台灣銀行": "#8C0028",  // from logo
  "土地銀行": "#00503C",  // from logo
  "合作金庫": "#007864",  // from logo
  "第一銀行": "#785014",  // from logo
  "華南銀行": "#DC0000",  // from logo
  "彰化銀行": "#DC0000",  // from logo
  "台北富邦": "#008C8C",  // from logo
  "國泰世華": "#00783C",  // from logo
  "玉山銀行": "#64A0A0",  // from logo
  "台新銀行": "#C80000",  // from logo
  "中國信託": "#007878",  // from logo
  "兆豐銀行": "#A07814",  // from logo
  "台灣企銀": "#DC5000",  // from logo
  "永豐銀行": "#DC1400",  // from logo
  "凱基銀行": "#002878",  // from logo
  "星展銀行": "#DC1414",  // from logo
  "渣打銀行": "#0064DC",  // from logo
  "遠東商銀": "#B42814",  // from logo
};
