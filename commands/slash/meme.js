const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('隨機梗圖')
    .setDescription('從各種地方隨機抓一張梗圖'),

  async execute(interaction) {
    await interaction.deferReply();

    const sources = [
      async () => {
        const res = await fetch('https://meme-api.com/gimme');
        const data = await res.json();
        return {
          title: data.title,
          url: data.url,
          footer: `來源：r/${data.subreddit}`
        };
      },
      async () => {
        const res = await fetch('https://api.imgflip.com/get_memes');
        const data = await res.json();
        const memes = data.data.memes;
        const random = memes[Math.floor(Math.random() * memes.length)];
        return {
          title: random.name,
          url: random.url,
          footer: '來源：Imgflip'
        };
      },
      async () => {
        const res = await fetch('https://nekos.best/api/v2/neko');
        const data = await res.json();
        return {
          title: '動漫趣圖 💕',
          url: data.results[0].url,
          footer: '來源：Nekos.best'
        };
      },
      async () => {
        const res = await fetch('https://some-random-api.com/animal/cat');
        const data = await res.json();
        return {
          title: '貓貓 😼',
          url: data.image,
          footer: '來源：Some Random API'
        };
      }
    ];

    try {
      const randomSource = sources[Math.floor(Math.random() * sources.length)];
      const meme = await randomSource();

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setImage(meme.url)
        .setFooter({ text: meme.footer })
        .setColor(0xff9900)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('梗圖錯誤:', err);
      await interaction.editReply('🥲 梗圖伺服器抽風了，等下再試吧。');
    }
  }
};