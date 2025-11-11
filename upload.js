// upload.js - 託管專用終極版（不再用 $(date)，改用 JS 時間）
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const IGNORE = ['.env', './data', '.gitkeep', 'node_modules', '.git', 'update.js', 'upload.js', 'github_update.js', 'update.zip', 'update-temp'];

// 顏色
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

console.log(`${cyan}🚀 ExhoBOT 上傳工具 - 託管專用版${reset}\n`);

try {
  // Step 1: 自動初始化 Git
  if (!fs.existsSync('.git')) {
    console.log(`${yellow}未偵測到 Git 倉庫，自動初始化...${reset}`);
    execSync('git init', { stdio: 'inherit' });
    execSync('git checkout -b main', { stdio: 'inherit' });
  }

  // Step 2: 設定遠端（如果沒有）
  let hasRemote = false;
  try {
    execSync('git remote show origin', { stdio: 'ignore' });
    hasRemote = true;
  } catch {}
  
  if (!hasRemote) {
    const repo = 'https://github.com/kairo0916/ai-exho-discord-bot.git';
    console.log(`${yellow}設定遠端倉庫：${repo}${reset}`);
    execSync(`git remote add origin ${repo}`, { stdio: 'inherit' });
  }

  // Step 3: 設定 Git 帳號（託管必備！）
  try {
    execSync('git config user.name', { stdio: 'ignore' });
  } catch {
    console.log(`${yellow}設定 Git 帳號為 kairo0916${reset}`);
    execSync('git config user.name "kairo0916"', { stdio: 'inherit' });
    execSync('git config user.email "kairo.tw0916@gmail.com"', { stdio: 'inherit' });
  }

  // Step 4: 清理 data 資料夾
  const dataDir = './data';
  if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir).forEach(item => {
      if (item !== 'user') {
        fs.removeSync(path.join(dataDir, item));
        console.log(`🗑️ 清除: data/${item}`);
      }
    });
    fs.ensureDirSync('./data/user');
    fs.readdirSync('./data/user').forEach(f => fs.removeSync(`./data/user/${f}`));
    fs.writeFileSync('./data/user/.gitkeep', '# 本地使用者資料\n# 不上傳到 GitHub');
    console.log(`🗂️ 保留空資料夾: data/user/`);
  }

  // Step 5: 添加所有檔案
  console.log(`${cyan}添加檔案中...${reset}`);
  execSync('git add -A', { stdio: 'inherit' });

  // Step 6: 檢查是否有變更
  const status = execSync('git status --porcelain').toString().trim();
  if (!status) {
    console.log(`${green}沒有任何變更，GitHub 已是最新的！${reset}`);
    process.exit(0);
  }

  // Step 7: 提交（用 JS 產生時間，避開 $(date) 問題）
  const now = new Date();
  const timeStr = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/[/:]/g, '-');
  const commitMsg = `chore: update bot files - ${timeStr}`;

  console.log(`${cyan}提交變更：${commitMsg}${reset}`);
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

  // Step 8: 強制推送
  console.log(`${cyan}強制推送到 GitHub...${reset}`);
  execSync('git push -f origin main', { stdio: 'inherit' });

  console.log(`\n${green}🎉 上傳成功！GitHub 已更新！${reset}`);
  console.log(`${yellow}請去 GitHub 建立 Release 並打 Tag (例如 v1.0.1)${reset}`);
  console.log(`${yellow}網址：https://github.com/kairo0916/ai-exho-discord-bot/releases/new${reset}`);

} catch (err) {
  console.error(`${red}上傳失敗：${err.message}${reset}`);
  console.log(`${yellow}常見解決：${reset}`);
  console.log(`   1. 確認 GitHub 倉庫存在且為 public`);
  console.log(`   2. 若為 private，需設定 GitHub Token`);
  console.log(`   3. 控制台輸入：git push -f origin main 試試看`);
  process.exit(1);
}