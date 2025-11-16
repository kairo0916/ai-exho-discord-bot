// import.js
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// 讀取 settings.json
let settings = {};
try {
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
  settings = JSON.parse(raw);
} catch (err) {
  console.error("[import.js] 無法讀取 settings.json：", err.message);
  settings = {};
}

// --------------------------------------------------
// 把 settings.json 全部掛到 global.CONFIG
// --------------------------------------------------
global.CONFIG = settings;

// --------------------------------------------------
// 同時把每一個 key 掛到 global（名稱完全不變）
// 例如 settings.prefix → global.prefix
// --------------------------------------------------
for (const [key, value] of Object.entries(settings)) {
  global[key] = value;
}
