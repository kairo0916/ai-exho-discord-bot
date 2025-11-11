const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { URL } = require('url');

const fetch = globalThis.fetch || require('node-fetch');

function isIpHost(hostname) {
  return /^[0-9.]+$/.test(hostname) || /^\[?[0-9a-fA-F:]+\]?$/.test(hostname);
}

function parseSetCookieHeaders(headers) {
  const cookies = [];
  const raw = headers.raw ? headers.raw()['set-cookie'] : headers.get ? headers.get('set-cookie') : null;
  if (!raw) return cookies;
  const arr = Array.isArray(raw) ? raw : String(raw).split(/,(?=[^;]+=)/);
  for (const c of arr) {
    const parts = c.split(';').map(s => s.trim().toLowerCase());
    cookies.push({
      raw: c,
      secure: parts.includes('secure'),
      httponly: parts.includes('httponly'),
      samesite: parts.find(x => x.startsWith('samesite='))?.split('=')[1] || null,
    });
  }
  return cookies;
}

async function analyzeUrl(inputUrl) {
  const result = { score: 100, pass: [], fail: [], notes: [], meta: {} };

  let url;
  try {
    if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(inputUrl)) inputUrl = 'https://' + inputUrl;
    url = new URL(inputUrl);
  } catch (e) {
    result.score = 0;
    result.fail.push('無效的 URL 格式');
    result.notes.push('請確認輸入為完整網址，例：https://example.com');
    return result;
  }

  result.meta.url = url.href;
  result.meta.hostname = url.hostname;

  // === 所有原始檢查（完整保留）===
  if (isIpHost(url.hostname)) {
    result.fail.push('主機為 IP 位址（可能為惡意或臨時伺服器）');
    result.score -= 20;
  } else {
    result.pass.push('主機非 IP');
  }

  if (url.hostname.startsWith('xn--')) {
    result.fail.push('包含 punycode（可能為混淆域名）');
    result.score -= 10;
  }

  if (url.href.length > 200) {
    result.fail.push('網址過長（可疑或易被濫用）');
    result.score -= 5;
  }

  let resp;
  try {
    resp = await fetch(url.href, { method: 'GET', redirect: 'follow', timeout: 10000 });
  } catch (e) {
    result.fail.push('無法連線或連線逾時');
    result.notes.push(String(e));
    result.score = Math.max(0, result.score - 40);
    return result;
  }

  result.meta.status = `${resp.status} ${resp.statusText || ''}`.trim();
  if (resp.ok) result.pass.push(`HTTP 回應狀態 ${resp.status}`);
  else { result.fail.push(`HTTP 回應狀態 ${resp.status}`); result.score -= 10; }

  if (url.protocol === 'http:' && resp.url.startsWith('https://')) {
    result.pass.push('自動導向到 HTTPS');
  } else if (url.protocol === 'http:') {
    result.fail.push('未導向到 HTTPS');
    result.score -= 15;
  }

  const headers = resp.headers;
  const hsts = headers.get('strict-transport-security');
  if (hsts) result.pass.push('有 HSTS (Strict-Transport-Security)');
  else { result.fail.push('缺少 HSTS'); result.score -= 10; }

  const csp = headers.get('content-security-policy');
  if (csp) result.pass.push('有 Content-Security-Policy');
  else { result.fail.push('缺少 Content-Security-Policy'); result.score -= 8; }

  const xfo = headers.get('x-frame-options');
  if (xfo) result.pass.push('有 X-Frame-Options');
  else { result.fail.push('缺少 X-Frame-Options'); result.score -= 5; }

  const xcto = headers.get('x-content-type-options');
  if (xcto && xcto.toLowerCase().includes('nosniff')) result.pass.push('有 X-Content-Type-Options: nosniff');
  else { result.fail.push('缺少 X-Content-Type-Options 或未設為 nosniff'); result.score -= 5; }

  const refp = headers.get('referrer-policy');
  if (refp) result.pass.push('有 Referrer-Policy');
  else { result.fail.push('缺少 Referrer-Policy'); result.score -= 3; }

  const serverHdr = headers.get('server');
  if (serverHdr) result.notes.push(`Server header: ${serverHdr}`);
  else result.pass.push('未洩露 Server header');

  const cookies = parseSetCookieHeaders(headers);
  result.meta.cookies = cookies;
  if (cookies.length === 0) {
    result.notes.push('未設定 Set-Cookie 或沒有可檢查的 cookie');
  } else {
    let insecureCookieFound = false;
    for (const c of cookies) {
      if (!c.secure || !c.httponly) insecureCookieFound = true;
    }
    if (insecureCookieFound) {
      result.fail.push('有 cookie 未標記為 Secure 或 HttpOnly');
      result.score -= 6;
    } else {
      result.pass.push('所有檢測到的 cookie 都有 Secure 與 HttpOnly');
    }
  }

  if (resp.url.startsWith('https://')) {
    result.pass.push('使用 HTTPS（連線為 TLS）');
    result.notes.push('無法從此檢查取得憑證詳細資訊。若需要，請在伺服器端使用 tls.connect 或 openssl 檢查憑證到期與簽章。');
  } else {
    result.fail.push('未使用 HTTPS');
    result.score -= 25;
  }

  if (url.search && url.search.length > 200) {
    result.fail.push('Querystring 過長，可能包含敏感參數');
    result.score -= 5;
  }

  result.score = Math.max(0, Math.min(100, result.score));
  result.pass = Array.from(new Set(result.pass));
  result.fail = Array.from(new Set(result.fail));
  return result;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('網址安全性檢查')
    .setDescription('深度檢查網址安全性，給出專業分數與建議')
    .addStringOption(option =>
      option
        .setName('網址')
        .setDescription('輸入網址（自動補 https）')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const input = interaction.options.getString('網址');
    const analysis = await analyzeUrl(input);

    const embed = createMainEmbed(analysis);
    const row = createActionRow();

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    setupCollector(interaction, input, analysis, embed, row);
  }
};

