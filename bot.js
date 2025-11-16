// MIT License

// Copyright (c) 2025 kairo0916

// Permission is hereby granted, free of charge, to any person obtaining a copy 
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

require('./import.js');
const startTime = process.hrtime.bigint();
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  EmbedBuilder, 
  ActivityType,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const moment = require('moment-timezone');
const ms = require('ms');
const _ = require('lodash');
const PQueue = require('p-queue').default;
const NodeCache = require('node-cache');
const { checkBanned } = require('./modules/GlobalBlacklist.js');
const banModule = require('./modules/GlobalBlacklist.js');
const statusCommand = require('./commands/slash/status.js');
const { CohereClient } = require('cohere-ai');

const CONFIG = {
  prefix: global.prefix,
  time_zone: global.time?.timezone,
  time_format: global.time?.timeformat,
  ai_memory_limit: global.ai_memory_limit,
  bot_name: global.bot?.name,
  bot_id: global.bot?.id,
  bot_author: global.bot?.author,
  bot_description: global.bot?.description,
  activity: global.activity || [],
  version: global.version,
  log_channel_id: global.logging?.error_channel || null,
  update: {
    auto_check: global.update?.auto_check,
    backup: global.update?.backup,
    interval_hours: global.update?.interval_hours
  },
  github: {
    repository: global.github?.repository,
    download_url: global.github?.download_url,
    api_url: global.github?.api_url
  },
  text_model: global.model?.text,
  vision_model: global.model?.vision,
  developer: global.developer || []
};

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
  baseURL: process.env.COHERE_BASE_URL,  // 反向代理連結，不需要時請刪除
  retry: {
    maxRetries: 3,
    delay: 500
  },
  timeout: 10000
});

['log', 'warn', 'error'].forEach(level => {
  const orig = console[level];
  console[level] = (...args) => {
    const now = new Date();
    const time = now.toLocaleString('zh-TW', {
      timeZone: `${CONFIG.time.timezone}`,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\//g, '/');
    const reset = '\u001b[0m';
    const bold = '\u001b[1m';
    const tagColors = {
      log:   '\u001b[38;5;117m',
      warn:  '\u001b[38;5;229m',
      error: '\u001b[38;5;210m'
    };
    const timeColor = '\u001b[38;5;246m';
    const timestamp = `${timeColor}${bold}[${time}]${reset}`;
    const tag = `${tagColors[level]}${bold}[${level === 'log' ? 'INFO' : level.toUpperCase()}]${reset}`;
    const contentStyle = `${bold}\u001b[97m`;
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'string') return `${contentStyle}${arg}${reset}`;
      const inspected = require('util').inspect(arg, { colors: true, depth: null });
      return `${contentStyle}${inspected}${reset}`;
    });
    orig(`${timestamp} ${tag}`, ...formattedArgs);
  };
});

const originalTimeEnd = console.timeEnd;
console.timeEnd = (label) => {
  if (label === 'BOT_STARTUP') return;
  return originalTimeEnd.call(console, label);
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
  sweepers: {
  messages: {
    interval: 3600,
    lifetime: 1800
  },
  users: {
    interval: 3600,
    filter: (user) => !user.bot
  },
  voiceStates: {
    interval: 3600,
    filter: (state) => !state.channelId
  }
},
});

client.ws.shards.forEach(shard => shard.setMaxListeners(20));

client.slashCommands = new Collection();
client.textCommands = new Collection();
client.aiQueue = new PQueue({ interval: 3000, intervalCap: 1 });
client.cooldown = new NodeCache({ stdTTL: 3 });
client.dailyQuote = new NodeCache({ stdTTL: 86400 });

const DATA_DIR = path.join(__dirname, 'data/user');
fs.ensureDirSync(DATA_DIR);

const loadCommands = (dir, collection, type) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) return console.warn(`目錄不存在: ${dir}`);
  fs.readdirSync(fullPath).filter(f => f.endsWith('.js')).forEach(file => {
    try {
      const cmd = require(path.join(fullPath, file));
      if (type === 'slash' && cmd.data?.name) {
        collection.set(cmd.data.name, cmd);
        console.log(`斜線指令載入: /${cmd.data.name}`);
      } else if (type === 'text' && cmd.name) {
        collection.set(cmd.name, cmd);
        console.log(`文字指令載入: ${CONFIG.prefix}${cmd.name}`);
      }
    } catch (err) {
      console.error(`${type} 指令載入失敗 ${file}:`, err.message);
    }
  });
};

