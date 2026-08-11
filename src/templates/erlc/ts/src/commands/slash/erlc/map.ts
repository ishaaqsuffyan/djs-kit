import { MapType, drawMap } from '@erlcjs/map';
import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { getErlcClient } from '../../../erlc/index.js';

export default createSlashCommand('erlc-map')
  .setDescription('Render a live ER:LC map with player positions')
  .setCategory('ER:LC')
  .addParam('map', ParamType.String, {
    description: 'Map to render',
    choices: ['fall', 'fall_postals', 'snow', 'snow_postals'],
  })
  .addExample('/erlc-map')
  .setExecute(async (interaction, args) => {
    const erlc = getErlcClient();
    if (!erlc) {
      await interaction.reply({ content: 'ER:LC integration is not configured. Set ERLC_SERVER_KEY and restart.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const selected = String(args.map ?? 'fall') as keyof typeof MapType;
      const buffer = await drawMap({
        map: MapType[selected] ?? MapType.fall,
        players: erlc.players,
        showModCalls: true,
      });

      await interaction.editReply({
        content: `Live map — ${erlc.players.cache.size} players online.`,
        files: [{ attachment: buffer, name: 'erlc-map.png' }],
      });
    } catch (error) {
      await interaction.editReply({ content: `Failed to render the map: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
