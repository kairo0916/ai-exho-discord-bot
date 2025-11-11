const fs = require('fs-extra');
const path = require('path');

const DEV_USERS = process.env.DEV_USER?.split(',') || [];

module.exports = {
  name: 'cmdload',
  description: '動態載入指令（僅限開發者）',

  async execute(message, args) {
    const userId = message.author.id;

    // === 檢查是否為開發者 ===
    if (!DEV_USERS.includes(userId)) {
      return message.reply('權限不足');
    }

    const client = message.client;

    // === 指令：cmdload all ===
    if (args[0] === 'all') {
      const slashDir = path.join(__dirname, '../slash');
      const textDir = path.join(__dirname, '../text');

      let loadedCount = 0;
      let failedCount = 0;
      const results = [];

      try {
        const slashFiles = fs.existsSync(slashDir)
          ? fs.readdirSync(slashDir).filter(f => f.endsWith('.js'))
          : [];

        const textFiles = fs.existsSync(textDir)
          ? fs.readdirSync(textDir).filter(f => f.endsWith('.js'))
          : [];

        // 合併所有檔案（去掉 .js）
        const allFiles = [...new Set([
          ...slashFiles.map(f => f.replace('.js', '')),
          ...textFiles.map(f => f.replace('.js', ''))
        ])];

        for (const fileName of allFiles) {
          let slashLoaded = false;
          let textLoaded = false;
          let errorMsg = '';

          // 載入 slash 版本
          const slashPath = path.join(slashDir, `${fileName}.js`);
          if (fs.existsSync(slashPath)) {
            try {
              delete require.cache[require.resolve(slashPath)];
              const command = require(slashPath);

              if (!command.data || !command.execute) {
                errorMsg += ' [Slash: 缺少 data 或 execute]';
              } else {
                client.slashCommands.set(command.data.name, command);
                await client.application.commands.create(command.data).catch(() => {});
                slashLoaded = true;
              }
            } catch (err) {
              errorMsg += ` [Slash: ${err.message}]`;
            }
          }

          // 載入 text 版本
          const textPath = path.join(textDir, `${fileName}.js`);
          if (fs.existsSync(textPath)) {
            try {
              delete require.cache[require.resolve(textPath)];
              const command = require(textPath);

              if (!command.name || typeof command.execute !== 'function') {
                errorMsg += ' [Text: 缺少 name 或 execute]';
              } else {
                client.textCommands.set(command.name, command);
                textLoaded = true;
              }
            } catch (err) {
              errorMsg += ` [Text: ${err.message}]`;
            }
          }

          // 統計結果
          if (slashLoaded || textLoaded) {
            loadedCount++;
            results.push(`\`${fileName}\` → Slash: ${slashLoaded ? 'Yes' : 'No'} | Text: ${textLoaded ? 'Yes' : 'No'}${errorMsg}`);
          } else {
            failedCount++;
            results.push(`\`${fileName}\` → 載入失敗${errorMsg}`);
          }
        }

        const summary = `載入完成！成功：${loadedCount} 個，失敗：${failedCount} 個`;
        const details = results.join('\n').slice(0, 1900);

        await message.reply(`${summary}\n\`\`\`\n${details}\n\`\`\``);
        console.log(`[cmdload all] ${summary}`);
      } catch (err) {
        await message.reply(`載入 all 時發生錯誤：${err.message}`);
        console.error('[cmdload all] 錯誤:', err);
      }
      return;
    }

    // === 原有單一載入功能 ===
    if (args.length === 0) {
      return message.reply('請輸入要載入的檔案名稱或使用 `all`');
    }

    const fileName = args[0].trim();
    const slashPath = path.join(__dirname, '../slash', `${fileName}.js`);
    const textPath = path.join(__dirname, '../text', `${fileName}.js`);

    let loaded = false;
    let filePath = null;
    let isSlash = false;

    // 檢查 slash 資料夾
    if (await fs.pathExists(slashPath)) {
      filePath = slashPath;
      isSlash = true;
      loaded = true;
    }
    // 檢查 text 資料夾
    if (await fs.pathExists(textPath)) {
      filePath = textPath;
      isSlash = false;
      loaded = true;
    }

    // === 支援同名檔案同時載入 ===
    if (await fs.pathExists(slashPath) && await fs.pathExists(textPath)) {
      // 兩個都存在 → 同時載入
      const results = [];

      // 載入 Slash
      try {
        delete require.cache[require.resolve(slashPath)];
        const slashCmd = require(slashPath);
        if (!slashCmd.data || !slashCmd.execute) {
          results.push(`\`${fileName}\` Slash 格式錯誤`);
        } else {
          client.slashCommands.set(slashCmd.data.name, slashCmd);
          await client.application.commands.create(slashCmd.data).catch(() => {});
          results.push(`\`${fileName}\` Slash 已載入`);
        }
      } catch (err) {
        results.push(`\`${fileName}\` Slash 載入失敗: ${err.message}`);
      }

      // 載入 Text
      try {
        delete require.cache[require.resolve(textPath)];
        const textCmd = require(textPath);
        if (!textCmd.name || typeof textCmd.execute !== 'function') {
          results.push(`\`${fileName}\` Text 格式錯誤`);
        } else {
          client.textCommands.set(textCmd.name, textCmd);
          results.push(`\`${fileName}\` Text 已載入`);
        }
      } catch (err) {
        results.push(`\`${fileName}\` Text 載入失敗: ${err.message}`);
      }

      await message.reply(results.join('\n'));
      console.log(`[cmdload] 已處理同名指令: ${fileName}`);
      return;
    }

    // === 單一檔案載入 ===
    if (!loaded) {
      return message.reply(`找不到 \`${fileName}.js\` 檔案\n請檢查以下路徑：\n\`slash/\` 或 \`text/\``);
    }

    try {
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);

      if (isSlash) {
        if (!command.data || !command.execute) {
          throw new Error('Slash 指令需包含 data 和 execute');
        }
        client.slashCommands.set(command.data.name, command);
        await client.application.commands.create(command.data).catch(() => {});
      } else {
        if (!command.name || typeof command.execute !== 'function') {
          throw new Error('Text 指令需包含 name 和 execute');
        }
        client.textCommands.set(command.name, command);
      }

      await message.reply(`已載入 \`${fileName}\` 指令`);
      console.log(`已載入 ${fileName} 指令 (${isSlash ? 'Slash' : 'Text'})`);
    } catch (error) {
      console.error(`載入 ${fileName} 失敗:`, error);
      await message.reply(`載入失敗：${error.message}`);
    }
  }
};