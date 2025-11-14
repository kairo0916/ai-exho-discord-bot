const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const os = require('os');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const {
  BOT_VERSION,
  PTERO_API_KEY,
  PTERO_URL,
  SERVER_ID,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASS,
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_PORT,
  DB_POOL_MAX
} = process.env;

const nodejsversion = process.version.substring(1);
const { version: djsVersion } = require('discord.js');

const COMMAND_USAGE_FILE = path.join(__dirname, '../../data/used_command.txt');
fs.ensureFileSync(COMMAND_USAGE_FILE);
let commandUsageCount = parseInt(fs.readFileSync(COMMAND_USAGE_FILE, 'utf8').trim()) || 0;

function incrementCommandUsage() {
  commandUsageCount++;
  fs.writeFileSync(COMMAND_USAGE_FILE, commandUsageCount.toString());
}

let poolStats = {
  max: DB_POOL_MAX ? Number(DB_POOL_MAX) : 20,
  active: 0,
  idle: 0,
  total: 0,
  available: DB_POOL_MAX ? Number(DB_POOL_MAX) : 20
};

function getConnectionPoolStatus() {
  return { max: poolStats.max, active: 0, idle: 0, total: 0, available: poolStats.max };
}

let botOnlineTime = null;
const activeCollectors = new Map();

function getJsonCount(filePath, type) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const raw = fs.readFileSync(filePath, 'utf8');

    if (type === 'array') {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    }

    if (type === 'object') {
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? Object.keys(obj).length : 0;
    }

    return 0;
  } catch {
    return 0;
  }
}

function getUserMemoryCount(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;

    const files = fs.readdirSync(dirPath);
    return files.filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function getDatabaseStats() {
  const banlistPath = path.join(__dirname, '../../data/banlist.json');
  const marriagePath = path.join(__dirname, '../../data/marriage.json');
  const userDir = path.join(__dirname, '../../data/user');

  const banlistCount = getJsonCount(banlistPath, 'array');
  const marriageCount = getJsonCount(marriagePath, 'object');
  const userMemoryCount = getUserMemoryCount(userDir);

  return {
    banlist: banlistCount,
    marriage: marriageCount,
    userMemory: userMemoryCount
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('當前狀態')
    .setDescription('機器人當前狀態')
    .setDMPermission(true),

  async execute(interaction) {
    await interaction.deferReply();

    const client = interaction.client;
    if (!botOnlineTime) botOnlineTime = new Date();

    const ping = client.ws.ping;
    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptimeSec / 86400)}天 ${Math.floor(uptimeSec % 86400 / 3600)}小時 ${Math.floor(uptimeSec % 3600 / 60)}分 ${uptimeSec % 60}秒`;

    const guilds = client.guilds.cache.size;
    const textChannels = client.channels.cache.filter(c => c.isTextBased() && !c.isThread()).size;
    const voiceChannels = client.channels.cache.filter(c => c.isVoiceBased()).size;
    const loadedCommands = client.slashCommands.size + client.textCommands.size;

    const modulesDir = path.join(__dirname, '../../modules');
    let modules = [];
    if (fs.existsSync(modulesDir)) {
      modules = fs.readdirSync(modulesDir)
        .filter(f => f.endsWith('.js'))
        .map(f => f.replace('.js', ''))
        .map(m => `• ${m}`);
    }

    const dbStats = await getDatabaseStats();
    const poolInfo = getConnectionPoolStatus();

    const embed = new EmbedBuilder()
      .setTitle('機器人當前狀態')
      .setColor('#53e64c')
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: 'ℹ️ 基本資訊',
          value: '```\n' +
            `伺服器數量：${guilds}\n` +
            `文字頻道：${textChannels}\n` +
            `語音頻道：${voiceChannels}\n` +
            `已載入指令：${loadedCommands}\n` +
            `指令使用：${commandUsageCount} 次\n` +
            '```',
          inline: false
        },
        {
          name: '🖥️ 系統資訊',
          value: '```\n' +
            `Node.js 版本：${nodejsversion}\n` +
            `Discord.js 版本：${djsVersion}\n` +
            `延遲：${ping}ms\n` +
            `上線時長：${uptimeStr}\n` +
            '```',
          inline: false
        },

        {
          name: '🗄️ 資料庫數據',
          value:
            '```\n' +
            `• 黑名單用戶: ${dbStats.banlist} 筆\n` +
            `• 使用者記憶: ${dbStats.userMemory} 筆\n` +
            `• 婚姻數據: ${dbStats.marriage} 筆\n` +
            '```',
          inline: false
        },

        {
          name: '🔧 工具模組',
          value: modules.length > 0
            ? '```\n' + modules.join('\n') + '\n```'
            : '```\n無模組載入\n```',
          inline: false
        },
        {
          name: '📝 其他資訊',
          value: '```\n' +
            `開發者：Kairo\n` +
            `版本：${BOT_VERSION || '未知'}\n` +
            `專案名稱: ai-exho-discord-bot\n` +
            '```',
          inline: false
        }
      )
      .setFooter({
        text: 'Exho',
        iconURL: client.user.displayAvatarURL({ size: 64 })
      })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_status')
        .setLabel('刷新狀態')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('邀請機器人')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
      new ButtonBuilder()
        .setLabel('加入支援群')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/umKvqHj4DC')
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
      fetchReply: true
    }).catch(() => {});

    if (!message) return;

    const statusLog = {
      channelId: interaction.channel.id,
      messageId: message.id,
      timestamp: Date.now()
    };
    fs.writeFileSync(
      path.join(__dirname, '../../data/last_status_message.json'),
      JSON.stringify(statusLog, null, 2)
    );

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'refresh_status' && i.message.id === message.id,
      time: null
    });

    const key = `${interaction.channel.id}-${message.id}`;
    activeCollectors.set(key, collector);

    collector.on('collect', async i => {
      await i.deferUpdate();
      const newEmbed = await createEmbed(i.client);
      await i.editReply({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', () => {
      activeCollectors.delete(key);
    });
  },

  incrementCommandUsage,

  restoreCollector: (client, channelId, messageId) => {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const key = `${channelId}-${messageId}`;
    if (activeCollectors.has(key)) return;

    const collector = channel.createMessageComponentCollector({
      filter: i => i.customId === 'refresh_status' && i.message.id === messageId,
      time: null
    });

    activeCollectors.set(key, collector);

    collector.on('collect', async i => {
      await i.deferUpdate();
      const newEmbed = await createEmbed(i.client);
      await i.editReply({ embeds: [newEmbed] }).catch(() => {});
    });

    collector.on('end', () => {
      activeCollectors.delete(key);
    });
  }
};

