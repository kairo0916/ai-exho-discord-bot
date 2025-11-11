// ./commands/text/ban.js
const fs = require('fs-extra');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const BANLIST_FILE = path.join(__dirname, '../../data/banlist.json');
const CONFIG = {
  ban_channel: process.env.BAN_CHANNEL_ID || null,
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

// 檢查是否被封鎖
function isBanned(userId) {
  return banlist.includes(userId);
}

// 封鎖使用者
function banUser(userId, reason = '未提供原因') {
  if (!banlist.includes(userId)) {
    banlist.push(userId);
    saveBanlist();
  }
  return { userId, reason };
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

// 建立封鎖通知 Embed
function createBanEmbed(user, reason) {
  return new EmbedBuilder()
    .setTitle('封鎖通知')
    .setColor(0xFF0000)
    .addFields(
      { name: '使用者', value: `<@${user.id}>`, inline: true },
      { name: '使用者ID', value: `\`${user.id}\``, inline: true },
      { name: '原因', value: reason || '未提供原因' }
    )
    .setTimestamp();
}

// 發送封鎖通知（到頻道 + 所有開發者 DM）
async function sendBanLog(client, user, reason) {
  const embed = createBanEmbed(user, reason);

  // === 1. 發送到 BAN_CHANNEL_ID ===
  if (CONFIG.ban_channel) {
    const channel = client.channels.cache.get(CONFIG.ban_channel);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(err => {
        console.error('發送到封鎖頻道失敗:', err.message);
      });
    }
  }

  // === 2. 私訊所有 DEV_USER ===
  for (const devId of CONFIG.developer_ids) {
    const dev = await client.users.fetch(devId).catch(() => null);
    if (dev) {
      await dev.send({ embeds: [embed] }).catch(err => {
        console.error(`私訊開發者 ${devId} 失敗:`, err.message);
      });
    }
  }
}

// 被封鎖時的回應
function getBannedEmbed() {
  return new EmbedBuilder()
    .setTitle('禁止使用')
    .setDescription('你已遭到封鎖，無法使用機器人相關功能。')
    .setColor(0xFF0000)
    .setFooter({ text: '如有問題請聯絡開發者' })
    .setTimestamp();
}

// 載入 banlist
loadBanlist();

module.exports = {
  name: 'ban',
  description: '封鎖使用者',

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

    const reason = args.slice(1).join(' ') || '未提供原因';
    const banned = banUser(userId, reason);

    const user = await client.users.fetch(userId).catch(() => null);
    if (user) {
      await sendBanLog(client, user, banned.reason);
    }

    return message.reply({
      embeds: [new EmbedBuilder()
        .setTitle('封鎖成功')
        .setDescription(`已封鎖使用者 \`${userId}\`\n原因：${banned.reason}`)
        .setColor(0x00FF00)
      ]
    });
  },

  isBanned,
  getBannedEmbed
};