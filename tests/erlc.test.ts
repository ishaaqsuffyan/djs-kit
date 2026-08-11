import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateProject } from '../src/generators/project.js';
import { generateErlcModule } from '../src/generators/erlc.js';
import { getRequiredEnv } from '../src/cli/projectTools.js';
import type { ErlcOptions } from '../src/types.js';

const erlcOptions: ErlcOptions = {
  mode: 'polling',
  pollingRateMs: 5000,
  logChannelId: '345678901234567890',
  presets: [
    { id: 'welcomePlayer', enabled: true, options: { message: 'Welcome to the server!' } },
    { id: 'banVehicles', enabled: true, options: { vehicles: ['Bugatti Veyron'], delay: 15, allowlist: [] } },
    { id: 'banCommand', enabled: true, options: { commands: [':admin'], action: 'ban', startsWith: true, allowlist: ['Server Owner', 123456789] } },
  ],
};

test('generates an ER:LC project with configured presets', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'djskit-erlc-project-'));
  const cwd = process.cwd();

  try {
    process.chdir(tmp);
    await generateProject({
      name: 'erlc-bot',
      lang: 'ts',
      token: 'token-value',
      clientId: '123456789012345678',
      guildId: '234567890123456789',
      db: 'none',
      preset: 'utility',
      prefix: '!',
      install: false,
      erlc: true,
      erlcOptions,
    });

    for (const file of ['config.ts', 'presets.ts', 'client.ts', 'bridge.ts', 'index.ts', 'presets.config.ts']) {
      await readFile(join(tmp, 'erlc-bot', 'src', 'erlc', file), 'utf-8');
    }
    for (const file of ['status.ts', 'players.ts', 'player.ts', 'kick.ts', 'ban.ts', 'message.ts', 'map.ts']) {
      await readFile(join(tmp, 'erlc-bot', 'src', 'commands', 'slash', 'erlc', file), 'utf-8');
    }
    await readFile(join(tmp, 'erlc-bot', 'src', 'components', 'buttons', 'erlcConfirm.ts'), 'utf-8');

    const confirm = await readFile(join(tmp, 'erlc-bot', 'src', 'components', 'buttons', 'erlcConfirm.ts'), 'utf-8');
    assert.match(confirm, /import \{ createButton \} from '\.\.\/\.\.\/builders\/index\.js';/);

    const bridge = await readFile(join(tmp, 'erlc-bot', 'src', 'erlc', 'bridge.ts'), 'utf-8');
    assert.match(bridge, /erlc\.on\('error', \(error\) =>/);
    assert.doesNotMatch(bridge, /ERLCEvents\.error/);

    const presets = await readFile(join(tmp, 'erlc-bot', 'src', 'erlc', 'presets.config.ts'), 'utf-8');
    assert.match(presets, /welcomePlayer: \{\n\s+enabled: true,/);
    assert.match(presets, /vehicles: \["Bugatti Veyron"\],/);
    assert.match(presets, /allowlist: \["Server Owner",123456789\],/);
    assert.match(presets, /action: "ban",/);
    assert.match(presets, /startsWith: true,/);

    const env = await readFile(join(tmp, 'erlc-bot', '.env'), 'utf-8');
    assert.match(env, /ERLC_SERVER_KEY=/);
    assert.match(env, /ERLC_MODE=polling/);
    assert.match(env, /ERLC_POLLING_RATE_MS=5000/);
    assert.match(env, /ERLC_LOG_CHANNEL_ID=345678901234567890/);

    const envExample = await readFile(join(tmp, 'erlc-bot', '.env.example'), 'utf-8');
    assert.match(envExample, /ERLC_WEBHOOK_PORT=/);

    const index = await readFile(join(tmp, 'erlc-bot', 'src', 'index.ts'), 'utf-8');
    assert.match(index, /import \{ initErlc \} from '\.\/erlc\/index\.js';/);
    assert.match(index, /if \(process\.env\.ERLC_SERVER_KEY\) \{\n\s+await initErlc\(client\);/);

    const pkg = JSON.parse(await readFile(join(tmp, 'erlc-bot', 'package.json'), 'utf-8'));
    assert.equal(pkg.dependencies['@erlcjs/core'], '^1.4.1');
    assert.equal(pkg.dependencies['@erlcjs/presets'], '^1.0.0');
    assert.equal(pkg.dependencies['@erlcjs/map'], '^1.0.0');
    assert.deepEqual(pkg.overrides['@erlcjs/presets'], { '@erlcjs/core': '$@erlcjs/core' });
    assert.deepEqual(pkg.overrides['@erlcjs/map'], { '@erlcjs/core': '$@erlcjs/core' });

    const required = await getRequiredEnv(join(tmp, 'erlc-bot'));
    assert.ok(required.includes('ERLC_SERVER_KEY'));
  } finally {
    process.chdir(cwd);
    await rm(tmp, { recursive: true, force: true });
  }
});

test('erlc preset generates the module with default (disabled) presets', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'djskit-erlc-preset-'));
  const cwd = process.cwd();

  try {
    process.chdir(tmp);
    await generateProject({
      name: 'erlc-preset-bot',
      lang: 'ts',
      token: 'token-value',
      clientId: '123456789012345678',
      guildId: '234567890123456789',
      db: 'none',
      preset: 'erlc',
      prefix: '!',
      install: false,
    });

    const presets = await readFile(join(tmp, 'erlc-preset-bot', 'src', 'erlc', 'presets.config.ts'), 'utf-8');
    assert.match(presets, /welcomePlayer: \{\n\s+enabled: false,/);
    assert.match(presets, /rdm: \{\n\s+enabled: false,/);
    assert.doesNotMatch(presets, /enabled: true/);
  } finally {
    process.chdir(cwd);
    await rm(tmp, { recursive: true, force: true });
  }
});

