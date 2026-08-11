import { createFlow } from '../prompts/createFlow.js';
import { generateProject } from '../generators/project.js';
import { log } from '../utils/logger.js';
import { isValidNpmName } from '../utils/validate.js';
import { isDatabasePreset } from '../utils/dbPresets.js';
import { isProjectPreset } from '../utils/projectPresets.js';
import type { CreateOptions } from '../types.js';

interface CreateCliOptions {
  lang?: string;
  db?: string;
  preset?: string;
  guildId?: string;
  prefix?: string;
  bare?: boolean;
  install?: boolean;
  erlc?: boolean;
}

export async function handleCreate(
  projectName: string,
  options: CreateCliOptions
): Promise<void> {
  if (!isValidNpmName(projectName)) {
    log.error(`Invalid project name "${projectName}". Use a valid npm package name, such as "my-discord-bot".`);
    process.exit(1);
  }

  let opts: CreateOptions;

  if (!options.lang) {
    // Interactive mode — run full prompt flow
    opts = await createFlow(projectName);
  } else {
    // Non-interactive mode — all required options must be provided
    if (!options.guildId) {
      log.error('--guild-id is required in non-interactive mode (when --lang is specified)');
      process.exit(1);
    }

    const lang = options.lang as 'ts' | 'js';
    if (lang !== 'ts' && lang !== 'js') {
      log.error(`Invalid --lang "${options.lang}". Must be "ts" or "js".`);
      process.exit(1);
    }

    const token = process.env.DISCORD_TOKEN ?? '';
    const clientId = process.env.DISCORD_CLIENT_ID ?? '';

    if (!token) {
      log.warn('No DISCORD_TOKEN environment variable set. Your .env will have an empty token.');
      log.info('Set DISCORD_TOKEN in your environment before running, or run interactively.');
    }

    const db = options.db ?? 'none';
    if (!isDatabasePreset(db)) {
      log.error(`Invalid --db "${options.db}". Must be one of: none, file, sqlite, postgres, mysql, mongo, redis.`);
      process.exit(1);
    }

    const preset = options.bare ? 'bare' : (options.preset ?? 'utility');
    if (!isProjectPreset(preset)) {
      log.error(`Invalid --preset "${options.preset}". Must be one of: bare, utility, moderation, tickets, community, erlc.`);
      process.exit(1);
    }

    opts = {
      name: projectName,
      lang,
      db,
      preset,
      guildId: options.guildId,
      clientId,
      token,
      prefix: options.prefix ?? '!',
      bare: preset === 'bare',
      install: options.install ?? true,
      erlc: Boolean(options.erlc || preset === 'erlc'),
    };
  }

  await generateProject(opts);
}
