export interface CreateOptions {
  name: string;
  lang: 'ts' | 'js';
  token: string;
  clientId: string;
  guildId: string;
  db: DatabasePreset;
  preset: ProjectPreset;
  prefix: string;
  bare?: boolean;
  install: boolean;
  erlc?: boolean;
  erlcOptions?: ErlcOptions;
}

export type DatabasePreset = 'none' | 'file' | 'sqlite' | 'postgres' | 'mysql' | 'mongo' | 'redis';
export type ProjectPreset = 'bare' | 'utility' | 'moderation' | 'tickets' | 'community' | 'erlc';

export type ErlcPresetId =
  | 'welcomePlayer'
  | 'banKickRejoin'
  | 'banCommand'
  | 'banVehicles'
  | 'banLiveries'
  | 'rdm'
  | 'autoHint'
  | 'autoAnnouncement'
  | 'autoCommand';

export interface ErlcPresetSelection {
  id: ErlcPresetId;
  enabled: boolean;
  options: Record<string, unknown>;
}

export interface ErlcOptions {
  mode: 'polling' | 'webhook';
  pollingRateMs: number;
  webhook?: {
    port: number;
    path: string;
    secret?: string;
  };
  logChannelId?: string;
  presets: ErlcPresetSelection[];
}
export type ComponentType = 'command' | 'button' | 'modal' | 'select' | 'event' | 'autocomplete' | 'context' | 'erlc';
export type CommandSubtype = 'slash' | 'prefix';
export type ContextSubtype = 'user' | 'message';
export type Lang = 'ts' | 'js';
