import { Command } from 'commander';
import { handleCreate } from './create.js';
import { handleAdd } from './add.js';
import { handleDoctor, handleEnv, handleSyncCommands, handleUpgrade, handleValidate } from './projectTools.js';

const program = new Command();

program
  .name('djs-kit')
  .description('CLI to bootstrap and manage a discord.js v14 bot project')
  .version('0.1.0');

program
  .command('create <project-name>')
  .description('Scaffold a new discord.js bot project')
  .option('--lang <ts|js>', 'output language (ts or js) — omit to use interactive prompts')
  .option('--db <none|file|sqlite|postgres|mysql|mongo|redis>', 'database/storage preset', 'none')
  .option('--preset <bare|utility|moderation|tickets|community|erlc>', 'starter project preset', 'utility')
  .option('--guild-id <id>', 'Discord guild ID to bake into config (required in non-interactive mode)')
  .option('--prefix <prefix>', 'default command prefix')
  .option('--bare', 'do not generate example commands and components')
  .option('--erlc', 'include the ER:LC server integration (default preset config, all presets disabled)')
  .option('--no-install', 'skip running npm install after scaffold')
  .action(handleCreate);

const addCmd = program
  .command('add')
  .description('Generate a new command or component file inside a djs-kit project');

addCmd.addHelpText('after', `
Example calls:
  $ djs-kit create my-bot
  $ djs-kit add command ping
  $ djs-kit add event ready
  $ djs-kit add autocomplete ping style
  $ djs-kit add context inspectUser --type user
  $ djs-kit add button confirm_delete
  $ djs-kit add command admin/ban --type prefix
  $ djs-kit add command info prefix
`);

addCmd
  .command('command <name> [type]')
  .description('Generate a new command file. <name> accepts paths like moderation/kick')
  .option('--type <slash|prefix>', 'command type (slash or prefix)', 'slash')
  .action((name: string, type: string | undefined, opts: { type: string }) => {
    handleAdd('command', name, { ...opts, type: type ?? opts.type });
  });

addCmd
  .command('event <name>')
  .description('Generate a new Discord event listener. <name> accepts paths like guild/memberAdd')
  .action((name: string) => handleAdd('event', name, {}));

addCmd
  .command('autocomplete <command-name> <option-name>')
  .description('Generate an autocomplete handler for a slash command option')
  .action((commandName: string, optionName: string) => handleAdd('autocomplete', commandName, { option: optionName }));

addCmd
  .command('context <name>')
  .description('Generate a user or message context menu command')
  .option('--type <user|message>', 'context menu type', 'user')
  .action((name: string, opts: { type: string }) => handleAdd('context', name, opts));

addCmd
  .command('button <name>')
  .description('Generate a new button component. <name> accepts paths like moderation/confirmBan')
  .action((name: string) => handleAdd('button', name, {}));

addCmd
  .command('modal <name>')
  .description('Generate a new modal component')
  .action((name: string) => handleAdd('modal', name, {}));

addCmd
  .command('select <name>')
  .description('Generate a new select menu component')
  .action((name: string) => handleAdd('select', name, {}));

addCmd
  .command('erlc')
  .description('Add the ER:LC server integration (module, presets, slash commands) to this project')
  .action(() => handleAdd('erlc', '', {}));

program
  .command('doctor')
  .description('Inspect a djs-kit project for common configuration issues')
  .action(handleDoctor);

program
  .command('validate')
  .description('Statically validate commands, components, contexts, and env requirements')
  .action(handleValidate);

program
  .command('env')
  .description('Print required environment variable names for this project')
  .action(handleEnv);

program
  .command('sync-commands')
  .description('Register slash and context menu commands without starting the bot')
  .action(handleSyncCommands);

program
  .command('upgrade')
  .description('Inspect upgrade readiness for an existing generated project')
  .action(handleUpgrade);

await program.parseAsync();