function createMainEmbed(analysis) {
  const score = analysis.score;
  const color = score >= 80 ? 0x00FF00 : score >= 60 ? 0xFFFF00 : 0xFF0000;
  const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));

  return new EmbedBuilder()
    .setTitle('網址安全評測報告')
    .setDescription(`\`${analysis.meta.url}\``)
    .setColor(color)
    .setThumbnail(getScoreIcon(score))
    .addFields(
      {
        name: '安全分數',
        value: `\`\`\`diff\n${score >= 80 ? '+' : score >= 60 ? '' : '-'}${score} / 100\n\`\`\`\n${bar}`,
        inline: false
      },
      {
        name: '狀態摘要',
        value: [
          `**HTTP**：${analysis.meta.status || '未知'}`,
          `**主機**：${analysis.meta.hostname}`,
          `**協議**：${analysis.meta.url.startsWith('https') ? 'HTTPS' : 'HTTP'}`,
        ].join('\n'),
        inline: true
      },
      {
        name: '安全等級',
        value: score >= 80 ? '極高' : score >= 60 ? '中等' : '危險',
        inline: true
      }
    )
    .setFooter({ text: '點擊下方按鈕查看詳細分析' })
    .setTimestamp();
}

function getScoreIcon(score) {
  if (score >= 80) return 'https://i.imgur.com/8OKIGqA.png';
  if (score >= 60) return 'https://i.imgur.com/8OKIGqA.png';
  return 'https://i.imgur.com/8OKIGqA.png';
}

function createDetailEmbed(analysis) {
  const embed = new EmbedBuilder()
    .setTitle('詳細安全分析')
    .setColor(0x5865F2)
    .addFields(
      { name: '通過項目', value: analysis.pass.length ? analysis.pass.map(s => `${s}`).join('\n') : '無', inline: false },
      { name: '失敗項目', value: analysis.fail.length ? analysis.fail.map(s => `${s}`).join('\n') : '無', inline: false },
      { name: '備註', value: analysis.notes.length ? analysis.notes.map(s => `• ${s}`).join('\n') : '無', inline: false }
    );

  if (analysis.meta.cookies?.length) {
    const cookieText = analysis.meta.cookies.map((c, i) =>
      `${c.secure ? 'Secure' : ''} ${c.httponly ? 'HttpOnly' : ''} Cookie ${i+1}`
    ).join('\n');
    embed.addFields({ name: 'Cookie 安全', value: cookieText || '無', inline: false });
  }

  return embed;
}

function createActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('show_detail').setLabel('查看詳細').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('copy_report').setLabel('複製報告').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('recheck').setLabel('重新檢查').setStyle(ButtonStyle.Success)
  );
}

function setupCollector(interaction, input, analysis, currentEmbed, currentRow) {
  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300000
  });

  collector.on('collect', async i => {
    try {
      if (i.customId === 'show_detail') {
        const detailEmbed = createDetailEmbed(analysis);
        await i.reply({ embeds: [detailEmbed], ephemeral: true });
      }

      else if (i.customId === 'copy_report') {
        const report = [
          `網址安全報告 - ${analysis.meta.url}`,
          `分數: ${analysis.score}/100`,
          `狀態: ${analysis.meta.status}`,
          ``,
          `通過: ${analysis.pass.join(', ') || '無'}`,
          `失敗: ${analysis.fail.join(', ') || '無'}`,
          `備註: ${analysis.notes.join(' | ') || '無'}`
        ].join('\n');

        await i.reply({ content: `\`\`\`\n${report.slice(0, 1990)}\n\`\`\``, ephemeral: true });
      }

      else if (i.customId === 'recheck') {
        await i.deferUpdate();
        const newAnalysis = await analyzeUrl(input);
        const newEmbed = createMainEmbed(newAnalysis);
        const newRow = createActionRow();

        await interaction.editReply({
          embeds: [newEmbed],
          components: [newRow]
        });

        collector.stop();
        setupCollector(interaction, input, newAnalysis, newEmbed, newRow);
      }

    } catch (error) {
      console.error('按鈕錯誤:', error);
      await i.reply({ content: '操作失敗', ephemeral: true }).catch(() => {});
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}