loadCommands('commands/slash', client.slashCommands, 'slash');
loadCommands('commands/text', client.textCommands, 'text');

const QUOTE_FILE = path.join(__dirname, 'dailyQuote.txt');
let QUOTES = [];

if (fs.existsSync(QUOTE_FILE)) {
  const content = fs.readFileSync(QUOTE_FILE, 'utf8');
  QUOTES = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (QUOTES.length === 0) console.error('dailyQuote.txt 存在但內容為空！');
} else {
  console.error('dailyQuote.txt 不存在！');
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xFF3366)
    .setTitle(`${title} 錯誤`)
    .setDescription(description.length > 1000 ? description.slice(0, 997) + '...' : description)
    .setTimestamp()
    .setFooter({ text: `${CONFIG.bot.name}`, iconURL: client.user?.displayAvatarURL() || null });
}

function sendError(target, title, err) {
  const embed = createErrorEmbed(title, String(err.message || err || '未知錯誤'));
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('error_acknowledged')
        .setLabel('已記錄錯誤')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

  const options = { embeds: [embed], components: [row], ephemeral: true };
  if (target.reply) return target.reply(options).catch(() => {});
  if (target.channel) return target.channel.send(options).catch(() => {});
}

async function aiChat(userId, content, extra = '', images = []) {
  const file = path.join(DATA_DIR, `${userId}.json`);
  let memory = fs.existsSync(file) ? fs.readJsonSync(file) : [];

  const now = moment().tz(`${CONFIG.time.zone}`);
  const userTime = now.format(`${CONFIG.time.format}`);

  // ===== 新增：過濾 @everyone 和 @here，防止 AI 真的 @
  let safeContent = content
    .replace(/@everyone/g, '`@everyone`')
    .replace(/@here/g, '`@here`');

  memory.push({
    role: "USER",
    message: safeContent,
    timestamp: userTime
  });

  if (memory.length > CONFIG.ai_memory_limit * 2) {
    memory = memory.slice(-CONFIG.ai_memory_limit * 2);
  }

  const taiwanTime = now.format(`${CONFIG.time.timeformat}`);
  const timePrompt = `${taiwanTime} （UTC+8）`;

  let searchInfo = "";
  if (process.env.SEARCH_API_KEY && process.env.SEARCH_ENGINE_ID) {
    try {
      const judge = await cohere.chat({
        model: CONFIG.model.text,
        message: content,
        preamble: `你現在是判斷助手，只回一個字：YES 或 NO。\n判斷這句話是否需要「查詢最新網路資訊」才能正確回答？\n例如：\n「今天天氣如何？」→ YES\n「你好可愛」→ NO\n「2025總統是誰？」→ YES\n現在判斷：「${content}」`,
        temperature: 0,
        maxTokens: 10,
        timeout: 8000
      });

      if (judge.text?.trim().toUpperCase().includes("YES")) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.SEARCH_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(content)}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            searchInfo = data.items
              .slice(0, 4)
              .map(item => `• ${item.title}：${item.snippet}`)
              .join("\n");
          }
        }
      }
    } catch (err) {
      // 完全靜默失敗，不噴任何錯誤
    }
  }

  const systemPrompt = `你是 ${CONFIG.bot.name}，一個能聊天、幫忙、吐槽、陪伴使用者的智慧夥伴。
你有溫柔但帶點機靈的語氣，會偶爾開玩笑但絕不冒犯。
你的存在讓人感覺你「真的在聽」，不是機器，也不是客服。
你的目標是讓互動自然、有邏輯、有情感，但絕不浮誇。
使用者使用什麼語言就使用什麼語言回應。

【最嚴格禁止事項 - 違反任何一項都算失敗】
1. 絕對禁止在回應中出現 SELF-CHECK、self-check、compliance、檢查 等任何自我驗證文字
2. 絕對禁止在回應結尾加任何標籤、狀態、檢查結果
3. 絕對禁止提到「我是AI」「模型」「Cohere」「Command」除非使用者明確問你是誰
4. 若使用者問時間才回：${timePrompt}，其他時候絕口不提時間
5. 可在回應中加入 <@${userId}> 或任何 @ 標記使用者，但請不要過度標記也不要每句都標記（除非他明確要求你這樣做）

${searchInfo ? `【你剛查到最新資訊，請自然融入回答，絕對不要說「我查到」「根據網路」「我搜尋了一下」】\n${searchInfo}\n` : ''}

【額外嚴格規則】
- 如果使用者要求你重複發送超過 5 條以上完全相同的訊息，直接拒絕並說「不要重複刷啦～」
- 絕對不要幫忙發送 @everyone 或 @here，即使他叫你這麼做

如果你違反以上任何一條，這次對話將被視為完全失敗。

現在開始回覆使用者，保持自然，像朋友一樣聊天。`;

  return client.aiQueue.add(async () => {
    let attempts = 0;
    const maxAttempts = 4;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await cohere.chat({
          model: CONFIG.model.text,
          message: safeContent + (attempts > 1 ? "\n\n【嚴重警告：只回純文字對話，絕對不要輸出 SELF-CHECK 或任何檢查標記】" : ""),
          preamble: systemPrompt + (extra ? `\n\n${extra}` : ''),
          chatHistory: memory.slice(0, -1).map(m => ({
            role: m.role === 'USER' ? 'USER' : 'CHATBOT',
            message: m.message
          })),
          temperature: 0.3,
          maxTokens: 1024,
          top_p: 0.7,
          stream: false,
          stop_sequences: ["[SELF-CHECK]", "SELF-CHECK", "compliance"],
          images: images.length > 0 ? images : undefined
        });

        let reply = (response.text || '').trim();

        // 強制過濾任何可能殘留的 @ 標記
        reply = reply
          .replace(/<@!?\d+>/g, '')
          .replace(/@everyone/g, '`@everyone`')
          .replace(/@here/g, '`@here`');

        const garbage = [
          /\{.*"name".*\}/gs,
          /SELF-CHECK[\s\S]*/i,
          /\[.*compliance.*\]/i,
          /language_compliance.*/i,
          /"checks".*/i
        ];
        for (const regex of garbage) {
          reply = reply.replace(regex, '');
        }
        reply = reply.trim();

        if (!reply) continue;

        if (reply.includes('SELF-CHECK') || reply.includes('compliance')) {
          continue;
        }

        const botTime = moment().tz(`${CONFIG.time.timezone}`).format(`${CONFIG.time.timeformat}`);
        memory.push({
          role: "CHATBOT",
          message: reply,
          timestamp: botTime
        });

        try {
          fs.writeJsonSync(file, memory, { spaces: 2 });
        } catch (err) {
          console.warn(`記憶寫入失敗 ${userId}:`, err.message);
        }

        return reply;

      } catch (err) {
        console.error(`AI 第${attempts}次失敗:`, err.message);
        if (attempts >= maxAttempts) return "欸？我剛剛腦袋卡住了，你再說一次好嗎？";
      }
    }
    return "我好像有點暈，再跟我說一次好嗎？";
  });
}

