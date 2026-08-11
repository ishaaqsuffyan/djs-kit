import { resolve, join, dirname } from 'path';
import { mkdir, access, writeFile, rm, readFile } from 'fs/promises';
import { execSync } from 'child_process';
import pc from 'picocolors';
import { copyDir, interpolateDir } from '../utils/fs.js';
import { getTemplateDir } from '../utils/paths.js';
import { log } from '../utils/logger.js';
import { defaultErlcOptions } from '../utils/erlc.js';
import { generateErlcModule } from './erlc.js';
import type { CreateOptions, DatabasePreset, ProjectPreset } from '../types.js';

type JsonPackage = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function cooldownBackendFor(db: DatabasePreset) {
  return db === 'none' ? 'memory' : db;
}

function dbEnvLines(db: DatabasePreset): string[] {
  if (db === 'sqlite') return ['DATABASE_URL=file:./.djskit-data/bot.sqlite'];
  if (db === 'postgres') return ['DATABASE_URL=postgres://user:password@localhost:5432/my_bot'];
  if (db === 'mysql') return ['DATABASE_URL=mysql://user:password@localhost:3306/my_bot'];
  if (db === 'mongo') return ['DATABASE_URL=mongodb://localhost:27017/my_bot'];
  if (db === 'redis') return ['DATABASE_URL=redis://localhost:6379'];
  return [];
}

function dependencyPatch(db: DatabasePreset): JsonPackage {
  if (db === 'sqlite') {
    return {
      dependencies: { 'better-sqlite3': '^11.9.1', 'drizzle-orm': '^0.36.0' },
      devDependencies: { '@types/better-sqlite3': '^7.6.11', 'drizzle-kit': '^0.28.0' },
      scripts: { 'db:generate': 'drizzle-kit generate', 'db:migrate': 'drizzle-kit migrate', 'db:studio': 'drizzle-kit studio' },
    };
  }
  if (db === 'postgres') {
    return {
      dependencies: { 'drizzle-orm': '^0.36.0', postgres: '^3.4.5' },
      devDependencies: { 'drizzle-kit': '^0.28.0' },
      scripts: { 'db:generate': 'drizzle-kit generate', 'db:migrate': 'drizzle-kit migrate', 'db:studio': 'drizzle-kit studio' },
    };
  }
  if (db === 'mysql') {
    return {
      dependencies: { 'drizzle-orm': '^0.36.0', mysql2: '^3.11.5' },
      devDependencies: { 'drizzle-kit': '^0.28.0' },
      scripts: { 'db:generate': 'drizzle-kit generate', 'db:migrate': 'drizzle-kit migrate', 'db:studio': 'drizzle-kit studio' },
    };
  }
  if (db === 'mongo') return { dependencies: { mongodb: '^6.11.0' } };
  if (db === 'redis') return { dependencies: { ioredis: '^5.4.1' } };
  return {};
}

