import {
  intro,
  outro,
  text,
  password,
  select,
  group,
  spinner,
  cancel,
  confirm,
  isCancel,
} from '@clack/prompts';
import pc from 'picocolors';
import { validateToken } from '../utils/discord.js';
import { isValidSnowflake, isValidPrefix } from '../utils/validate.js';
import { log } from '../utils/logger.js';
import { erlcFlow } from './erlcFlow.js';
import type { CreateOptions, ErlcOptions } from '../types.js';

export async function createFlow(projectName: string): Promise<CreateOptions> {
  intro(pc.bold(pc.cyan('djs-kit')) + pc.dim(' — discord.js bot scaffolder'));

  const answers = await group(
    {
      lang: () =>
        select({
          message: 'Output language?',
          options: [
            { value: 'ts', label: 'TypeScript', hint: 'compiled, fully typed' },
            { value: 'js', label: 'JavaScript', hint: 'runs directly, no build step' },
          ],
        }),

      token: () =>
        password({
          message: 'Bot token?',
          validate: (v) => (!v || v.trim().length === 0 ? 'Token is required' : undefined),
        }),

      clientId: () =>
        text({
          message: 'Client ID (application ID)?',
          placeholder: '123456789012345678',
          validate: (v) =>
            !v || !isValidSnowflake(v)
              ? 'Must be a valid Discord snowflake (17-19 digit number)'
              : undefined,
        }),

      guildId: () =>
        text({
          message: 'Guild ID (your server)?',
          placeholder: '123456789012345678',
          validate: (v) =>
            !v || !isValidSnowflake(v)
              ? 'Must be a valid Discord snowflake (17-19 digit number)'
              : undefined,
        }),

      db: () =>
        select({
          message: 'Cooldown storage?',
          options: [
            { value: 'none', label: 'Memory', hint: 'resets when the bot restarts' },
            { value: 'file', label: 'File', hint: 'persists cooldowns locally' },
            { value: 'sqlite', label: 'SQLite + Drizzle', hint: 'local database, great for small bots' },
            { value: 'postgres', label: 'PostgreSQL + Drizzle', hint: 'production relational database' },
            { value: 'mysql', label: 'MySQL + Drizzle', hint: 'production relational database' },
            { value: 'mongo', label: 'MongoDB', hint: 'document database adapter' },
            { value: 'redis', label: 'Redis', hint: 'fast remote cache/storage' },
          ],
        }),

      prefix: () =>
        text({
          message: 'Command prefix?',
          initialValue: '!',
          validate: (v) =>
            !v || !isValidPrefix(v) ? 'Prefix must be between 1 and 4 characters' : undefined,
        }),

      preset: () =>
        select({
          message: 'Starter preset?',
          options: [
            { value: 'utility', label: 'Utility', hint: 'General commands, events, components, and helpers' },
            { value: 'bare', label: 'Bare', hint: 'Empty folders, no example features' },
            { value: 'moderation', label: 'Moderation', hint: 'Moderation commands and audit examples' },
            { value: 'tickets', label: 'Tickets', hint: 'Ticket command, buttons, and modal examples' },
            { value: 'community', label: 'Community', hint: 'Welcome/community management examples' },
            { value: 'erlc', label: 'ER:LC', hint: 'ER:LC server integration with presets and slash commands' },
          ],
        }),
    },
    {
      onCancel: () => {
        cancel('Scaffolding cancelled.');
        process.exit(0);
      },
    }
  );

  // Validate token against Discord API
  const s = spinner();
  s.start('Validating Discord token...');
  const validation = await validateToken(answers.token as string);

  if (!validation.valid) {
    s.stop(pc.red('Token validation failed'));
    log.error(`Invalid token: ${validation.error}`);
    log.info('Make sure you copied the full token from the Discord Developer Portal.');
    process.exit(1);
  }

  s.stop(pc.green(`Validated — logged in as ${pc.bold(validation.username)}`));

  const wantsErlc = answers.preset === 'erlc';
  let erlcOptions: ErlcOptions | undefined;
  if (answers.preset !== 'erlc') {
    const addErlc = await confirm({
      message: 'Add ER:LC server integration (players, presets, slash commands)?',
      initialValue: false,
    });
    if (isCancel(addErlc)) {
      cancel('Scaffolding cancelled.');
      process.exit(0);
    }
    if (addErlc) {
      log.step('Configuring ER:LC integration');
      erlcOptions = await erlcFlow();
      if (!erlcOptions) {
        cancel('Scaffolding cancelled.');
        process.exit(0);
      }
    }
  } else {
    log.step('Configuring ER:LC integration');
    erlcOptions = await erlcFlow();
    if (!erlcOptions) {
      cancel('Scaffolding cancelled.');
      process.exit(0);
    }
  }

  outro(pc.green('Options collected — scaffolding your bot!'));

  return {
    name: projectName,
    lang: answers.lang as 'ts' | 'js',
    token: answers.token as string,
    clientId: answers.clientId as string,
    guildId: answers.guildId as string,
    db: answers.db as CreateOptions['db'],
    preset: answers.preset as CreateOptions['preset'],
    prefix: answers.prefix as string,
    bare: answers.preset === 'bare',
    install: true,
    erlc: wantsErlc || erlcOptions !== undefined,
    erlcOptions,
  };
}
