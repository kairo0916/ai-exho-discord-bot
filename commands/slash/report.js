const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

const REPORT_USER_ID = process.env.DEV_USER?.split(',').map(id => id.trim()) || []
const COOLDOWN_SECONDS = 30 * 60;
const DATA_FILE = path.join(__dirname, '../../data/report_time.json');
const UPDATE_INTERVAL = 100; let cooldownData = {};

function loadCooldownData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readJsonSync(DATA_FILE);
      cooldownData = Object.fromEntries(
        Object.entries(raw).map(([userId, timestamp]) => [
          userId,
          Number(timestamp) || 0
        ])
      );
    } catch (err) {
      console.error('讀取 report_time.json 失敗:', err.message);
      cooldownData = {};
    }
  } else {
    cooldownData = {};
    saveCooldownData();
  }
}

function saveCooldownData() {
  try {
    fs.writeJsonSync(DATA_FILE, cooldownData, { spaces: 2 });
  } catch (err) {
    console.error('寫入 report_time.json 失敗:', err.message);
  }
}

function getTaiwanTime() {
  return Date.now() + 8 * 60 * 60 * 1000;
}

function formatTaiwanTime(ms) {
  const date = new Date(ms - 8 * 60 * 60 * 1000);
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/\//g, '/');
}

function startCooldownUpdater() {
  setInterval(() => {
    const now = getTaiwanTime();
    let changed = false;
    for (const userId in cooldownData) {
      if (cooldownData[userId] > now) {
        continue;
      } else {
        delete cooldownData[userId];
        changed = true;
      }
    }
    if (changed) saveCooldownData();
  }, UPDATE_INTERVAL);
}

loadCooldownData();
startCooldownUpdater();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('回報問題')
    .setDescription('回報機器人問題或建議（每 30 分鐘一次）')
    .addStringOption(option =>
      option
        .setName('內容')
        .setDescription('請詳細描述問題或建議')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const now = getTaiwanTime();

    if (cooldownData[userId] && cooldownData[userId] > now) {
      const remaining = Math.ceil((cooldownData[userId] - now) / 1000);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return interaction.reply({
        content: `冷卻中！請等待 \`${minutes} 分 ${seconds} 秒\` 後再回報。`,
        ephemeral: true
      });
    }

    const content = interaction.options.getString('內容');
    const guildName = interaction.guild?.name || '私訊';

    cooldownData[userId] = now + COOLDOWN_SECONDS * 1000;
    saveCooldownData();

    const embed = new EmbedBuilder()
      .setTitle('有人回報了問題')
      .setColor(0xFFA500)
      .addFields(
        { name: '使用者', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
        { name: '伺服器', value: guildName, inline: true },
        { name: '回報內容', value: content },
        { name: '回報時間', value: formatTaiwanTime(now) }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: '問題回報系統' });

    try {
      const reportUser = await interaction.client.users.fetch(REPORT_USER_ID);
      await reportUser.send({ embeds: [embed] });
    } catch (err) {
      console.error('無法發送回報 DM:', err.message);
      delete cooldownData[userId];
      saveCooldownData();
      return interaction.reply({
        content: '❌ 回報失敗：無法聯繫開發者（DM 已關閉或 ID 錯誤）。',
        ephemeral: true
      });
    }

    await interaction.reply({
      content: '✅ 你的問題已成功回報給開發者！感謝你的反饋！',
      ephemeral: true
    });
  }
};