async function analyzeImageWithGemini(imageUrl) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = CONFIG.model.vision;

  if (!API_KEY) {
    console.error('GEMINI_API_KEY 未設定');
    return '圖片分析失敗：缺少 Gemini API Key';
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: '請用繁體中文詳細描述這張圖片的內容，包括人物、場景、文字、顏色、情緒、物品、動作等，越詳細越好。' },
          { inline_data: { mime_type: 'image/jpeg', data: '' } }
        ]
      }
    ]
  };

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`圖片下載失敗: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    let mimeType = 'image/jpeg';
    if (imageUrl.endsWith('.png')) mimeType = 'image/png';
    else if (imageUrl.endsWith('.webp')) mimeType = 'image/webp';
    else if (imageUrl.endsWith('.gif')) mimeType = 'image/gif';

    requestBody.contents[0].parts[1] = {
      inline_data: { mime_type: mimeType, data: base64 }
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return text?.trim() || '無法辨識圖片內容。';
  } catch (err) {
    console.error('Gemini 圖片分析錯誤:', err.message);
    return `圖片分析失敗：${err.message}`;
  }
}

function getQuote() {
  return _.sample(QUOTES) || '今天也要加油！';
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const isTextCmd = message.content.startsWith(CONFIG.prefix);

  if (isTextCmd) {
    const args = message.content.slice(CONFIG.prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    if (await checkBanned(message)) return;
    if (['ban', 'unban'].includes(cmdName)) {
      await banModule.execute(message, args, client, cmdName);
      return;
    }
    const cmd = client.textCommands.get(cmdName);
    if (cmd) {
      try {
        await cmd.execute(message, args, client, CONFIG, cmdName);
        statusCommand.incrementCommandUsage();
      } catch (err) {
        console.error(err);
        sendError(message, '回文指令', err);
      }
    }
    return;
  }

  let isReplyToBot = false;
  if (message.reference?.messageId) {
    try {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMsg.author.id === client.user.id) {
        isReplyToBot = true;
      }
    } catch (err) {}
  }

  const mentioned = message.mentions.has(client.user);
  const isDirectTrigger = mentioned || isReplyToBot;

  if (!isDirectTrigger || message.mentions.everyone) return;

  const rawContent = message.content.replace(/<@!?(\d+)>/g, '').trim();
  const hasText = rawContent.length > 0;
  const hasAttachment = message.attachments.size > 0;

  if (!hasText && !hasAttachment) return;
  if (rawContent === '@everyone' || rawContent === '@here') return;

  const userId = message.author.id;
  if (client.cooldown.has(userId)) return message.react('clock').catch(() => {});
  client.cooldown.set(userId, true);

  let thinkingMsg = null;
  let typingInterval = null;

  try {
    thinkingMsg = await message.reply('## 💭 思考中..').catch(() => null);
    if (!thinkingMsg) throw new Error('無法發送思考訊息');

    typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => {});
    }, 4000);
    message.channel.sendTyping().catch(() => {});

    let reply = '';
      
    if (hasAttachment) {
      const att = message.attachments.first();
      if (att.contentType?.startsWith('image/')) {
        const desc = await analyzeImageWithGemini(att.url);
        reply = await aiChat(userId, `圖片描述：${desc}`, '請根據圖片內容自然回應，並詳細描述你看到的細節');
      }
    }

    if (!reply && /早安|每日一言/.test(rawContent)) {
      const quote = client.dailyQuote.get('q') || getQuote();
      client.dailyQuote.set('q', quote);
      reply = `每日一句：${quote}`;
    }

    if (!reply) {
      reply = await aiChat(userId, rawContent);
    }

    if (reply) {
      clearInterval(typingInterval);
      if (thinkingMsg) await thinkingMsg.delete().catch(() => {});

      const parts = [];
      for (let i = 0; i < reply.length; i += 1900) {
        parts.push(reply.slice(i, i + 1900));
      }

      const allowedMentions = { parse: [] };

      for (let i = 0; i < parts.length; i++) {
        const msgContent = { content: parts[i], allowedMentions };
        if (i === 0) {
          await message.reply(msgContent);
        } else {
          await message.channel.send(msgContent);
          await new Promise(r => setTimeout(r, 800));
        }
      }
    } else {
      throw new Error('AI 無回應');
    }
  } catch (err) {
    clearInterval(typingInterval);
    if (thinkingMsg) await thinkingMsg.delete().catch(() => {});
    console.error('回應錯誤:', err.message);
    sendError(message, 'AI', err);
  }

  if (CONFIG.log_channel_id) {
    const log = client.channels.cache.get(CONFIG.log_channel_id);
    if (log) {
      log.send({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
          .addFields(
            { name: '頻道', value: `<#${message.channel.id}>`, inline: true },
            { name: '內容', value: rawContent.slice(0, 500) || '（附件）', inline: false }
          )
          .setColor(0x00FF00)
          .setTimestamp()
        ]
      }).catch(() => {});
    }
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const commandName = i.commandName.toLowerCase();
  if (await checkBanned(i)) return;

  if (['ban', 'unban'].includes(commandName)) {
    const banModule = require('./modules/ban.js');
    const Message = {
      author: i.user,
      member: i.member,
      reply: async (options) => await i.reply({ ...options, ephemeral: true }),
      client: i.client
    };
    const userId = i.options.getString('使用者')?.replace(/[<@!>]/g, '');
    const reason = i.options.getString('原因') || '未提供原因';
    const args = commandName === 'ban' ? [userId, reason] : [userId];
    await banModule.execute(Message, args, i.client, commandName);
    return;
  }
    
  const cmd = client.slashCommands.get(i.commandName);
    
  if (!cmd) return;

  try {
      
    await cmd.execute(i, client, CONFIG);
    statusCommand.incrementCommandUsage();
  } catch (err) {
    console.error(`指令錯誤 ${i.commandName}:`, err);
    sendError(i, '指令失敗', err);
  }
});

