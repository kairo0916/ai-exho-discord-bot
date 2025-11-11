const fs = require('fs-extra');
const path = require('path');

module.exports = {
  name: 'server_count',
  description: '顯示機器人目前所在的伺服器數量與名稱',

  async execute(message) {
    const guilds = message.client.guilds.cache;
    const guildCount = guilds.size;

    if (guildCount === 0) {
      return message.reply('目前沒有在任何伺服器中運行。');
    }

    // 收集所有伺服器名稱（按字母排序）
    const guildNames = guilds
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(g => `• ${g.name} (${g.id})`)
      .join('\n');

    const response = `目前在 \`${guildCount}\` 個伺服器中運行中！\n\n${guildNames}`;

    // Discord 訊息長度限制 2000 字元
    if (response.length > 2000) {
      const limitedNames = guilds
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(g => `• ${g.name}`)
        .slice(0, 30)
        .join('\n');

      return message.reply(
        `目前在 \`${guildCount}\` 個伺服器中運行中！\n` +
        `（伺服器太多，僅顯示前 30 個）\n\n${limitedNames}\n...等 ${guildCount - 30} 個伺服器`
      );
    }

    await message.reply(response);
  }
};