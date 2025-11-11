const fs = require('fs');
const fetch = require('node-fetch');

setInterval(async () => {
  try {
    const res = await fetch('https://api.github.com/repos/kairo0916/ai-exho-discord-bot/releases/latest');
    const data = await res.json();
    const latest = data.tag_name?.replace('v', '');
    const current = process.env.BOT_VERSION || 'unknown';

    if (latest && latest > current) {
      console.log(`\n有新版本！${current} → ${latest}`);
      console.log(`執行 node update.js 更新`);
    }
  } catch {}
}, 10 * 60 * 1000);