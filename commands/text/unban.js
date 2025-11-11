// ./commands/text/unban.js
const fs = require('fs-extra');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const BANLIST_FILE = path.join(__dirname, '../../data/banlist.json');

// 從 .env 讀取開發者 ID
const CONFIG = {
  developer_ids: process.env.DEV_USER?.split(',').map(id => id.trim()) || []
};

let banlist = [];

// 讀取 banlist
function loadBanlist() {
  if (fs.existsSync(BANLIST_FILE)) {
    try {
      banlist = fs.readJsonSync(BANLIST_FILE);
      if (!Array.isArray(banlist)) banlist = [];
    } catch (err) {
      console.error('讀取 banlist.json 失敗，使用空列表:', err.message);
      banlist = [];
    }
  } else {
    fs.ensureFileSync(BANLIST_FILE);
    banlist = [];
    fs.writeJsonSync(BANLIST_FILE, banlist);
  }
}

// 儲存 banlist
function saveBanlist() {
  try {
    fs.writeJsonSync(BANLIST_FILE, banlist, { spaces: 2 });
  } catch (err) {
    console.error('寫入 banlist.json 失敗:', err.message);
  }
}

// 解除封鎖
function unbanUser(userId) {
  const index = banlist.indexOf(userId);
  if (index !== -1) {
    banlist.splice(index, 1);
    saveBanlist();
    return true;
  }
  return false;
}

// 載入 banlist
loadBanlist();

module.exports = {
  name: 'unban',
  description: '解除封鎖使用者',

  async execute(message, args, client) {
    // === 權限檢查：管理角色 OR 開發者 ID ===
    const adminRoles = process.env.ADMIN_ROLE_IDS?.split(',').map(s => s.trim()) || [];
    const hasAdminRole = message.member?.roles.cache.some(r => adminRoles.includes(r.id));
    const isDeveloper = CONFIG.developer_ids.includes(message.author.id);

    if (!hasAdminRole && !isDeveloper) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('錯誤')
          .setDescription('你沒有權限使用此指令')
          .setColor(0xFF0000)
        ]
      });
    }

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId || !/^\d+$/.test(userId)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('錯誤')
          .setDescription('請提供有效的使用者 ID')
          .setColor(0xFF0000)
        ]
      });
    }

    const success = unbanUser(userId);
    if (success) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('解除封鎖成功')
          .setDescription(`已解除封鎖使用者 \`${userId}\``)
          .setColor(0x00FF00)
        ]
      });
    } else {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('錯誤')
          .setDescription('該使用者未被封鎖')
          .setColor(0xFF0000)
        ]
      });
    }
  }
};