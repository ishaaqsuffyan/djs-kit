import { access, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { copyDir } from '../utils/fs.js';
import { getPackageRoot } from '../utils/paths.js';
import { log } from '../utils/logger.js';
import {
  erlcDependencies,
  erlcPresetMeta,
  erlcPresetOptionsSpec,
  parseAllowlist,
} from '../utils/erlc.js';
import type { ErlcOptions, ErlcPresetSelection, Lang } from '../types.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function serializeOptionValue(value: unknown, type: 'string' | 'number' | 'boolean'): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (type === 'number') return String(Number(value));
  if (type === 'boolean') return String(Boolean(value));
  return JSON.stringify(String(value));
}

function serializePresetBody(selections: ErlcPresetSelection[]): string {
  return erlcPresetMeta
    .map(({ id }) => {
      const selected = selections.find(selection => selection.id === id);
      const spec = erlcPresetOptionsSpec[id];
      const entries = Object.entries(spec).map(([key, optionSpec]) => {
        let value: unknown = selected?.options[key] ?? optionSpec.default;
        if (key === 'allowlist') {
          value = typeof value === 'string' ? parseAllowlist(value) : value;
        }
        return `      ${key}: ${serializeOptionValue(value, optionSpec.type)},`;
      });
      return `  ${id}: {\n    enabled: ${Boolean(selected?.enabled)},\n    options: {\n${entries.join('\n')}\n    },\n  },`;
    })
    .join('\n');
}

function tsPresetsConfig(selections: ErlcPresetSelection[]): string {
  return `export interface ErlcPresetRuntimeOptions {
  enabled: boolean;
  options: Record<string, unknown>;
}

export const erlcPresets: Record<string, ErlcPresetRuntimeOptions> = {
${serializePresetBody(selections)}
};
`;
}

function jsPresetsConfig(selections: ErlcPresetSelection[]): string {
  return `export const erlcPresets = {
${serializePresetBody(selections)}
};
`;
}

async function patchPackageJson(targetDir: string): Promise<void> {
  const packagePath = join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(packagePath, 'utf-8')) as Record<string, unknown>;
  pkg.dependencies = { ...((pkg.dependencies as Record<string, string>) ?? {}), ...erlcDependencies };
  pkg.overrides = {
    ...((pkg.overrides as Record<string, unknown>) ?? {}),
    '@erlcjs/presets': { '@erlcjs/core': '$@erlcjs/core' },
    '@erlcjs/map': { '@erlcjs/core': '$@erlcjs/core' },
  };
  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

async function appendErlcEnv(targetDir: string, options: ErlcOptions): Promise<void> {
  const lines = [
    'ERLC_SERVER_KEY=',
    'ERLC_GLOBAL_KEY=',
    `ERLC_MODE=${options.mode}`,
    `ERLC_POLLING_RATE_MS=${options.pollingRateMs}`,
    `ERLC_WEBHOOK_PORT=${options.webhook?.port ?? 3000}`,
    `ERLC_WEBHOOK_PATH=${options.webhook?.path ?? '/webhook'}`,
    `ERLC_WEBHOOK_SECRET=${options.webhook?.secret ?? ''}`,
    `ERLC_LOG_CHANNEL_ID=${options.logChannelId ?? ''}`,
    '',
  ];

  for (const envFile of ['.env', '.env.example']) {
    const file = join(targetDir, envFile);
    if (!await pathExists(file)) continue;
    const current = await readFile(file, 'utf-8');
    if (current.includes('ERLC_SERVER_KEY')) continue;
    const separator = current.endsWith('\n') ? '' : '\n';
    await writeFile(file, current + separator + lines.join('\n'), 'utf-8');
  }
}

async function patchIndex(targetDir: string, lang: Lang): Promise<void> {
  const file = join(targetDir, 'src', `index.${lang}`);
  if (!await pathExists(file)) return;
  let content = await readFile(file, 'utf-8');
  if (content.includes("from './erlc/index.js'")) return;

  content = content.replace(
    "import { config } from './config.js';",
    "import { config } from './config.js';\nimport { initErlc } from './erlc/index.js';"
  );

  content = content.replace(
    '  await client.login(config.token);',
    '  if (process.env.ERLC_SERVER_KEY) {\n    await initErlc(client);\n  }\n\n  await client.login(config.token);'
  );

  await writeFile(file, content, 'utf-8');
}

export interface GenerateErlcModuleOptions {
  lang: Lang;
  options: ErlcOptions;
}

/**
 * Add the ER:LC integration to a generated (or existing) djs-kit project.
 * Copies the erlc template tree, writes presets.config, and wires up the
 * package.json deps, .env files, and src/index entry.
 */
export async function generateErlcModule(
  targetDir: string,
  opts: GenerateErlcModuleOptions
): Promise<void> {
  const erlcTemplateDir = join(getPackageRoot(), 'src', 'templates', 'erlc', opts.lang);
  await copyDir(erlcTemplateDir, targetDir);

  const presetsContent = opts.lang === 'ts'
    ? tsPresetsConfig(opts.options.presets)
    : jsPresetsConfig(opts.options.presets);
  await writeFile(join(targetDir, 'src', 'erlc', `presets.config.${opts.lang}`), presetsContent, 'utf-8');

  await patchPackageJson(targetDir);
  await appendErlcEnv(targetDir, opts.options);
  await patchIndex(targetDir, opts.lang);

  log.success(`Added ER:LC integration (${opts.lang.toUpperCase()}).`);
}
