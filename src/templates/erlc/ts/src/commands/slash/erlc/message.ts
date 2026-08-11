import { PermissionFlagsBits } from 'discord.js';
import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { getErlcClient } from '../../../erlc/index.js';

export default createSlashCommand('erlc-message')
  .setDescription('Send an in-game message to an online ER:LC player')
  .setCategory('ER:LC')
  .addParam('name', ParamType.String, { required: true, description: 'Roblox username (must be online)' })
  .addParam('message', ParamType.String, { required: true, description: 'Message to send' })
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addExample('/erlc-message name:Builderman message:Please lower your wanted level')
  .setExecute(async (interaction, args) => {
    const erlc = getErlcClient();
    if (!erlc) {
      await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
      return;
    }

    const name = String(args.name ?? '').trim();
    const player = [...erlc.players.cache.values()].find(
      (entry) => entry.username.toLowerCase() === name.toLowerCase()
    );

    if (!player) {
      await interaction.reply({ content: `No online player named **${name}**.`, ephemeral: true });
      return;
    }

    await player.message(String(args.message));
    await interaction.reply({ content: `Sent a message to **${player.username}**.`, ephemeral: true });
  });
