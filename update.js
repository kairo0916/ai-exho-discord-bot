const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 省略檔案
const IGNORE = ['.env', './data', '.gitkeep', 'node_modules', '.git'];

const GITHUB_API_URL = 'https://api.github.com/repos/kairo0916/ai-exho-discord-bot/releases/latest';
const EXHO_URL = 'https://github.com/kairo0916/ai-exho-discord-bot/archive/refs/heads/main.zip';
const CURRENT_VERSION = process.env.BOT_VERSION;

async function getLatestVersion() {
  try {
    const res = await fetch(GITHUB_API_URL);
    const data = await res.json();
    return data.tag_name?.replace('v', '') || null;
  } catch {
    return null;
  }
}

function downloadAndExtract() {
  const zipPath = path.join(__dirname, 'update.zip');
  const extractPath = path.join(__dirname, 'update-temp');

  console.log('ℹ️ 正在下載更新包...');
  execSync(`curl -L ${EXHO_URL} -o ${zipPath}`, { stdio: 'ignore' });

  console.log('ℹ️ 解壓中...');
  fs.removeSync(extractPath);
  execSync(`unzip -q ${zipPath} -d ${extractPath}`);
  fs.removeSync(zipPath);

  const extractedDir = fs.readdirSync(extractPath)[0];
  const source = path.join(extractPath, extractedDir);

  // 同步檔案（排除忽略項）
  fs.readdirSync(source).forEach(file => {
    const src = path.join(source, file);
    const dest = path.join(__dirname, file);

    if (IGNORE.includes(file) || IGNORE.includes(`./${file}`)) {
      console.log(`跳過: ${file}`);
      return;
    }

    if (fs.statSync(src).isDirectory()) {
      fs.copySync(src, dest, { overwrite: true });
    } else {
      fs.copySync(src, dest);
    }
    console.log(`更新: ${file}`);
  });

  fs.removeSync(extractPath);
}

async function main() {
  console.log('檢查更新中...');
  const latest = await getLatestVersion();

  if (!latest || latest <= CURRENT_VERSION) {
    console.log('已是最新版本！');
    process.exit(0);
  }

  console.log(`\n⚠️ 你的 ExhoBOT 有新版本！`);
  console.log(`   目前版本：${CURRENT_VERSION}`);
  console.log(`   最新版本：${latest}`);
  console.log(`   執行 node update.js 來執行更新！（請先備份好資料在執行指令）\n`);

  rl.question('輸入 "confirm" 或 "繼續" 開始更新，輸入 "cancel" 或 "取消" 取消：', async (answer) => {
    const confirm = answer.trim().toLowerCase();
    if (!['confirm', '繼續'].includes(confirm)) {
      console.log('已取消更新。');
      rl.close();
      return;
    }

    console.log('\nℹ️ 安裝中... 需等待幾分鐘的時間...\n');

    try {
      downloadAndExtract();

      // 強制清空 data 內非 user 的內容
      const dataDir = path.join(__dirname, 'data');
      if (fs.existsSync(dataDir)) {
        fs.readdirSync(dataDir).forEach(item => {
          if (item !== 'user') {
            fs.removeSync(path.join(dataDir, item));
          }
        });
      }

      console.log('\n✅ 已完成更新！請重啟機器人以套用更新！\n');

      console.log('⚠️備註：由於更新腳本為測試版本，所以請確認檔案已完全同步！');
      console.log('若發生問題請恢復備份檔，若未先保存備份檔造成資料丟失，更新腳本怒不負責，還請見諒！');
      console.log('請確認 .env 和 ./data/ 和 ./data/user 檔案及資料未被覆蓋！\n');

      console.log('⚠️Note: This update script is a test version, so please ensure all files are fully synchronized!');
      console.log('If any problems occur, please restore from your backup.');
      console.log('The update script is not responsible for data loss due to failure to save a backup first. We apologize for any inconvenience.');
      console.log('Please ensure that the .env, ./data/, and ./data/user files and data have not been overwritten!\n');

    } catch (err) {
      console.error('更新失敗：', err.message);
    }

    rl.close();
  });
}

main();