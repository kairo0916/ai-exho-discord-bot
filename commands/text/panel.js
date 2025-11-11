// commands/panel.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

module.exports = {
  name: 'panel',
  description: '開啟 Exho 控制面板（Components V2）',
  async execute(message, args, client) {

    const baseEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('🧭 Exho 控制面板')
      .setDescription('選擇下方選單以切換資訊類別。')
      .setFooter({ text: `由 ${message.author.username} 開啟` });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('panel_menu')
      .setPlaceholder('📂 選擇要查看的內容')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('📝 伺服器總覽')
          .setValue('servers')
          .setDescription('查看所有伺服器的基本資訊'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🤖 Exho 資訊')
          .setValue('botinfo')
          .setDescription('查看 Exho 機器人資訊'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📊 系統統計')
          .setValue('stats')
          .setDescription('顯示系統統計與使用量'),
      ]);

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_panel')
      .setLabel('❌ 關閉面板')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(menu);
    const closeRow = new ActionRowBuilder().addComponents(closeBtn);

    const sent = await message.channel.send({
      embeds: [baseEmbed],
      components: [row, closeRow],
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id)
        return interaction.reply({ content: '⚠️ 這不是你的面板。', ephemeral: true });

      const value = interaction.values[0];
      let embed;

      if (value === 'servers') {
        const guilds = client.guilds.cache
          .map(g => `📌 **${g.name}**\n👥 成員: ${g.memberCount}\n🆔 ${g.id}`)
          .join('\n\n');
        embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('📝 伺服器總覽')
          .setDescription(guilds || '目前沒有伺服器。');
      } 
      else if (value === 'botinfo') {
        embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🤖 Exho 資訊')
          .addFields(
            { name: '名稱', value: client.user.username, inline: true },
            { name: '延遲', value: `${Date.now() - message.createdTimestamp}ms`, inline: true },
            { name: '版本', value: 'Exho v1.0', inline: true },
            { name: '框架', value: 'Discord.js v14 + Components V2', inline: false },
          );
      } 
      else if (value === 'stats') {
        embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('📊 系統統計')
          .addFields(
            { name: '伺服器數', value: `${client.guilds.cache.size}`, inline: true },
            { name: '頻道數', value: `${client.channels.cache.size}`, inline: true },
            {
              name: '使用者總數',
              value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
              inline: true,
            },
          );
      }

      await interaction.update({ embeds: [embed], components: [row, closeRow] });
    });

    const closeCollector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    closeCollector.on('collect', async (i) => {
      if (i.user.id !== message.author.id)
        return i.reply({ content: '⚠️ 你不能操作這個面板。', ephemeral: true });

      if (i.customId === 'close_panel') {
        await i.update({ content: '🧾 Exho 面板已關閉。', embeds: [], components: [] });
        collector.stop();
        closeCollector.stop();
      }
    });

    collector.on('end', async () => {
      row.components[0].setDisabled(true);
      closeBtn.setDisabled(true);
      await sent.edit({ components: [row, closeRow] });
    });
  },
};