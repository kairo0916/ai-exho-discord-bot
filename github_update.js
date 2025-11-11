const fs = require('fs');
const path = require('path');

const GITHUB_API_URL = 'https://api.github.com/repos/kairo0916/ai-exho-discord-bot/releases/latest';
const CURRENT_VERSION = process.env.BOT_VERSION || 'unknown';
let hasNotified = false;

async function checkUpdate() {
  try {
    const res = await fetch(GITHUB_API_URL);
    const data = await res.json();
    const latest = data.tag_name?.replace('v', '');

    if (latest && latest > CURRENT_VERSION && !hasNotified) {
      console.log(`\n⚠️ 你的 ExhoBOT 有新版本！`);
      console.log(`   目前版本：${CURRENT_VERSION}`);
      console.log(`   最新版本：${latest}`);
      console.log(`   執行 node update.js 來執行更新！（請先備份好資料在執行指令）\n`);
      hasNotified = true;
    }
  } catch (err) {
  }
}

checkUpdate();

setInterval(checkUpdate, 10 * 60 * 1000);

module.exports = { checkUpdate };