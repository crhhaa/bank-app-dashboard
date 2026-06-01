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
  voiceSummary:    "360251231",
  voiceReviews:    "160118393",
  // After running upload_to_sheets.py, open the spreadsheet, click each new tab,
  // copy the gid=XXXXXX from the URL, and replace the placeholders below:
  productSummary:  "622343940",
  productReviews:  "504547742",
  // After running upload_to_sheets.py, open the spreadsheet, click each new tab,
  // copy the gid=XXXXXX from the URL, and replace the placeholders below:
  painKeywordSummary: "1741784719",
  painReviews: "1439555310",
  // After running upload_to_sheets.py, update this GID from the app_ratings tab URL:
  appRatings: "1285887111",
};

// Sheets CSV base URL — uses "Publish to web" endpoint (CORS-friendly, works from file:// and GitHub Pages)
export function sheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv&gid=${gid}`;
}

// All banks in display order
export const ALL_BANKS = [
  "元大銀行", "台北富邦", "台新銀行", "國泰世華",
  "中國信託", "玉山銀行", "永豐銀行", "凱基銀行"
];

export const YUANTA = "元大銀行";

// Bank logo local paths (relative to dashboard/index.html)
export const BANK_LOGOS = {
  "元大銀行": "assets/logos/yuanta.png",
  "台北富邦": "assets/logos/fubon.png",
  "台新銀行": "assets/logos/taishin.png",
  "國泰世華": "assets/logos/cathaybk.png",
  "中國信託": "assets/logos/ctbc.png",
  "玉山銀行": "assets/logos/esunbank.png",
  "永豐銀行": "assets/logos/sinopac.png",
  "凱基銀行": "assets/logos/kgibank.png",
};

// Colors for banks in charts — derived from each bank's logo
export const BANK_COLORS = {
  "元大銀行": "#F7941D",  // 元大橘（維持）
  "台北富邦": "#008C8C",  // from logo
  "台新銀行": "#C80000",  // from logo
  "國泰世華": "#00783C",  // from logo
  "中國信託": "#007878",  // from logo
  "玉山銀行": "#64A0A0",  // from logo
  "永豐銀行": "#DC1400",  // from logo
  "凱基銀行": "#002878",  // from logo
};
