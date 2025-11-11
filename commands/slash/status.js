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

let redisClient = null;
let redisConnectionStatus = 'disabled';

async function initRedisConnection() {
  if (!REDIS_HOST || !REDIS_PORT || !REDIS_PASS) {
    redisConnectionStatus = 'disabled';
    return false;
  }

  let createClient;
  try {
    createClient = require('redis').createClient;
  } catch {
    console.warn('Redis 模組未安裝');
    redisConnectionStatus = 'disabled';
    return false;
  }

  try {
    redisClient = createClient({
      username: 'default',
      password: REDIS_PASS,
      socket: { host: REDIS_HOST, port: Number(REDIS_PORT), connectTimeout: 5000 }
    });

    redisClient.on('error', () => { redisConnectionStatus = 'error'; });
    redisClient.on('ready', () => { redisConnectionStatus = 'connected'; });
    redisClient.on('end', () => { redisConnectionStatus = 'error'; });

    await redisClient.connect();
    await redisClient.ping();
    console.log('Redis 連接成功');
    return true;
  } catch (error) {
    console.error('Redis 初始化失敗:', error.message);
    redisConnectionStatus = 'error';
    return false;
  }
}

async function checkRedisConnection() {
  if (!redisClient) return 'disabled';
  try {
    if (!redisClient.isReady) return 'error';
    await redisClient.ping();
    return 'connected';
  } catch {
    return 'error';
  }
}

let mariadbPool = null;
let poolStats = {
  max: DB_POOL_MAX ? Number(DB_POOL_MAX) : 20,
  active: 0, idle: 0, total: 0, available: DB_POOL_MAX ? Number(DB_POOL_MAX) : 20
};
let poolUpdaterHandle = null;

async function initMariadbPoolIfConfigured() {
  if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) return false;
  if (mariadbPool) return true;

  let mariadb;
  try { mariadb = require('mariadb'); } catch { console.warn('mariadb 未安裝'); return false; }

  try {
    mariadbPool = mariadb.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      port: Number(DB_PORT),
      connectionLimit: Number(DB_POOL_MAX) || 20
    });

    poolStats.max = mariadbPool.config.connectionLimit;
    poolStats.available = poolStats.max;

    poolUpdaterHandle = setInterval(async () => {
      if (!mariadbPool) return;
      try {
        const conn = await mariadbPool.getConnection();
        poolStats.total = mariadbPool.totalConnections();
        poolStats.idle = mariadbPool.idleConnections();
        poolStats.active = poolStats.total - poolStats.idle;
        poolStats.available = Math.max(0, poolStats.max - poolStats.total);
        conn.release();
      } catch {
        poolStats.active = poolStats.idle = poolStats.total = 0;
        poolStats.available = poolStats.max;
      }
    }, 5000);

    console.log('MariaDB pool 已建立');
    return true;
  } catch (err) {
    console.error('MariaDB pool 失敗:', err.message);
    mariadbPool = null;
    if (poolUpdaterHandle) clearInterval(poolUpdaterHandle);
    return false;
  }
}

async function checkDatabaseConnection() {
  if (!DB_HOST) return false;
  await initMariadbPoolIfConfigured();
  if (!mariadbPool) return false;
  try {
    const conn = await mariadbPool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    return true;
  } catch {
    return false;
  }
}

function getConnectionPoolStatus() {
  return mariadbPool ? {
    max: poolStats.max,
    active: poolStats.active,
    idle: poolStats.idle,
    total: poolStats.total,
    available: poolStats.available
  } : { max: poolStats.max, active: 0, idle: 0, total: 0, available: poolStats.max };
}

async function getServerResources() {
  if (!PTERO_API_KEY || !SERVER_ID) {
    console.warn('Pterodactyl 環境變數未配置: PTERO_API_KEY 或 SERVER_ID 缺失');
    return { status: 'unconfigured', message: 'Pterodactyl API 未配置' };
  }

  try {
    const [usageRes, detailsRes] = await Promise.all([
      axios.get(`${PTERO_URL}${SERVER_ID}/resources`, {
        headers: { Authorization: `Bearer ${PTERO_API_KEY}` },
        timeout: 4000
      }),
      axios.get(`${PTERO_URL}${SERVER_ID}`, {
        headers: { Authorization: `Bearer ${PTERO_API_KEY}` },
        timeout: 4000
      })
    ]);

    const usage = usageRes.data?.attributes ?? {};
    const details = detailsRes.data?.attributes ?? {};

    const cpu = usage.current_state?.cpu_absolute ?? usage.cpu_absolute ?? 0;
    const memBytes = usage.current_state?.memory_bytes ?? usage.memory_bytes ?? 0;
    const diskBytes = usage.current_state?.disk_bytes ?? usage.disk_bytes ?? 0;
    const cpuLimit = details.limits?.cpu ?? 100;
    const memLimit = (details.limits?.memory ?? 0) > 1024 * 1024
      ? (details.limits.memory / 1024 / 1024).toFixed(1)
      : (details.limits.memory || 0).toFixed(1);
    const diskLimit = (details.limits?.disk ?? 0) > 1024 * 1024
      ? (details.limits.disk / 1024 / 1024).toFixed(1)
      : (details.limits.disk || 0).toFixed(1);

    return {
      status: 'success',
      cpu: Number(cpu.toFixed(2)),
      cpuLimit: Number(cpuLimit),
      memoryUsed: Number((memBytes / 1024 / 1024).toFixed(1)),
      memoryLimit: Number(memLimit),
      diskUsed: Number((diskBytes / 1024 / 1024).toFixed(1)),
      diskLimit: Number(diskLimit)
    };
  } catch (err) {
    console.error('Pterodactyl API 請求失敗:', err.message);
    return { status: 'error', message: `無法連線到 Pterodactyl: ${err.message}` };
  }
}

let botOnlineTime = null;
const activeCollectors = new Map();

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
            `Node.js 版本: ${nodejsversion}\n` +
            `Discord.js 版本: ${djsVersion}\n` +
            `延遲：${ping}ms\n` +
            `上線時長：${uptimeStr}\n` +
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
            '```',
          inline: false
        }
      )
      .setFooter({ 
        text: 'Exho', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();

    // === Components V2 寫法 ===
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

    // === 儲存訊息 ID ===
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

  initRedis: initRedisConnection,
  incrementCommandUsage,

  // 恢復按鈕（重啟用）
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

// === Components V2 版本的 createEmbed ===
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