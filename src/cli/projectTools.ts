import { access, readFile } from 'fs/promises';
import { join } from 'path';
import fg from 'fast-glob';
import { execFileSync } from 'child_process';
import { findProjectRoot } from '../utils/paths.js';
import { log } from '../utils/logger.js';

export interface ToolIssue {
  level: 'error' | 'warn' | 'info';
  message: string;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPackage(projectRoot: string): Promise<PackageJson> {
  return JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8')) as PackageJson;
}

async function readEnv(projectRoot: string): Promise<Record<string, string>> {
  const envPath = join(projectRoot, '.env');
  if (!await pathExists(envPath)) return {};
  const env: Record<string, string> = {};
  const content = await readFile(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

export async function getRequiredEnv(projectRoot: string): Promise<string[]> {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
  const configPath = join(projectRoot, 'src', 'config.ts');
  const jsConfigPath = join(projectRoot, 'src', 'config.js');
  const config = await pathExists(configPath)
    ? await readFile(configPath, 'utf-8')
    : await pathExists(jsConfigPath)
      ? await readFile(jsConfigPath, 'utf-8')
      : '';

  if (!/commandRegistration:\s*['"`]global['"`]/.test(config)) required.push('DISCORD_GUILD_ID');
  if (config.includes('DATABASE_URL')) required.push('DATABASE_URL');

  const erlcConfigPath = join(projectRoot, 'src', 'erlc', 'config.ts');
  const erlcJsConfigPath = join(projectRoot, 'src', 'erlc', 'config.js');
  if (await pathExists(erlcConfigPath) || await pathExists(erlcJsConfigPath)) required.push('ERLC_SERVER_KEY');

  return required;
}

function collectRegex(content: string, pattern: RegExp): string[] {
  return [...content.matchAll(pattern)].map(match => match[1]);
}

async function collectFileValues(projectRoot: string, glob: string, patterns: RegExp[]): Promise<Map<string, string[]>> {
  const files = await fg(glob, { cwd: projectRoot.replace(/\\/g, '/'), absolute: true });
  const values = new Map<string, string[]>();

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const found = patterns.flatMap(pattern => collectRegex(content, pattern));
    values.set(file, found);
  }

  return values;
}

function findDuplicates(values: Map<string, string[]>): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  for (const [file, fileValues] of values) {
    for (const value of fileValues) {
      seen.set(value, [...(seen.get(value) ?? []), file]);
    }
  }

  return new Map([...seen.entries()].filter(([, files]) => files.length > 1));
}

export async function validateProject(projectRoot: string): Promise<ToolIssue[]> {
  const issues: ToolIssue[] = [];

  const slashNames = await collectFileValues(projectRoot, 'src/commands/slash/**/*.{ts,js}', [/createSlashCommand\(['"`]([^'"`]+)['"`]\)/g]);
  const prefixNames = await collectFileValues(projectRoot, 'src/commands/prefix/**/*.{ts,js}', [/createPrefixCommand\(['"`]([^'"`]+)['"`]\)/g]);
  const customIds = await collectFileValues(projectRoot, 'src/components/**/*.{ts,js}', [
    /createButton\(['"`]([^'"`]+)['"`]\)/g,
    /createModal\(['"`]([^'"`]+)['"`]\)/g,
    /createSelect\(['"`]([^'"`]+)['"`]/g,
  ]);
  const contexts = await collectFileValues(projectRoot, 'src/contexts/**/*.{ts,js}', [
    /createUserContextMenu\(['"`]([^'"`]+)['"`]\)/g,
    /createMessageContextMenu\(['"`]([^'"`]+)['"`]\)/g,
  ]);

  for (const [name, files] of findDuplicates(slashNames)) {
    issues.push({ level: 'error', message: `Duplicate slash command "${name}" in ${files.length} files.` });
  }
  for (const [name, files] of findDuplicates(prefixNames)) {
    issues.push({ level: 'error', message: `Duplicate prefix command "${name}" in ${files.length} files.` });
  }
  for (const [name, files] of findDuplicates(customIds)) {
    issues.push({ level: 'error', message: `Duplicate component custom ID "${name}" in ${files.length} files.` });
  }
  for (const [name, files] of findDuplicates(contexts)) {
    issues.push({ level: 'error', message: `Duplicate context menu "${name}" in ${files.length} files.` });
  }

  for (const [file, names] of slashNames) {
    for (const name of names) {
      if (name !== name.toLowerCase()) {
        issues.push({ level: 'warn', message: `Slash command "${name}" in ${file} should be lowercase.` });
      }
    }
  }

  const env = await readEnv(projectRoot);
  for (const key of await getRequiredEnv(projectRoot)) {
    if (key === 'DISCORD_GUILD_ID' && (env.DISCORD_GUILD_ID || env.DISCORD_GUILD_IDS)) continue;
    if (!env[key]) issues.push({ level: 'warn', message: `.env is missing ${key}.` });
  }

  return issues;
}

export async function doctorProject(projectRoot: string): Promise<ToolIssue[]> {
  const issues = await validateProject(projectRoot);
  const pkg = await readPackage(projectRoot);
  const nodeMajor = Number(process.versions.node.split('.')[0]);

  if (nodeMajor < 20) {
    issues.push({ level: 'error', message: `Node ${process.versions.node} is too old. Use Node 20.12.0 or newer.` });
  }

  for (const dir of ['src/commands', 'src/components', 'src/events', 'src/lib']) {
    if (!await pathExists(join(projectRoot, dir))) {
      issues.push({ level: 'warn', message: `Missing expected folder: ${dir}.` });
    }
  }

  if (!pkg.scripts?.dev) issues.push({ level: 'warn', message: 'package.json is missing a dev script.' });
  if (!pkg.scripts?.['sync:commands']) issues.push({ level: 'info', message: 'package.json has no sync:commands script.' });

  const erlcDirExists = await pathExists(join(projectRoot, 'src', 'erlc'));
  if (erlcDirExists && !pkg.dependencies?.['@erlcjs/core']) {
    issues.push({ level: 'error', message: 'src/erlc exists but @erlcjs/core is not installed. Run: npm install @erlcjs/core @erlcjs/presets @erlcjs/map' });
  }

  return issues;
}

function printIssues(issues: ToolIssue[]): void {
  if (issues.length === 0) {
    log.success('No issues found.');
    return;
  }

  for (const issue of issues) {
    if (issue.level === 'error') log.error(issue.message);
    else if (issue.level === 'warn') log.warn(issue.message);
    else log.info(issue.message);
  }
}

export async function requireProjectRoot(): Promise<string> {
  const root = await findProjectRoot();
  if (!root) {
    log.error('Not inside a djs-kit project.');
    process.exit(1);
  }
  return root;
}

export async function handleDoctor(): Promise<void> {
  const root = await requireProjectRoot();
  printIssues(await doctorProject(root));
}

export async function handleValidate(): Promise<void> {
  const root = await requireProjectRoot();
  const issues = await validateProject(root);
  printIssues(issues);
  if (issues.some(issue => issue.level === 'error')) process.exit(1);
}

export async function handleEnv(): Promise<void> {
  const root = await requireProjectRoot();
  const required = await getRequiredEnv(root);
  console.log(required.join('\n'));
}

export async function handleSyncCommands(): Promise<void> {
  const root = await requireProjectRoot();
  const pkg = await readPackage(root);
  if (!pkg.scripts?.['sync:commands']) {
    log.error('This project does not have a sync:commands script. Regenerate or upgrade the template first.');
    process.exit(1);
  }
  execFileSync('npm', ['run', 'sync:commands'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
}

export async function handleUpgrade(): Promise<void> {
  const root = await requireProjectRoot();
  const pkg = await readPackage(root);
  log.info(`Project detected at ${root}`);
  log.info(`Package scripts: ${Object.keys(pkg.scripts ?? {}).sort().join(', ') || 'none'}`);
  log.info('Automatic migrations are not enabled yet. Review the latest template changes and apply them intentionally.');
}
