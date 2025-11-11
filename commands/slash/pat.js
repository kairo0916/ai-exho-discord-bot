const fetch = require('node-fetch');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('摸摸頭')
    .setDescription('給別人（或自己）一個溫柔的摸頭！')
    .addUserOption(option =>
      option
        .setName('使用者')
        .setDescription('要拍頭的對象（不填就摸自己）')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('使用者') || interaction.user;
    const isSelf = target.id === interaction.user.id;

    let gifUrl = 'https://i.imgur.com/4pZ3X.gif';
    try {
      const res = await fetch('https://nekos.best/api/v2/pat');
      const data = await res.json();
      if (data?.results?.length > 0) {
        gifUrl = data.results[0].url;
      }
    } catch (err) {
      console.error('Nekos.best 錯誤，使用預設圖:', err.message);
    }

    const embed = new EmbedBuilder()
      .setDescription(
        isSelf
          ? `**${interaction.user} 自己拍了拍自己的頭…好可愛！**`
          : `**${interaction.user} 輕輕拍了拍 ${target} 的頭！**`
      )
      .setImage(gifUrl)
      .setColor(0xff99cc)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};