async function patchPackageJson(targetDir: string, db: DatabasePreset): Promise<void> {
  const patch = dependencyPatch(db);
  if (!patch.dependencies && !patch.devDependencies && !patch.scripts) return;

  const packagePath = join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(packagePath, 'utf-8')) as JsonPackage;
  pkg.dependencies = { ...(pkg.dependencies ?? {}), ...(patch.dependencies ?? {}) };
  pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...(patch.devDependencies ?? {}) };
  pkg.scripts = { ...(pkg.scripts ?? {}), ...(patch.scripts ?? {}) };
  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function drizzleConfig(db: DatabasePreset): string | null {
  if (db === 'sqlite') {
    return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL?.replace(/^file:/, '') ?? './.djskit-data/bot.sqlite',
  },
});
`;
  }
  if (db === 'postgres') {
    return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
`;
  }
  if (db === 'mysql') {
    return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
`;
  }
  return null;
}

function dbSource(db: DatabasePreset, lang: 'ts' | 'js'): Record<string, string> {
  const ext = lang === 'ts' ? 'ts' : 'js';
  const files: Record<string, string> = {};

  if (db === 'sqlite') {
    files[`src/db/schema.${ext}`] = lang === 'ts'
      ? `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cooldowns = sqliteTable('cooldowns', {
  key: text('key').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});
`
      : `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cooldowns = sqliteTable('cooldowns', {
  key: text('key').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});
`;
    files[`src/db/cooldowns.${ext}`] = `import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { cooldowns } from './schema.js';

const databasePath = (process.env.DATABASE_URL ?? 'file:./.djskit-data/bot.sqlite').replace(/^file:/, '');
mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.exec('CREATE TABLE IF NOT EXISTS cooldowns (key text primary key, expires_at integer not null)');
const db = drizzle(sqlite);

export function createDatabaseCooldownStore() {
  return {
    async check(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''})${lang === 'ts' ? ': Promise<number | null>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      const row = db.select().from(cooldowns).where(eq(cooldowns.key, key)).get();
      if (!row) return null;
      const now = Date.now();
      if (now > row.expiresAt) {
        db.delete(cooldowns).where(eq(cooldowns.key, key)).run();
        return null;
      }
      return row.expiresAt - now;
    },
    async set(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''}, durationMs${lang === 'ts' ? ': number' : ''})${lang === 'ts' ? ': Promise<void>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      db.insert(cooldowns).values({ key, expiresAt: Date.now() + durationMs }).onConflictDoUpdate({
        target: cooldowns.key,
        set: { expiresAt: Date.now() + durationMs },
      }).run();
    },
  };
}
`;
  }

  if (db === 'postgres') {
    files[`src/db/schema.${ext}`] = `import { bigint, pgTable, text } from 'drizzle-orm/pg-core';

export const cooldowns = pgTable('cooldowns', {
  key: text('key').primaryKey(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});
`;
    files[`src/db/cooldowns.${ext}`] = `import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { cooldowns } from './schema.js';

const client = postgres(process.env.DATABASE_URL ?? '', { max: 1 });
const db = drizzle(client);

export async function createDatabaseCooldownStore() {
  await client\`CREATE TABLE IF NOT EXISTS cooldowns (key text primary key, expires_at bigint not null)\`;
  return {
    async check(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''})${lang === 'ts' ? ': Promise<number | null>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      const [row] = await db.select().from(cooldowns).where(eq(cooldowns.key, key));
      if (!row) return null;
      const now = Date.now();
      if (now > row.expiresAt) {
        await db.delete(cooldowns).where(eq(cooldowns.key, key));
        return null;
      }
      return row.expiresAt - now;
    },
    async set(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''}, durationMs${lang === 'ts' ? ': number' : ''})${lang === 'ts' ? ': Promise<void>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      await db.insert(cooldowns).values({ key, expiresAt: Date.now() + durationMs }).onConflictDoUpdate({
        target: cooldowns.key,
        set: { expiresAt: Date.now() + durationMs },
      });
    },
  };
}
`;
  }

  if (db === 'mysql') {
    files[`src/db/schema.${ext}`] = `import { bigint, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const cooldowns = mysqlTable('cooldowns', {
  key: varchar('cooldown_key', { length: 191 }).primaryKey(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});
`;
    files[`src/db/cooldowns.${ext}`] = `import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { cooldowns } from './schema.js';

const pool = mysql.createPool(process.env.DATABASE_URL ?? '');
const db = drizzle(pool);

export async function createDatabaseCooldownStore() {
  await pool.query('CREATE TABLE IF NOT EXISTS cooldowns (cooldown_key varchar(191) primary key, expires_at bigint not null)');
  return {
    async check(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''})${lang === 'ts' ? ': Promise<number | null>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      const [row] = await db.select().from(cooldowns).where(eq(cooldowns.key, key));
      if (!row) return null;
      const now = Date.now();
      if (now > row.expiresAt) {
        await db.delete(cooldowns).where(eq(cooldowns.key, key));
        return null;
      }
      return row.expiresAt - now;
    },
    async set(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''}, durationMs${lang === 'ts' ? ': number' : ''})${lang === 'ts' ? ': Promise<void>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      await db.insert(cooldowns).values({ key, expiresAt: Date.now() + durationMs }).onDuplicateKeyUpdate({
        set: { expiresAt: Date.now() + durationMs },
      });
    },
  };
}
`;
  }

  if (db === 'mongo') {
    files[`src/db/cooldowns.${ext}`] = `import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.DATABASE_URL ?? 'mongodb://localhost:27017/my_bot');
const ready = client.connect();

export async function createDatabaseCooldownStore() {
  await ready;
  const collection = client.db().collection('cooldowns');
  await collection.createIndex({ key: 1 }, { unique: true });
  return {
    async check(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''})${lang === 'ts' ? ': Promise<number | null>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      const row = await collection.findOne({ key });
      if (!row) return null;
      const now = Date.now();
      if (now > row.expiresAt) {
        await collection.deleteOne({ key });
        return null;
      }
      return row.expiresAt - now;
    },
    async set(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''}, durationMs${lang === 'ts' ? ': number' : ''})${lang === 'ts' ? ': Promise<void>' : ''} {
      const key = \`\${commandName}:\${userId}\`;
      await collection.updateOne({ key }, { $set: { key, expiresAt: Date.now() + durationMs } }, { upsert: true });
    },
  };
}
`;
  }

  if (db === 'redis') {
    files[`src/db/cooldowns.${ext}`] = `import Redis from 'ioredis';

const redis = new Redis(process.env.DATABASE_URL ?? 'redis://localhost:6379');

export function createDatabaseCooldownStore() {
  return {
    async check(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''})${lang === 'ts' ? ': Promise<number | null>' : ''} {
      const ttl = await redis.pttl(\`cooldown:\${commandName}:\${userId}\`);
      return ttl > 0 ? ttl : null;
    },
    async set(commandName${lang === 'ts' ? ': string' : ''}, userId${lang === 'ts' ? ': string' : ''}, durationMs${lang === 'ts' ? ': number' : ''})${lang === 'ts' ? ': Promise<void>' : ''} {
      await redis.set(\`cooldown:\${commandName}:\${userId}\`, '1', 'PX', durationMs);
    },
  };
}
`;
  }

  return files;
}

