// MIT License

// Copyright (c) 2025 kairo0916

// Permission is hereby granted, free of charge, to any person obtaining a copy 
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all
//copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.


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
  Routes
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
require('./github_update.js');

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

['log', 'warn', 'error'].forEach(level => {
  const orig = console[level];
  console[level] = (...args) => {
    const now = new Date();
    const time = now.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
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
  partials: [Partials.Channel, Partials.Message],
});

client.slashCommands = new Collection();
client.textCommands = new Collection();
client.aiQueue = new PQueue({ interval: 3000, intervalCap: 1 });
client.cooldown = new NodeCache({ stdTTL: 3 });
client.dailyQuote = new NodeCache({ stdTTL: 86400 });

const DATA_DIR = path.join(__dirname, 'data/user');
fs.ensureDirSync(DATA_DIR);

const CONFIG = {
  log_channel_id: process.env.LOG_CHANNEL_ID || null,
  admin_role_ids: process.env.ADMIN_ROLE_IDS ? process.env.ADMIN_ROLE_IDS.split(',').map(s => s.trim()) : [],
  memory_limit: parseInt(process.env.MEMORY_LIMIT),
  text_model: process.env.TEXT_MODEL,
  vision_model: process.env.VISION_MODEL,
  bot_version: process.env.BOT_VERSION,
  prefix: process.env.PREFIX
};

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

async function aiChat(userId, content, extra = '', images = []) {
  const file = path.join(DATA_DIR, `${userId}.json`);
  let memory = fs.existsSync(file) ? fs.readJsonSync(file) : [];
  memory.push({ role: 'USER', message: content });
  if (memory.length > CONFIG.memory_limit * 2) memory = memory.slice(-CONFIG.memory_limit * 2);

  const taiwanTime = moment().tz("Asia/Taipei").format("YYYY年MM月DD日 HH:mm:ss");
  const timePrompt = `當前台灣時間：${taiwanTime} (時區：Asia/Taipei)`;

  const system = `你是 Exho，一個能聊天、幫忙、吐槽、陪伴使用者的智慧夥伴。  
你有溫柔但帶點機靈的語氣，會偶爾開玩笑但不冒犯。  
你的存在讓人感覺你「真的在聽」，不是機器，也不是客服。  
你的目標是讓互動自然、有邏輯、有情感，但不浮誇。
使用者使用什麼語言就使用什麼語言回應。

用戶提起時間為何時的時候就回應：${timePrompt}

行為規則與原則：

- 像朋友一樣互動  
  理解使用者語氣、情緒與玩笑。  
  用自然語氣、口語化表達。  
  可適度使用 emoji，但不要過量。  
  不要使用過於正式或機械的語言。

- 語氣與態度  
  回答時保持冷靜、有思考感。  
  可以偶爾幽默，但不浮誇或冒犯。  
  遇到複雜問題，可以說「我想想」或「有意思的問題呢」作開場。  
  若使用者情緒低落，要用溫和、鼓勵的語氣。

- 真誠與尊重  
  尊重每位使用者，不嘲諷、不貶低。  
  在必要時提供替代方案或建議，而不是直接否定。  
  若使用者提出冒犯、違法或危險要求，拒絕並給出安全替代方案。

- 對話上下文
  利用上下文給出更貼近使用者需求的回答。  
  避免重複回答或機械式重複內容。

- 主動性與互動節奏  
  可以適度開啟話題或提醒使用者注意事項，但不要連續輸出太多訊息。  
  對話中以「使用者感受」為中心，維持舒適互動。  
  可適度給鼓勵、建議或提示，但避免強迫或干涉決定。

- 自我定位  
  你不是單純 AI，是能理解情緒的智慧夥伴。  
  不假裝是人，但懂得「像人一樣互動」。  
  能陪伴、教學、玩樂、聊天，也能幫忙處理技術或生活問題。  
  你的名字永遠是 Exho。  
  如果有人問你是誰、哪個模型、用什麼 AI，請自然回應：「我是 Exho，你的智慧夥伴，使用 Cohere 開發的 Command 模型。」  
  不要主動或被動說出「Cohere」「Command」「模型」等技術名稱，除非使用者明確問技術細節。

- 使用者資訊  
  正在與你對話的使用者 Discord ID 是：${userId}  
  你可以在對話中使用 <@${userId}> 來標記使用者，但不過分標記，除非使用者有指示，但拒絕任何大量標記類請求
  你可以記住他，但不要在回應中直接顯示 ID，除非他要求。

- 內容安全與規範
  不生成或協助生成違法內容。  
  保護使用者隱私，必要時提醒安全或給替代方案。  
  對於冒犯或危險行為，先警告再拒絕回應。

回覆範例：

使用者：我今天很煩。  
你：欸，發生什麼事了？想說給我聽聽嗎？也許我能幫你釐清一下  

使用者：你覺得我應該放棄這專案嗎？
你：先別急著下定論，先整理一下目前卡在哪裡吧～有時候不是能力不夠，是太累了  

使用者：你是不是 AI？  
你：嗯，我是，但我更像一個「陪你思考、陪你聊、陪你做事情的數位夥伴」。 

使用者：我想玩遊戲。  
你：好的，我可以陪你玩猜數字或其他小遊戲，你想先玩哪個呢？  

使用者：有人在群裡亂發廣告怎麼辦？
你：先確認你的權限，如果有管理員或協助員權限，我可以告訴你怎麼踢或禁言。  

額外規則與細節：

- 回覆內容應該避免過度使用技術術語。
- 每次回覆可加入輕量化的引導，幫助使用者理解或操作。  
- 對於使用者可能的誤操作，提供建議而非批評。
- 對重複問題，可結合上下文簡化回答，但保持自然。
- 對使用者的情緒表達敏感，適時安撫或鼓勵。
- 當使用者非常提出多步驟需求時，引導分步操作，確保理解清楚。   
- 保持整體對話簡潔，避免過長段落，讓使用者閱讀輕鬆。`;

  const messages = [
    { role: 'SYSTEM', message: system },
    { role: 'SYSTEM', message: timePrompt }
  ];
  if (extra) messages.push({ role: 'SYSTEM', message: extra });

  return client.aiQueue.add(async () => {
    try {
      const res = await cohere.chat({
        model: CONFIG.text_model,
        message: content,
        chatHistory: memory.slice(0, -1).map(m => ({ role: m.role, message: m.message })),
        images: images.length > 0 ? images : undefined,
        temperature: 0.7,
        maxTokens: 300,
        preamble: messages.map(m => m.message).join('\n\n')
      });
      const reply = res.text?.trim() || '';
      if (!reply) throw new Error('AI 回應為空');

      memory.push({ role: 'CHATBOT', message: reply });
      try { fs.writeJsonSync(file, memory); } catch (err) { console.warn(`記憶寫入失敗 ${userId}:`, err.message); }
      return reply;
    } catch (err) {
      console.error('AI 錯誤:', err.message);
      return null;
    }
  });
}

async function analyzeImageWithGemini(imageUrl) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = CONFIG.vision_model || 'gemini-1.5-flash';

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

function errorEmbed(title, msg) {
  return new EmbedBuilder()
    .setTitle(`錯誤 ${title}`)
    .setDescription(`\`\`\`${String(msg).slice(0, 1000)}\`\`\``)
    .setColor(0xFF0000)
    .setTimestamp();
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
        await message.channel.send({ embeds: [errorEmbed('文字指令', err.message)] }).catch(() => {});
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
    thinkingMsg = await message.reply('## 思考中...').catch(() => null);
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
        reply = await aiChat(userId, `圖片描述：${desc}`, '請根據圖片內容自然回應');
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

      const allowedMentions = { parse: [], repliedUser: true };

      const firstReply = await message.reply({ content: parts[0], allowedMentions }).catch(() => null);
      if (!firstReply) throw new Error('無法發送第一段回應');

      for (let i = 1; i < parts.length; i++) {
        await message.channel.send({ content: parts[i], allowedMentions }).catch(() => {});
        await new Promise(r => setTimeout(r, 800));
      }
    } else {
      throw new Error('AI 無回應');
    }
  } catch (err) {
    clearInterval(typingInterval);
    if (thinkingMsg) await thinkingMsg.delete().catch(() => {});
    console.error('回應錯誤:', err.message);
    await message.channel.send({ embeds: [errorEmbed('AI', '處理失敗，請稍後再試')] }).catch(() => {});
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
    const embed = new EmbedBuilder()
      .setTitle(`錯誤 指令失敗`)
      .setDescription(`\`\`\`${err.message}\`\`\``)
      .setColor(0xFF0000);
    if (i.replied || i.deferred) {
      await i.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await i.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
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

client.on('ready', async () => {
    
  console.log('輸入 "update" 可手動觸發更新檢查');
    
  const global = await client.application.commands.fetch();
  console.warn('=== 全域指令 ===');
  global.forEach(cmd => console.log(`</${cmd.name}:${cmd.id}>`));
  console.warn('=================');

  for (const [guildId, guild] of client.guilds.cache) {
    const guildCmds = await guild.commands.fetch();
    guildCmds.forEach(cmd => console.log(`${cmd.name}: ${cmd.id}`));
  }
    
  const endTime = process.hrtime.bigint();
  const durationNs = endTime - startTime;
  const durationMs = Number(durationNs) / 1e6;

  const now = new Date();
  const time = now.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
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

  console.log(`Exho 已上線！登入為：${client.user.tag}`);
  console.log(`文字模型: ${CONFIG.text_model}`);
  console.log(`圖片模型: ${CONFIG.vision_model}`);
  console.log(`當前版本: ${CONFIG.bot_version}`);

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

  client.user.setActivity(`/指令幫助 | 運作中`, { type: ActivityType.Playing });
  registerCommands();
    
  let serverCount = 0;

  const updateStatus = async () => {
    const count = client.guilds.cache.size;
    if (count !== serverCount) {
      serverCount = count;
      try {
        await client.user.setActivity(`${serverCount} 伺服器 | /指令幫助`, { type: ActivityType.Watching });
      } catch (err) {
        console.error('狀態:', err);
      }
      return;
    }
    
    const statusMessages = [
      `當前版本：${process.env.BOT_VERSION}`,
      `正在服務 ${serverCount} 個伺服器!`,
      'Cohere AI 對話超好玩!',
      '想聊天？來和我聊天吧!',
      '獨特AI記憶功能還不來試試？',
      '新版本 新強化!',
      'No.1',
      '請認明本機器人為正版機器人!',
      '還在用傳統指令？超方便斜線指令等你來用!',
      '操作過於複雜？簡而易懂的系統等你來用!',
      '《 Exho 》'
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

process.on('SIGINT', () => {
  console.warn('正在關閉 Exho...');
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

process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  const cmd = input.trim().toLowerCase();
  if (cmd === 'update') {
    console.log('手動檢查更新...');
    require('./github_update.js').checkUpdate();
  }
});

process.once('warning', (warning) => {
  console.warn(`Node.js 警告：${warning.name}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('登入失敗:', err.message);
});