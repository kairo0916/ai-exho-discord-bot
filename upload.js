require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
if (!GITHUB_TOKEN) {
  console.error('錯誤：.env 缺少 GITHUB_TOKEN');
  process.exit(1);
}

// 固定內容
const FIXED_FILES = {
  'data/banlist.json': '[]',
  'data/report_time.json': '{}',
  'data/last_status_message.json': '{}',
  'data/marriage.json': '{}',
  'data/used_command.txt': ''
};

console.log('正在準備上傳到 GitHub...\n');

try {
  // 1. 初始化 Git
  if (!fs.existsSync('.git')) {
    execSync('git init', { stdio: 'inherit' });
    execSync('git checkout -b main', { stdio: 'inherit' });
  }

  // 2. 設定帳號
  execSync('git config user.name "kairo0916"', { stdio: 'ignore' });
  execSync('git config user.email "kairo.tw0916@gmail.com"', { stdio: 'ignore' });

  // 3. 設定遠端
  const repo = `https://${GITHUB_TOKEN}@github.com/kairo0916/ai-exho-discord-bot.git`;
  try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch {}
  execSync(`git remote add origin ${repo}`, { stdio: 'inherit' });

  // 4. 建立固定檔案
  fs.ensureDirSync('data');
  for (const [file, content] of Object.entries(FIXED_FILES)) {
    fs.writeFileSync(file, content);
    console.log(`固定檔案: ${file}`);
  }

  // 5. 建立空 user 資料夾
  fs.ensureDirSync('data/user');
  fs.writeFileSync('data/user/.gitkeep', '# 本地使用者資料，勿刪除');

  // 6. 強制添加所有檔案（包含固定內容）
  execSync('git add -A', { stdio: 'inherit' });

  // 7. 提交
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/[/:]/g, '-');
  execSync(`git commit -m "chore: update files - ${now}"`, { stdio: 'inherit' });

  // 8. 強制推送
  execSync('git push -f origin main', { stdio: 'inherit' });

  console.log('\n上傳成功！GitHub 已更新！');
  console.log('請去建立 Release：https://github.com/kairo0916/ai-exho-discord-bot/releases/new');

} catch (err) {
  console.error('上傳失敗：', err.message);
}