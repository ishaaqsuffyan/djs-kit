export interface ErlcPresetRuntimeOptions {
  enabled: boolean;
  options: Record<string, unknown>;
}

export const erlcPresets: Record<string, ErlcPresetRuntimeOptions> = {
  welcomePlayer: {
    enabled: false,
    options: {
      message: 'Welcome to the server!',
    },
  },
  banKickRejoin: {
    enabled: false,
    options: {
      timespan: 1800,
    },
  },
  banCommand: {
    enabled: false,
    options: {
      commands: [':admin'],
      action: 'removePermissions',
      startsWith: true,
      allowlist: [],
    },
  },
  banVehicles: {
    enabled: false,
    options: {
      vehicles: [],
      delay: 15,
      allowlist: [],
    },
  },
  banLiveries: {
    enabled: false,
    options: {
      liveries: [],
      delay: 15,
      allowlist: [],
    },
  },
  rdm: {
    enabled: false,
    options: {
      action: 'kick',
      minKills: 4,
      timespan: 30,
      allowlist: [],
    },
  },
  autoHint: {
    enabled: false,
    options: {
      message: 'Welcome to the server!',
      interval: 120000,
    },
  },
  autoAnnouncement: {
    enabled: false,
    options: {
      message: 'Welcome to the server!',
      interval: 120000,
    },
  },
  autoCommand: {
    enabled: false,
    options: {
      command: ':time',
      interval: 120000,
    },
  },
};
