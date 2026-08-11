import { createRequire } from 'node:module';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { ErlcOptions, ErlcPresetId, ErlcPresetSelection } from '../types.js';

export const erlcDependencies = {
  '@erlcjs/core': '^1.4.1',
  '@erlcjs/presets': '^1.0.0',
  '@erlcjs/map': '^1.0.0',
} as const;

export interface ErlcPresetMeta {
  id: ErlcPresetId;
  label: string;
  hint: string;
}

export const erlcPresetMeta: ErlcPresetMeta[] = [
  { id: 'welcomePlayer', label: 'Welcome player', hint: 'Message new players when they join the server' },
  { id: 'banKickRejoin', label: 'Ban kick-rejoin', hint: 'Ban players who rejoin within a set window after a kick' },
  { id: 'banCommand', label: 'Ban in-game command', hint: 'Punish specific in-game commands (e.g. :admin)' },
  { id: 'banVehicles', label: 'Ban vehicles', hint: 'Restrict specific vehicles and warn/kick offenders' },
  { id: 'banLiveries', label: 'Ban liveries', hint: 'Restrict specific vehicle liveries' },
  { id: 'rdm', label: 'RDM detection', hint: 'Kick or ban players who reach a kill threshold' },
  { id: 'autoHint', label: 'Auto hint', hint: 'Send an in-game hint on an interval' },
  { id: 'autoAnnouncement', label: 'Auto announcement', hint: 'Send an in-game announcement on an interval' },
  { id: 'autoCommand', label: 'Auto command', hint: 'Run an in-game command on an interval' },
];

export function erlcPresetById(id: ErlcPresetId): ErlcPresetMeta {
  return erlcPresetMeta.find((preset) => preset.id === id) ?? erlcPresetMeta[0];
}

export const erlcEnvLines = [
  'ERLC_SERVER_KEY=',
  'ERLC_GLOBAL_KEY=',
  'ERLC_MODE=polling',
  'ERLC_POLLING_RATE_MS=5000',
  'ERLC_WEBHOOK_PORT=3000',
  'ERLC_WEBHOOK_PATH=/webhook',
  'ERLC_WEBHOOK_SECRET=',
  'ERLC_LOG_CHANNEL_ID=',
  '',
];

/** Resolve a Roblox user ID to its numeric value, or null when not numeric. */
export function parseUserId(value: string): number | null {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Parse an allowlist string into plain values (numeric user IDs or ERLC
 * permission strings such as "Server Moderator").
 */
export function parseAllowlist(value: string | undefined): (number | string)[] {
  if (!value) return [];
  const normalized = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.map((entry) => {
    const userId = parseUserId(entry);
    if (userId !== null) return userId;
    const lower = entry.toLowerCase().replace(/\s+/g, '');
    if (lower === 'mod' || lower === 'servermoderator') return 'Server Moderator';
    if (lower === 'admin' || lower === 'serveradministrator') return 'Server Administrator';
    if (lower === 'owner' || lower === 'serverowner') return 'Server Owner';
    return entry;
  });
}

export interface ErlcPresetOptionsSpec {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    default: string | number | boolean;
  };
}

export const erlcPresetOptionsSpec: Record<ErlcPresetId, ErlcPresetOptionsSpec> = {
  welcomePlayer: {
    message: { type: 'string', default: 'Welcome to the server!' },
  },
  banKickRejoin: {
    timespan: { type: 'number', default: 1800 },
  },
  banCommand: {
    commands: { type: 'string', default: ':admin' },
    action: { type: 'string', default: 'removePermissions' },
    startsWith: { type: 'boolean', default: true },
    allowlist: { type: 'string', default: '' },
  },
  banVehicles: {
    vehicles: { type: 'string', default: '' },
    delay: { type: 'number', default: 15 },
    allowlist: { type: 'string', default: '' },
  },
  banLiveries: {
    liveries: { type: 'string', default: '' },
    delay: { type: 'number', default: 15 },
    allowlist: { type: 'string', default: '' },
  },
  rdm: {
    action: { type: 'string', default: 'kick' },
    minKills: { type: 'number', default: 4 },
    timespan: { type: 'number', default: 30 },
    allowlist: { type: 'string', default: '' },
  },
  autoHint: {
    message: { type: 'string', default: 'Welcome to the server!' },
    interval: { type: 'number', default: 120000 },
  },
  autoAnnouncement: {
    message: { type: 'string', default: 'Welcome to the server!' },
    interval: { type: 'number', default: 120000 },
  },
  autoCommand: {
    command: { type: 'string', default: ':time' },
    interval: { type: 'number', default: 120000 },
  },
};

export function defaultErlcPresets(): ErlcPresetSelection[] {
  return erlcPresetMeta.map(({ id }) => ({
    id,
    enabled: false,
    options: Object.fromEntries(
      Object.entries(erlcPresetOptionsSpec[id]).map(([key, spec]) => [key, spec.default])
    ),
  }));
}

export function defaultErlcOptions(): ErlcOptions {
  return {
    mode: 'polling',
    pollingRateMs: 5000,
    presets: defaultErlcPresets(),
  };
}

/**
 * Try to load the live vehicle name list from a project's installed @erlcjs/core.
 * Returns null when the package is not installed yet (e.g. during project create).
 */
export function loadVehiclesFromProject(projectRoot?: string): string[] | null {
  if (!projectRoot) return null;
  try {
    const pkgPath = join(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const require = createRequire(pkgPath);
    const core = require('@erlcjs/core');
    const vehicles = core.Vehicles;
    if (vehicles && typeof vehicles === 'object') {
      const values = Object.values(vehicles).filter((v): v is string => typeof v === 'string');
      if (values.length > 0) return [...new Set(values)];
    }
    return null;
  } catch {
    return null;
  }
}

/** Curated fallback sample so the create flow is usable before install. */
export const erlcVehicleExamples = [
  'Bugatti Veyron',
  'Chevlon Corbeta C2 1967',
  'Falcon Rampage 2021',
  'Elysion P100 2022',
  'Vellfire Riptide 2020',
];
