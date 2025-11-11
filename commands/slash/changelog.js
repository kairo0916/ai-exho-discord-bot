// commands/slash/changelog.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder
} = require('discord.js');

const CURRENT_VERSION = process.env.BOT_VERSION;
const SERVER_LINK = process.env.SERVER_LINK;

const CHANGELOGS = {
  V1: [
    { date: '2025/11/05 23:47', updates: ['修正了部分錯誤', '新增了 </更新日誌:1436023624804073523>'] },
    { date: '2025/11/06 00:36', updates: ['新增了 </回報問題:1435664859671822366>'] }, 
    { date: '2025/11/06 13:48', updates: ['新增了 </清除訊息:1434928712041762982>'] },
    { date: '2025/11/06 23:58', updates: ['修改了 </當前狀態:1433852159690146034> 的內容文字'] },
    { date: '2025/11/07 00:31', updates: ['修改了 </更新日誌:1436023624804073523> 的排版與邏輯'] },
    { date: '2025/11/08 11:53', updates: ['修復了AI對話無法使用的問題'] },
    { date: '2025/11/08 14:14', updates: ['在現有的AI邏輯上加入 “思考中” 功能，方便查看是否正在生成回應'] },
    { date: '2025/11/09 02:13', updates: ['修復了部分代碼的問題'] },
    { date: '2025/11/09 03:28', updates: ['修復AI對話可被 `@everyone` 及 `@here` 呼叫的問題'] },
    { date: '2025/11/09 04:16', updates: ['新增了 </二進制轉換器:1436802761655058473>'] },
    { date: '2025/11/09 10:38', updates: ['新增了 </網址安全性檢查:1436818493206036511>'] },
    { date: '2025/11/09 14:07', updates: ['新增了 </http:1436930382028083210>'] },
    { date: '2025/11/09 19:38', updates: ['新增了 </拍頭:1437073007787901009>'] },
    { date: '2025/11/09 21:38', updates: ['新增了 </隨機梗圖:1437075856404254730>'] },
    { date: '2025/11/09 22:39', updates: ['修改了AI邏輯和部分內容'] },
    { date: '2025/11/10 22:03', updates: ['新增描述圖片功能（使用 Gemini 2.0 Flash）'] }
  ] // 這裡加上 , 可以新增其他版本
};  // 可自由新增 V2: [] V3: [] 記得在上面的 ] 後面加上 ,

function createMenu(selected = null) {
  return new StringSelectMenuBuilder()
    .setCustomId('changelog_select')
    .setPlaceholder('選擇版本...')
    .addOptions(
      Object.keys(CHANGELOGS).map(v => ({
        label: v,
        value: v,
        default: v === selected
      }))
    );
}

function createEmbed(version) {
  const logs = CHANGELOGS[version] || [];
  const embed = new EmbedBuilder()
    .setTitle(`${version} 版本`)
    .setColor(logs.length > 0 ? 0x00FF00 : 0xFF0000)
    .setTimestamp();

  if (logs.length === 0) {
    embed.setDescription('# 還沒到這個版本！');
    return embed;
  }

  logs.forEach(entry => {
    embed.addFields({
      name: entry.date,
      value: entry.updates.length > 0 ? entry.updates.map(line => `> ${line}`).join('\n') : '> 無內容'
    });
  });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('更新日誌')
    .setDescription('查看至今為止的所有更新'),

  async execute(interaction) {
    const summaryEmbed = new EmbedBuilder()
      .setTitle('Exho 機器人更新日誌')
      .setDescription(`**ℹ️ 目前最新版本為: ${CURRENT_VERSION}**\n**🔗 支援群: ${SERVER_LINK} **`)
      .setFooter({ text: 'Exho' })
      .setColor(0x00AAFF)
      .setTimestamp();

    const menu = createMenu();
    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      embeds: [summaryEmbed],
      components: [row]
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId === 'changelog_select',
      time: 86400000
    });

    collector.on('collect', async i => {
      await i.deferUpdate();
      const selected = i.values[0];
      const embed = createEmbed(selected);
      const newMenu = createMenu(selected);
      const newRow = new ActionRowBuilder().addComponents(newMenu);

      await i.editReply({
        content: '**更新日誌**',
        embeds: [embed],
        components: [newRow]
      });
    });
  }
};