const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('二進制轉換器')
    .setDescription('文字 ↔ 二進制 互相轉換')
    .addStringOption(option =>
      option
        .setName('模式')
        .setDescription('選擇轉換方向')
        .setRequired(true)
        .addChoices(
          { name: '文字 → 二進制', value: 'text_to_bin' },
          { name: '二進制 → 文字', value: 'bin_to_text' }
        )
    )
    .addStringOption(option =>
      option
        .setName('輸入')
        .setDescription('要轉換的內容')
        .setRequired(true)
    ),

  async execute(interaction) {
    const mode = interaction.options.getString('模式');
    const input = interaction.options.getString('輸入').trim();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('binary_mode_select')
      .setPlaceholder('選擇轉換模式...')
      .addOptions([
        { label: '文字 → 二進制', value: 'text_to_bin' },
        { label: '二進制 → 文字', value: 'bin_to_text' }
      ]);

    const copyButton = new ButtonBuilder()
      .setCustomId('copy_result')
      .setLabel('複製結果')
      .setStyle(ButtonStyle.Primary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(copyButton);

    let embed = new EmbedBuilder()
      .setTitle('二進制轉換器')
      .setColor(0x00AE86)
      .setTimestamp();

    let result = '';
    let valid = true;

    try {
      if (mode === 'text_to_bin') {
        result = input
          .split('')
          .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
          .join(' ');
        embed.setDescription(`**輸入文字：**\n\`${input}\`\n\n**二進制：**\n\`${result}\``);
      } else {
        const clean = input.replace(/[^01\s]/g, '');
        const bytes = clean.split(/\s+/).filter(b => b.length > 0);

        if (bytes.some(b => !/^[01]{1,16}$/.test(b))) {
          valid = false;
          embed.setDescription('錯誤：二進制只能包含 0 和 1，且每組最多 16 位元');
        } else {
          result = bytes
            .map(byte => String.fromCharCode(parseInt(byte, 2)))
            .join('');
          embed.setDescription(`**輸入二進制：**\n\`\`\`\n${input}\n\`\`\`\n\n**轉為文字：**\n\`${result}\``);
        }
      }
    } catch (err) {
      valid = false;
      embed.setDescription(`轉換失敗：${err.message}`);
    }

    if (!valid) embed.setColor(0xFF0000);

    await interaction.reply({
      embeds: [embed],
      components: valid ? [row1, row2] : [row1],
      ephemeral: false
    });

    const filter = i => 
      (i.customId === 'binary_mode_select' || i.customId === 'copy_result') && 
      i.user.id === interaction.user.id;

    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 300000
    });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'binary_mode_select') {
          const newMode = i.values[0];
          const newInput = mode === 'text_to_bin' ? result : input;

          await i.update({
            content: `模式切換為：**${newMode === 'text_to_bin' ? '文字 → 二進制' : '二進制 → 文字'}**`,
            embeds: [],
            components: []
          });

          setTimeout(async () => {
            const newEmbed = new EmbedBuilder()
              .setTitle('二進制轉換器')
              .setColor(0x00AE86)
              .setTimestamp();

            let newResult = '';
            let newValid = true;

            if (newMode === 'text_to_bin') {
              newResult = newInput
                .split('')
                .map(c => c.charCodeAt(0).toString(2).padStart(8, '0'))
                .join(' ');
              newEmbed.setDescription(`**輸入文字：**\n\`${newInput}\`\n\n**二進制：**\n\`\`\`\n${newResult}\n\`\`\``);
            } else {
              const clean = newInput.replace(/[^01\s]/g, '');
              const bytes = clean.split(/\s+/).filter(b => b);
              if (bytes.some(b => !/^[01]{1,16}$/.test(b))) {
                newValid = false;
                newEmbed.setDescription('錯誤：二進制格式不正確');
              } else {
                newResult = bytes.map(b => String.fromCharCode(parseInt(b, 2))).join('');
                newEmbed.setDescription(`**輸入二進制：**\n\`\`\`\n${newInput}\n\`\`\`\n\n**轉為文字：**\n\`${newResult}\``);
              }
            }

            if (!newValid) newEmbed.setColor(0xFF0000);

            await i.followUp({
              embeds: [newEmbed],
              components: newValid ? [row1, row2] : [row1],
              ephemeral: false
            });
          }, 500);
        }

        if (i.customId === 'copy_result') {
          await i.reply({
            content: `\`\`\`\n${result}\n\`\`\``,
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Binary 互動錯誤:', err);
      }
    });
  }
};