async function writeDatabaseFiles(targetDir: string, db: DatabasePreset, lang: 'ts' | 'js'): Promise<void> {
  if (db === 'none' || db === 'file') return;
  const files = dbSource(db, lang);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(targetDir, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf-8');
  }

  const config = drizzleConfig(db);
  if (config) {
    await writeFile(join(targetDir, `drizzle.config.${lang === 'ts' ? 'ts' : 'js'}`), config, 'utf-8');
  }
}

function presetSource(preset: ProjectPreset, lang: 'ts' | 'js'): Record<string, string> {
  const ext = lang === 'ts' ? 'ts' : 'js';
  const files: Record<string, string> = {};

  const anyCast = lang === 'ts' ? ' as any' : '';

  if (preset === 'moderation') {
    files[`src/commands/slash/moderation/ban.${ext}`] = `import { PermissionFlagsBits } from 'discord.js';
import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { sendModerationAudit } from '../../../lib/modLog.js';

export default createSlashCommand('ban')
  .setDescription('Ban a member from the server')
  .setCategory('Moderation')
  .addParam('target', ParamType.User, { required: true, description: 'User to ban' })
  .addParam('reason', ParamType.String, { description: 'Reason for the ban' })
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setCooldown(3)
  .setExecute(async (interaction, args) => {
    const target = args.target${anyCast};
    if (!target || !interaction.guild) return;
    await interaction.guild.members.ban(target.id, { reason: String(args.reason ?? 'No reason provided') });
    await sendModerationAudit({
      guild: interaction.guild,
      action: 'Member Banned',
      moderator: interaction.user,
      target,
      reason: String(args.reason ?? 'No reason provided'),
    });
    await interaction.reply({ content: \`Banned \${target.tag}.\`, ephemeral: true });
  });
`;
    files[`src/commands/slash/moderation/warn.${ext}`] = `import { PermissionFlagsBits } from 'discord.js';
import { createSlashCommand } from '../../../builders/index.js';
import { ParamType } from '../../../builders/types.js';
import { sendModerationAudit } from '../../../lib/modLog.js';

export default createSlashCommand('warn')
  .setDescription('Record a moderation warning')
  .setCategory('Moderation')
  .addParam('target', ParamType.User, { required: true, description: 'User to warn' })
  .addParam('reason', ParamType.String, { required: true, description: 'Warning reason' })
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setExecute(async (interaction, args) => {
    if (!interaction.guild || !args.target) return;
    const target = args.target${anyCast};
    await sendModerationAudit({
      guild: interaction.guild,
      action: 'Member Warned',
      moderator: interaction.user,
      target,
      reason: String(args.reason),
    });
    await interaction.reply({ content: \`Warned \${target.toString()}.\`, ephemeral: true });
  });
`;
    files[`src/events/messageDeleteLog.${ext}`] = `import { Events } from 'discord.js';
import { createEvent } from '../builders/index.js';
import { sendLog } from '../lib/modLog.js';

export default createEvent(Events.MessageDelete)
  .setExecute(async (message) => {
    if (!message.guild || message.author?.bot) return;
    await sendLog(message.client, {
      guildId: message.guild.id,
      title: 'Message Deleted',
      description: message.content || 'No text content',
      footer: \`Author: \${message.author?.tag ?? 'unknown'}\`,
    });
  });
`;
  }

  if (preset === 'tickets') {
    files[`src/commands/slash/ticket.${ext}`] = `import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createSlashCommand } from '../../builders/index.js';
import { buildCustomId } from '../../lib/customId.js';

export default createSlashCommand('ticket')
  .setDescription('Open a support ticket prompt')
  .setCategory('Tickets')
  .addExample('/ticket')
  .setExecute(async (interaction) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('open_ticket', {}, { expiresIn: 600, userId: interaction.user.id, guildId: interaction.guildId ?? undefined }))
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: 'Need help? Open a ticket.', components: [row], ephemeral: true });
  });
`;
    files[`src/components/buttons/openTicket.${ext}`] = `import { createButton } from '../../builders/index.js';

export default createButton('open_ticket')
  .setExecute(async (interaction) => {
    await interaction.reply({ content: 'Ticket opened. Customize this handler to create a private channel or thread.', ephemeral: true });
  });
`;
    files[`src/components/buttons/closeTicket.${ext}`] = `import { createButton } from '../../builders/index.js';

export default createButton('close_ticket')
  .setExecute(async (interaction) => {
    await interaction.reply({ content: 'Ticket closed. Add archive/delete behavior here.', ephemeral: true });
  });
`;
    files[`src/components/modals/ticketReason.${ext}`] = `import { createModal } from '../../builders/index.js';
import { FieldStyle } from '../../builders/types.js';

export default createModal('ticket_reason')
  .setTitle('Ticket Details')
  .addField('reason', { label: 'How can we help?', style: FieldStyle.Paragraph, required: true, minLength: 10 })
  .setExecute(async (interaction, fields) => {
    await interaction.reply({ content: \`Ticket reason received: \${fields.reason}\`, ephemeral: true });
  });
`;
  }

  if (preset === 'community') {
    files[`src/commands/slash/server.${ext}`] = `import { createSlashCommand } from '../../builders/index.js';
import { infoEmbed } from '../../lib/embeds.js';

export default createSlashCommand('server')
  .setDescription('Show server information')
  .setCategory('Community')
  .setExecute(async (interaction) => {
    const guild = interaction.guild;
    if (!guild) return;
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: guild.name,
          description: \`Members: \${guild.memberCount}\\nCreated: <t:\${Math.floor(guild.createdTimestamp / 1000)}:R>\`,
        }),
      ],
      ephemeral: true,
    });
  });
`;
    files[`src/events/welcome.${ext}`] = `import { Events } from 'discord.js';
import { createEvent } from '../builders/index.js';
import { sendLog } from '../lib/modLog.js';

export default createEvent(Events.GuildMemberAdd)
  .setExecute(async (member) => {
    await sendLog(member.client, {
      guildId: member.guild.id,
      title: 'Member Joined',
      description: \`\${member.user.tag} joined the server.\`,
    });
  });
`;
    files[`src/events/memberLeave.${ext}`] = `import { Events } from 'discord.js';
import { createEvent } from '../builders/index.js';
import { sendLog } from '../lib/modLog.js';

export default createEvent(Events.GuildMemberRemove)
  .setExecute(async (member) => {
    await sendLog(member.client, {
      guildId: member.guild.id,
      title: 'Member Left',
      description: \`\${member.user.tag} left the server.\`,
    });
  });
`;
  }

  return files;
}

