import { createSlashCommand } from '../../../builders/index.js';
import { infoEmbed } from '../../../lib/embeds.js';
import { getErlcClient } from '../../../erlc/index.js';

const MAX_ROWS = 25;

export default createSlashCommand('erlc-players')
  .setDescription('List online ER:LC players')
  .setCategory('ER:LC')
  .addExample('/erlc-players')
  .setExecute(async (interaction) => {
    const erlc = getErlcClient();
    if (!erlc) {
      await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
      return;
    }

    const players = [...erlc.players.cache.values()];
    if (players.length === 0) {
      await interaction.reply({ content: 'No players are currently online.', ephemeral: true });
      return;
    }

    const lines = players.slice(0, MAX_ROWS).map((player) =>
      `**${player.username}** — ${player.team ?? 'no team'} · ${player.permission}${player.wantedLevel > 0 ? ` · ${player.wantedLevel}★ wanted` : ''}`
    );
    const truncated = players.length > MAX_ROWS ? `\n… and ${players.length - MAX_ROWS} more.` : '';

    await interaction.reply({
      embeds: [
        infoEmbed({
          title: 'Online Players',
          description: lines.join('\n') + truncated,
          footer: `${players.length} total online`,
        }),
      ],
      ephemeral: true,
    });
  });
