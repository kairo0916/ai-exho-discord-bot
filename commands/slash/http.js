const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const fetch = globalThis.fetch || require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('http')
    .setDescription('傳送 HTTP 狀態碼的貓貓或狗狗圖片')
    .addStringOption(option =>
      option
        .setName('種類')
        .setDescription('選擇圖片類型')
        .setRequired(true)
        .addChoices(
          { name: '貓', value: 'cat' },
          { name: '狗', value: 'dog' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('狀態碼')
        .setDescription('輸入任意 HTTP 狀態碼（100~599）')
        .setRequired(true)
        .setMinValue(100)
        .setMaxValue(599)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('種類');
    const code = interaction.options.getInteger('狀態碼');

    const baseUrl = type === 'cat' ? 'https://http.cat' : 'https://http.dog';
    const imageUrl = `${baseUrl}/${code}.jpg`;

    const exists = await checkImageExists(imageUrl);
    if (!exists) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF6B6B)
          .setDescription([
            `**${type === 'cat' ? '貓貓' : '狗狗'} 沒有 \`${code}\` 的圖片**`,
            ``,
            `網址：\`${imageUrl}\``,
            ``,
            `建議常見碼：418、404、200、500`
          ].join('\n'))
          .setFooter({ text: '可嘗試其他狀態碼' })
        ],
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setDescription(`**${code}**`)
      .setImage(imageUrl)
      .setColor(getStatusColor(code))
      .setFooter({ text: type === 'cat' ? 'http.cat' : 'http.dog' });

    await interaction.reply({ embeds: [embed] });
  }
};

function getStatusColor(code) {
  if (code >= 200 && code < 300) return 0x00FF00;
  if (code >= 300 && code < 400) return 0x00AE86;
  if (code >= 400 && code < 500) return 0xFFA500;
  return 0xFF0000;
}

async function checkImageExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && res.headers.get('content-type')?.includes('image');
  } catch {
    return false;
  }
}