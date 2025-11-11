const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  Collection
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('清除訊息')
    .setDescription('刪除指定數量的訊息（最多 99999 則）')
    .addIntegerOption(option =>
      option
        .setName('數量')
        .setDescription('要刪除的訊息數量（1~99999）')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(99999)
    )
    .addUserOption(option =>
      option
        .setName('使用者')
        .setDescription('僅刪除此使用者的訊息（選填）')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.member;
    const botMember = interaction.guild.members.me;

    // === 權限檢查 ===
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff5555)
          .setTitle('權限不足')
          .setDescription('你需要 **管理訊息** 權限才能使用此指令。')
          .setTimestamp()
        ],
        ephemeral: true
      });
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff5555)
          .setTitle('機器人權限不足')
          .setDescription('我需要 **管理訊息** 權限才能刪除訊息。\n請給予我此權限後再試一次。')
          .setTimestamp()
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const amount = interaction.options.getInteger('數量');
    const targetUser = interaction.options.getUser('使用者');
    let deletedCount = 0;
    let lastMessageId = null;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      while (deletedCount < amount) {
        const toDeleteCount = Math.min(amount - deletedCount, 100);
        const fetchOptions = { limit: toDeleteCount };
        if (lastMessageId) fetchOptions.before = lastMessageId;

        const messages = await interaction.channel.messages.fetch(fetchOptions).catch(() => new Collection());
        if (messages.size === 0) break;

        let targetMessages = messages;

        // 篩選特定使用者
        if (targetUser) {
          targetMessages = messages.filter(m => m.author.id === targetUser.id);
          if (targetMessages.size === 0) {
            lastMessageId = messages.last()?.id;
            continue;
          }
        }

        // 轉為 ID 陣列（關鍵修復！）
        const messageIds = targetMessages.map(m => m.id);

        // 執行批量刪除
        const deleted = await interaction.channel.bulkDelete(messageIds, true).catch(err => {
          console.error('Bulk delete 失敗:', err);
          return new Collection();
        });

        deletedCount += deleted.size;
        lastMessageId = targetMessages.last()?.id;

        // 避免觸發 rate limit
        if (deleted.size > 0) await sleep(1000);

        // 如果這次沒刪滿，代表已到最舊訊息
        if (deleted.size < toDeleteCount) break;
      }
    } catch (error) {
      console.error('清除訊息時發生錯誤:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff5555)
        .setTitle('執行失敗')
        .setDescription('清除訊息時發生未知錯誤，請稍後再試。')
        .addFields({ name: '錯誤', value: `\`\`\`${error.message.slice(0, 1000)}\`\`\`` })
        .setTimestamp();

      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
    }

    // === 成功回報 ===
    const successEmbed = new EmbedBuilder()
      .setColor(0x55ff55)
      .setTitle('訊息已清除')
      .addFields(
        { name: '已刪除', value: `\`${deletedCount}\` 則`, inline: true },
        { 
          name: '目標', 
          value: targetUser ? `<@${targetUser.id}>` : '所有使用者', 
          inline: true 
        },
        { name: '執行者', value: `<@${interaction.user.id}>`, inline: false }
      )
      .setTimestamp()
      .setFooter({ 
        text: 'Exho', 
        iconURL: interaction.client.user.displayAvatarURL() 
      });

    await interaction.editReply({ embeds: [successEmbed] }).catch(() => {});
  }
};