async function writePresetFiles(targetDir: string, preset: ProjectPreset, lang: 'ts' | 'js'): Promise<void> {
  const files = presetSource(preset, lang);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(targetDir, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf-8');
  }
}

export async function generateProject(opts: CreateOptions): Promise<void> {
  const targetDir = resolve(process.cwd(), opts.name);

  // Check if target directory already exists
  try {
    await access(targetDir);
    log.error(`Directory "${opts.name}" already exists. Choose a different name or remove it first.`);
    process.exit(1);
  } catch {
    // Expected — directory doesn't exist, which is correct
  }

  log.info(`Scaffolding ${opts.lang.toUpperCase()} project at ./${opts.name} ...`);

  await mkdir(targetDir, { recursive: true });

  // Copy the template tree
  const templateDir = getTemplateDir(opts.lang);
  await copyDir(templateDir, targetDir);

  // Interpolate __DJSKIT_VAR__ placeholders
  await interpolateDir(targetDir, {
    BOT_TOKEN: opts.token,
    CLIENT_ID: opts.clientId,
    GUILD_ID: opts.guildId,
    PREFIX: opts.prefix,
    PROJECT_NAME: opts.name,
    COOLDOWN_BACKEND: cooldownBackendFor(opts.db),
  });

  await patchPackageJson(targetDir, opts.db);
  await writeDatabaseFiles(targetDir, opts.db, opts.lang);

  const isBare = opts.bare || opts.preset === 'bare';

  if (isBare) {
    const commandsDir = join(targetDir, 'src', 'commands');
    const componentsDir = join(targetDir, 'src', 'components');
    const eventsDir = join(targetDir, 'src', 'events');
    const autocompleteDir = join(targetDir, 'src', 'autocomplete');
    const contextsDir = join(targetDir, 'src', 'contexts');
    await rm(commandsDir, { recursive: true, force: true });
    await rm(componentsDir, { recursive: true, force: true });
    await rm(eventsDir, { recursive: true, force: true });
    await rm(autocompleteDir, { recursive: true, force: true });
    await rm(contextsDir, { recursive: true, force: true });
    await mkdir(join(commandsDir, 'slash'), { recursive: true });
    await mkdir(join(commandsDir, 'prefix'), { recursive: true });
    await mkdir(join(componentsDir, 'buttons'), { recursive: true });
    await mkdir(join(componentsDir, 'modals'), { recursive: true });
    await mkdir(join(componentsDir, 'selects'), { recursive: true });
    await mkdir(eventsDir, { recursive: true });
    await mkdir(autocompleteDir, { recursive: true });
    await mkdir(join(contextsDir, 'user'), { recursive: true });
    await mkdir(join(contextsDir, 'message'), { recursive: true });
  } else {
    await writePresetFiles(targetDir, opts.preset, opts.lang);
  }

  // Write .env with actual secrets (template has .env.example without values)
  const envContent = [
    `DISCORD_TOKEN=${opts.token}`,
    `DISCORD_CLIENT_ID=${opts.clientId}`,
    `DISCORD_GUILD_ID=${opts.guildId}`,
    'DISCORD_GUILD_IDS=',
    'BOT_OWNER_IDS=',
    'DJSKIT_COMPONENT_SECRET=',
    'LOG_CHANNEL_ID=',
    'MOD_AUDIT_CHANNEL_ID=',
    ...dbEnvLines(opts.db),
    '',
  ].join('\n');
  await writeFile(join(targetDir, '.env'), envContent, 'utf-8');

  // Optional ER:LC server integration (via --erlc or the erlc preset)
  if (opts.erlc || opts.preset === 'erlc') {
    await generateErlcModule(targetDir, {
      lang: opts.lang,
      options: opts.erlcOptions ?? defaultErlcOptions(),
    });
  }

  log.success('Project files created!');

  if (opts.install) {
    log.info('Installing dependencies (this may take a moment)...');
    try {
      execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
      log.success('Dependencies installed!');
    } catch {
      log.warn('npm install failed. Run it manually in your project directory.');
    }
  }

  // Print next steps
  console.log();
  console.log(pc.bold('Next steps:'));
  log.step(`cd ${opts.name}`);
  if (!opts.install) log.step('npm install');
  log.step('npm run dev');
  console.log();
  console.log(pc.dim('  Slash commands are registered to your guild automatically on startup.'));
  console.log(pc.dim(`  Prefix commands respond to ${opts.prefix}<command>.`));
  console.log();
}
