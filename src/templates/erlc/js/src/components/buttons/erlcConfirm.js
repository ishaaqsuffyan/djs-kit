import { createButton } from '../../builders/index.js';
// Example component that performs an ER:LC action on button click.
// Trigger it anywhere with:
//   buildCustomId('erlc_confirm', { username: 'Builderman' }, { expiresIn: 120, userId: interaction.user.id })
export default createButton('erlc_confirm')
    .addParam('username')
    .setExecute(async (interaction, args) => {
    await interaction.reply({
        content: `Action confirmed for **${args.username}**. Replace this handler with your own ER:LC action (kick, ban, message, ...).`,
        ephemeral: true,
    });
});
