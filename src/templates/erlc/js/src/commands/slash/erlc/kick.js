import { PermissionFlagsBits } from 'discord.js';
import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { askForConfirmation } from '../../../lib/confirm.js';
import { getErlcClient } from '../../../erlc/index.js';
export default createSlashCommand('erlc-kick')
    .setDescription('Kick an online ER:LC player')
    .setCategory('ER:LC')
    .addParam('name', ParamType.String, { required: true, description: 'Roblox username (must be online)' })
    .addParam('reason', ParamType.String, { description: 'Reason shown in-game' })
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addExample('/erlc-kick name:Builderman reason:spam')
    .setExecute(async (interaction, args) => {
    const erlc = getErlcClient();
    if (!erlc) {
        await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
        return;
    }
    const name = String(args.name ?? '').trim();
    const player = [...erlc.players.cache.values()].find((entry) => entry.username.toLowerCase() === name.toLowerCase());
    if (!player) {
        await interaction.reply({ content: `No online player named **${name}**.`, ephemeral: true });
        return;
    }
    const confirmed = await askForConfirmation(interaction, {
        message: `Kick **${player.username}** from the ER:LC server?`,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timeoutMs: 30_000,
    });
    if (!confirmed)
        return;
    await player.kick(String(args.reason ?? 'Kicked by a moderator.'));
    await interaction.followUp({ content: `Kicked **${player.username}**.`, ephemeral: true });
});