async function createEmbed(client) {
  const ping = client.ws.ping;
  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec / 86400)}天 ${Math.floor(uptimeSec % 86400 / 3600)}小時 ${Math.floor(uptimeSec % 3600 / 60)}分 ${uptimeSec % 60}秒`;

  const guilds = client.guilds.cache.size;
  const textChannels = client.channels.cache.filter(c => c.isTextBased() && !c.isThread()).size;
  const voiceChannels = client.channels.cache.filter(c => c.isVoiceBased()).size;
  const loadedCommands = client.slashCommands.size + client.textCommands.size;

  const modulesDir = path.join(__dirname, '../../modules');
  let modules = [];
  if (fs.existsSync(modulesDir)) {
    modules = fs.readdirSync(modulesDir)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''))
      .map(m => `• ${m}`);
  }

  const dbStats = await getDatabaseStats();
  const poolInfo = getConnectionPoolStatus();

  return new EmbedBuilder()
    .setTitle('機器人當前狀態')
    .setColor('#53e64c')
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: 'ℹ️ 基本資訊',
        value: '```\n' +
          `伺服器數量：${guilds}\n` +
          `文字頻道：${textChannels}\n` +
          `語音頻道：${voiceChannels}\n` +
          `已載入指令：${loadedCommands}\n` +
          `指令使用：${commandUsageCount} 次\n` +
          '```',
        inline: false
      },
      {
        name: '🖥️ 系統資訊',
        value: '```\n' +
          `NodeJS 版本: ${nodejsversion}\n` +
          `discord.js 版本: ${djsVersion}\n` +
          `延遲：${ping}ms\n` +
          `上線時長：${uptimeStr}\n` +
          '```',
        inline: false
      },

      {
        name: '🗄️ 資料庫數據',
        value:
          '```\n' +
          `• 黑名單用戶: ${dbStats.banlist} 筆\n` +
          `• 使用者記憶: ${dbStats.userMemory} 筆\n` +
          `• 婚姻數據: ${dbStats.marriage} 筆\n` +
          '```',
        inline: false
      },

      {
        name: '🔧 工具模組',
        value: modules.length > 0
          ? '```\n' + modules.join('\n') + '\n```'
          : '```\n無模組載入\n```',
        inline: false
      },
      {
        name: '📝 其他資訊',
        value: '```\n' +
          `開發者：Kairo\n` +
          `版本：${BOT_VERSION || '未知'}\n` +
          `專案名稱: ai-exho-discord-bot\n` +
          '```',
        inline: false
      }
    )
    .setFooter({
      text: 'Exho',
      iconURL: client.user.displayAvatarURL({ size: 64 })
    })
    .setTimestamp();
}