test('generates the ER:LC module in JavaScript', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'djskit-erlc-js-'));
  const cwd = process.cwd();

  try {
    process.chdir(tmp);
    await generateProject({
      name: 'erlc-js-bot',
      lang: 'js',
      token: 'token-value',
      clientId: '123456789012345678',
      guildId: '234567890123456789',
      db: 'none',
      preset: 'bare',
      prefix: '!',
      install: false,
      erlc: true,
      erlcOptions: {
        mode: 'webhook',
        pollingRateMs: 5000,
        webhook: { port: 4000, path: '/erlc', secret: 'abc123' },
        presets: [],
      },
    });

    for (const file of ['index.js', 'config.js', 'presets.config.js', 'presets.js']) {
      await readFile(join(tmp, 'erlc-js-bot', 'src', 'erlc', file), 'utf-8');
    }
    const kick = await readFile(join(tmp, 'erlc-js-bot', 'src', 'commands', 'slash', 'erlc', 'kick.js'), 'utf-8');
    assert.match(kick, /createSlashCommand\('erlc-kick'\)/);

    const presets = await readFile(join(tmp, 'erlc-js-bot', 'src', 'erlc', 'presets.config.js'), 'utf-8');
    assert.doesNotMatch(presets, /: Record<string, ErlcPresetRuntimeOptions>/);

    const env = await readFile(join(tmp, 'erlc-js-bot', '.env'), 'utf-8');
    assert.match(env, /ERLC_MODE=webhook/);
    assert.match(env, /ERLC_WEBHOOK_PORT=4000/);
    assert.match(env, /ERLC_WEBHOOK_PATH=\/erlc/);

    const index = await readFile(join(tmp, 'erlc-js-bot', 'src', 'index.js'), 'utf-8');
    assert.match(index, /import \{ initErlc \} from '\.\/erlc\/index\.js';/);
  } finally {
    process.chdir(cwd);
    await rm(tmp, { recursive: true, force: true });
  }
});

test('add erlc is idempotent on an existing project', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'djskit-erlc-add-'));
  const cwd = process.cwd();

  try {
    process.chdir(tmp);
    await generateProject({
      name: 'existing-bot',
      lang: 'ts',
      token: 'token-value',
      clientId: '123456789012345678',
      guildId: '234567890123456789',
      db: 'none',
      preset: 'utility',
      prefix: '!',
      install: false,
    });

    const projectRoot = join(tmp, 'existing-bot');
    await generateErlcModule(projectRoot, { lang: 'ts', options: erlcOptions });
    await generateErlcModule(projectRoot, { lang: 'ts', options: erlcOptions });

    const env = await readFile(join(projectRoot, '.env'), 'utf-8');
    assert.equal((env.match(/ERLC_SERVER_KEY=/g) ?? []).length, 1);

    const index = await readFile(join(projectRoot, 'src', 'index.ts'), 'utf-8');
    assert.equal((index.match(/import \{ initErlc \} from '\.\/erlc\/index\.js';/g) ?? []).length, 1);
  } finally {
    process.chdir(cwd);
    await rm(tmp, { recursive: true, force: true });
  }
});
