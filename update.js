// update.js - 終極更新腳本（支援首次拉取 + 保護本地資料）
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const GITHUB_API = 'https://api.github.com/repos/kairo0916/ai-exho-discord-bot/releases/latest';
const ZIP_URL = 'https://github.com/kairo0916/ai-exho-discord-bot/archive/refs/heads/main.zip';
const CURRENT_VERSION = process.env.BOT_VERSION || 'unknown';

// 絕對不會覆蓋的檔案
const PROTECTED = [
  '.env',
  'data/user',
  'data/',
  'dailyQuote.txt'
];

// 只更新有變動的檔案
async function getLatestVersion() {
  try {
    const res = await fetch(GITHUB_API);
    const data = await res.json();
    return data.tag_name?.replace('v', '') || null;
  } catch {
    return null;
  }
}

function downloadAndUpdate() {
  const zipPath = 'update.zip';
  const tempDir = 'update-temp';

  console.log('下載更新包...');
  execSync(`curl -L ${ZIP_URL} -o ${zipPath}`);

  console.log('解壓中...');
  fs.removeSync(tempDir);
  execSync(`unzip -q ${zipPath} -d ${tempDir}`);
  fs.removeSync(zipPath);

  const extracted = fs.readdirSync(tempDir)[0];
  const source = path.join(tempDir, extracted);

  // 只更新有變動的檔案
  let updated = 0;
  fs.readdirSync(source).forEach(item => {
    const src = path.join(source, item);
    const dest = path.join(__dirname, item);

    if (PROTECTED.includes(item) || PROTECTED.includes(`data/${item}`)) {
      console.log(`保護: ${item}`);
      return;
    }

    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.mtimeMs <= destStat.mtimeMs && srcStat.size === destStat.size) {
        console.log(`無變動: ${item}`);
        return;
      }
    }

    fs.copySync(src, dest, { overwrite: true });
    console.log(`更新: ${item}`);
    updated++;
  });

  fs.removeSync(tempDir);
  return updated;
}

async function main() {
  console.log('檢查更新...\n');
  const latest = await getLatestVersion();

  if (!latest) {
    console.log('無法連線到 GitHub，稍後再試');
    process.exit(0);
  }

  if (fs.existsSync('bot.js') && latest <= CURRENT_VERSION) {
    console.log('已是最新版本！');
    process.exit(0);
  }

  console.log(`有新版本可用！`);
  console.log(`目前：${CURRENT_VERSION}`);
  console.log(`最新：${latest || '未知'}`);
  console.log(`執行更新將下載最新檔案（不影響 .env 和使用者資料）`);
  console.log(`請在執行更新前將重要資料備份完畢（例：.env, ./data, ./data/user, dailyQuote.txt）\n`);

  rl.question('輸入 "繼續" 開始更新，輸入 "取消" 離開：', async (ans) => {
    if (!['繼續', 'confirm', 'yes'].includes(ans.trim())) {
      console.log('已取消');
      rl.close();
      return;
    }

    console.log('\n更新中... 請耐心等待...\n');

    try {
      const count = downloadAndUpdate();
      console.log(`\n更新完成！共更新 ${count} 個檔案`);
      console.log('已保護：.env、data/user、dailyQuote.txt');
      console.log('請重啟機器人以套用更新！');
    } catch (err) {
      console.error('更新失敗：', err.message);
    }

    rl.close();
  });
}

main();