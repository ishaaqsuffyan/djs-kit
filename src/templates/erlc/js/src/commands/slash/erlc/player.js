import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { infoEmbed } from '../../../lib/embeds.js';
import { getErlcClient } from '../../../erlc/index.js';
export default createSlashCommand('erlc-player')
    .setDescription('Show details for an online ER:LC player')
    .setCategory('ER:LC')
    .addParam('name', ParamType.String, { required: true, description: 'Roblox username (must be online)' })
    .addExample('/erlc-player name:Builderman')
    .setExecute(async (interaction, args) => {
    const erlc = getErlcClient();
    if (!erlc) {
        await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
        return;
    }
    const name = String(args.name ?? '').trim();
    const player = [...erlc.players.cache.values()].find((entry) => entry.username.toLowerCase() === name.toLowerCase());
    if (!player) {
        await interaction.reply({ content: `No online player named **${name}**. The ER:LC API only exposes online players.`, ephemeral: true });
        return;
    }
    await interaction.reply({
        embeds: [
            infoEmbed({
                title: player.username,
                fields: [
                    { name: 'User ID', value: String(player.id), inline: true },
                    { name: 'Team', value: player.team ?? 'None', inline: true },
                    { name: 'Permission', value: player.permission, inline: true },
                    { name: 'Wanted', value: `${player.wantedLevel}★`, inline: true },
                    { name: 'Location', value: `${player.location.streetName} ${player.location.buildingNumber} (${player.location.postalCode})`, inline: false },
                ],
            }),
        ],
        ephemeral: true,
    });
});
