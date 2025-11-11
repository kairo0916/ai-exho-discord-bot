const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../data/marriage.json');

function readData() {
  try {
    if (!fs.existsSync(dataPath)) return {};
    const raw = fs.readFileSync(dataPath);
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('婚姻')
    .setDescription('婚姻系統：結婚、離婚、查詢')
    .addSubcommand(sub =>
      sub.setName('結婚')
        .setDescription('向某人求婚 💞')
        .addUserOption(opt => opt.setName('使用者').setDescription('你想結婚的人').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('離婚')
        .setDescription('向某人提出離婚 💔')
        .addUserOption(opt => opt.setName('使用者').setDescription('你想離婚的人').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('查詢')
        .setDescription('查詢你的婚姻資料')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.user;
    const data = readData();

    if (sub === '結婚') {
      const target = interaction.options.getUser('使用者');
      if (user.id === target.id) return interaction.reply('🤔 你不能娶自己啦～');

      const userSpouses = Object.entries(data)
        .filter(([k,v]) => v.includes(user.id))
        .map(([k,v]) => k);
      if (userSpouses.length > 0)
        return interaction.reply(`❌ 你已經和 <@${userSpouses[0]}> 結婚了，不能再結婚！`);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('accept_marriage')
            .setLabel('✅接受')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('decline_marriage')
            .setLabel('❌拒絕')
            .setStyle(ButtonStyle.Danger)
        );

      const embed = new EmbedBuilder()
        .setTitle(`💌 婚姻請求`)
        .setDescription(`${user} 向你求婚！`)
        .setColor(0xff99cc);

      await interaction.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', i => {
        if (i.user.id !== target.id) {
          return i.reply({ content: '❌ 你不能操作這個請求！', ephemeral: true });
        }

        if (i.customId === 'accept_marriage') {
          if (!data[target.id]) data[target.id] = [];
          if (!data[target.id].includes(user.id)) data[target.id].push(user.id);
          writeData(data);

          i.update({ content: `## ${user} 和 ${target} 在一起啦！💞`, embeds: [], components: [] });
        } else if (i.customId === 'decline_marriage') {
          i.update({ content: `## ${user} 被 ${target} 拒絕了... 💔`, embeds: [], components: [] });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0)
          message.edit({ content: `❌ ${target} 沒有回應婚姻請求...`, embeds: [], components: [] });
      });

      return;
    }

    if (sub === '離婚') {
      const target = interaction.options.getUser('使用者');
      if (!data[target.id] || !data[target.id].includes(user.id))
        return interaction.reply(`🤔 你跟 ${target} 沒有婚姻關係哦`);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('accept_divorce')
            .setLabel('✅接受')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('decline_divorce')
            .setLabel('❌拒絕')
            .setStyle(ButtonStyle.Success)
        );

      const embed = new EmbedBuilder()
        .setTitle(`💔 離婚請求`)
        .setDescription(`${user} 要和你離婚！`)
        .setColor(0xff5555);

      await interaction.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', i => {
        if (i.user.id !== target.id) {
          return i.reply({ content: '❌ 你不能操作這個請求！', ephemeral: true });
        }

        if (i.customId === 'accept_divorce') {
          data[target.id] = data[target.id].filter(id => id !== user.id);
          if (data[target.id].length === 0) delete data[target.id];
          writeData(data);

          i.update({ content: `## ${user} 和 ${target} 離婚了... 💔`, embeds: [], components: [] });
        } else if (i.customId === 'decline_divorce') {
          i.update({ content: `## ${target} 拒絕了 ${user} 的離婚請求！❤️`, embeds: [], components: [] });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0)
          message.edit({ content: `❌ ${target} 沒有回應離婚請求...`, embeds: [], components: [] });
      });

      return;
    }

    if (sub === '查詢') {
      const spouses = data[user.id] || [];
      if (spouses.length === 0) return interaction.reply('# 你現在單身！💔');

      const mentionList = spouses.map(id => `<@${id}>`).join('、');
      const embed = new EmbedBuilder()
        .setTitle('💞 婚姻資料')
        .setDescription(`你現在和 ${mentionList} 正在一起！💞`)
        .setColor(0xff99cc);

      return interaction.reply({ embeds: [embed] });
    }
  }
};