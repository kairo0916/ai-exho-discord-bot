// upload.js - 最終完美版（已修好語法錯誤）
require('dotenv').config(); // 一定要最上面！

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// 強制檢查 Token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
if (!GITHUB_TOKEN) {
  console.error('\n錯誤：找不到 GITHUB_TOKEN！');
  console.error('請確認 .env 檔案中有這一行：');
  console.error('GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  console.error('而且 .env 檔案要跟 upload.js 在同一層！\n');
  process.exit(1);
}

console.log('Token 讀取成功！\n');

// 顏色
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

console.log(`${cyan}ExhoBOT 上傳工具 - 最終完美版${reset}\n`);

try {
  // 初始化 Git
  if (!fs.existsSync('.git')) {
    console.log(`${yellow}初始化 Git 倉庫...${reset}`);
    execSync('git init', { stdio: 'inherit' });
    execSync('git checkout -b main', { stdio: 'inherit' });
  }

  // 設定帳號
  execSync('git config user.name "kairo0916"', { stdio: 'ignore' });
  execSync('git config user.email "kairo.tw0916@gmail.com"', { stdio: 'ignore' });

  // 設定遠端（用 Token）
  const repoUrl = `https://${GITHUB_TOKEN}@github.com/kairo0916/ai-exho-discord-bot.git`;
  try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch {}
  execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  console.log(`${green}遠端已設定（使用 Token）${reset}`);

  // 清理 data
  const dataDir = './data';
  if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir).forEach(item => {
      if (item !== 'user') fs.removeSync(path.join(dataDir, item));
    });
    fs.ensureDirSync('./data/user');
    fs.readdirSync('./data/user').forEach(f => fs.removeSync(`./data/user/${f}`));
    fs.writeFileSync('./data/user/.gitkeep', '# Local user data\n# 不上傳到 GitHub');
  }

  // 添加檔案
  console.log(`${cyan}添加檔案...${reset}`);
  execSync('git add -A', { stdio: 'inherit' });

  // 檢查變更
  const status = execSync('git status --porcelain').toString().trim();
  if (!status) {
    console.log(`${green}沒有變更，GitHub 已最新！${reset}`);
    process.exit(0);
  }

  // 提交
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/[/:]/g, '-');
  const msg = `chore: update bot files - ${now}`;
  console.log(`${cyan}提交：${msg}${reset}`);
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' }); // 正確語法！

  // 強制推送
  console.log(`${cyan}推送到 GitHub...${reset}`);
  execSync('git push -f origin main', { stdio: 'inherit' }); // 正確語法！

  console.log(`\n${green}上傳成功！GitHub 已更新！${reset}`);
  console.log(`${yellow}請去建立 Release：https://github.com/kairo0916/ai-exho-discord-bot/releases/new${reset}`);

} catch (err) {
  console.error(`${red}失敗：${err.message}${reset}`);
  process.exit(1);
}