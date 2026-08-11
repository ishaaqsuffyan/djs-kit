import { createSlashCommand } from '../../../builders/index.js';
import { infoEmbed } from '../../../lib/embeds.js';
import { getErlcClient } from '../../../erlc/index.js';
export default createSlashCommand('erlc-status')
    .setDescription('Show ER:LC server status')
    .setCategory('ER:LC')
    .addExample('/erlc-status')
    .setExecute(async (interaction) => {
    const erlc = getErlcClient();
    if (!erlc) {
        await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
        return;
    }
    const server = erlc.server.cache;
    await interaction.reply({
        embeds: [
            infoEmbed({
                title: server?.name ?? `Server #${erlc.serverId}`,
                description: [
                    `**Players:** ${server?.currentPlayers ?? 0}/${server?.maxPlayers ?? 0}`,
                    `**Queue:** ${server?.queue.length ?? 0}`,
                    `**Join key:** ${server?.joinKey ?? 'unknown'}`,
                    `**Team balance:** ${server?.teamBalance ? 'on' : 'off'}`,
                ].join('\n'),
                footer: `Mode: ${process.env.ERLC_MODE === 'webhook' ? 'webhook' : 'polling'}`,
            }),
        ],
        ephemeral: true,
    });
});