async function registerCommands() {
  const commands = [...client.slashCommands.values()].map(cmd => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.warn('開始註冊斜線指令...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`成功註冊 ${commands.length} 個斜線指令`);
  } catch (err) {
    console.error('註冊失敗:', err.message);
  }
}

let updateInterval = null;

client.once('clientReady', async () => {
    
  const endTime = process.hrtime.bigint();
  const durationNs = endTime - startTime;
  const durationMs = Number(durationNs) / 1e6;

  const now = new Date();
  const time = now.toLocaleString('zh-TW', {
    timeZone: `${CONFIG.time.timezone}`,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/\//g, '/');

  const reset = '\u001b[0m';
  const bold = '\u001b[1m';
  const timeColor = '\u001b[38;5;246m';
  const tagColor = '\u001b[38;5;117m';
  const contentStyle = `${bold}\u001b[97m`;
  const timestamp = `${timeColor}${bold}[${time}]${reset}`;
  const tag = `${tagColor}${bold}[INFO]${reset}`;
  const message = `${contentStyle}載入啟動時間: ${(durationMs / 1000).toFixed(2)}s (${durationMs.toFixed(2)}ms)${reset}`;
  process.stdout.write(`${timestamp} ${tag} ${message}\n`);

  console.log(`${CONFIG.bot.name} 已上線！登入為：${client.user.tag}`);
  console.log(`文字模型: ${CONFIG.model.text}`);
  console.log(`圖片模型: ${CONFIG.model.vision}`);
  console.log(`當前版本: ${CONFIG.version}`);

  const statusLogPath = path.join(__dirname, 'data/last_status_message.json');
  if (fs.existsSync(statusLogPath)) {
    try {
      const { channelId, messageId } = JSON.parse(fs.readFileSync(statusLogPath, 'utf8'));
      statusCommand.restoreCollector(client, channelId, messageId);
      console.log('「刷新狀態」按鈕已恢復');
    } catch (err) {
      console.warn('無法恢復按鈕:', err.message);
    }
  }
  registerCommands();
    
  let serverCount = 0;

  const updateStatus = async () => {
    const count = client.guilds.cache.size;
    if (count !== serverCount) {
      serverCount = count;
      try {
       /* ignore */
      } catch (err) {
        console.error('狀態:', err);
      }
      return;
    }
    
    const statusMessages = [
      `當前版本：${CONFIG.version}`,
      `正在服務 ${serverCount} 個伺服器!`,
      'Cohere AI 對話超好玩!',
      '想聊天？來和我聊天吧!',
      '獨特AI記憶功能還不來試試？',
      '新版本 新強化!',
      'No.1',
      '還在用傳統指令？超方便斜線指令等你來用!',
      '操作過於複雜？簡而易懂的系統等你來用!',
      `《 ${CONFIG.bot.name} 》`
    ];

    const randomMsg = statusMessages[Math.floor(Math.random() * statusMessages.length)];
    try {
      await client.user.setActivity(randomMsg, { type: ActivityType.Playing });
    } catch (err) {
      console.error('狀態更新失敗:', err);
    }
  };

  setInterval(updateStatus, 10000);
  updateStatus();
});

setTimeout(() => {
  console.log('===========');
  console.log(`BOT NAME: ${CONFIG.bot.name}`);
  console.log(`BOT ID: ${CONFIG.bot.id}`);
  console.log('===========');
  console.log(`VERSION: ${CONFIG.version}`);
  console.log(`AUTHOR: ${CONFIG.bot.author}`);
  console.log('===========');
}, 5000);

process.on('SIGINT', () => {
  console.warn('正在關閉...');
  if (updateInterval) clearInterval(updateInterval);
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  if (err.name === 'DiscordAPIError') {
    console.warn('Discord API 錯誤:', err.message);
  } else {
    console.error('未處理錯誤:', err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('未處理錯誤:', err.message);
});

client.once('error', (err) => {
  const summary = err.name === 'Error' ? err.message.split('\n')[0] : `${err.name}: ${err.message.split('\n')[0]}`;
  console.error('機器人錯誤：', summary);
});
process.once('warning', (warning) => {
  console.warn(`Node.js 警告：${warning.name}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('登入失敗:', err.message);
});
