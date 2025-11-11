require('dotenv').config();
const fetch = require('node-fetch');

const API = 'https://api.github.com/repos/kairo0916/ai-exho-discord-bot/releases/latest';
let hasNotified = false;

async function checkUpdate(showMessage = true) {
  try {
    const res = await fetch(API);
    if (!res.ok) return;

    const data = await res.json();
    const latest = data.tag_name?.replace('v', '') || 'unknown';
    const current = process.env.BOT_VERSION || 'unknown';

    if (latest === 'unknown') return;

    if (latest > current) {
      if (!hasNotified || !showMessage) {
        console.log(`\n新版本可用！`);
        console.log(`目前版本：${current}`);
        console.log(`最新版本：${latest}`);
        console.log(`執行 node update.js 進行更新！（不會覆蓋 .env 和使用者資料）\n`);
        hasNotified = true;
      }
    }
  } catch (err) {

  }
}

checkUpdate();

setInterval(() => checkUpdate(false), 10 * 60 * 1000);

module.exports = { checkUpdate };