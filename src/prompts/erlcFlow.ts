import {
  cancel,
  confirm,
  group,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts';
import pc from 'picocolors';
import { log } from '../utils/logger.js';
import {
  erlcPresetMeta,
  erlcPresetOptionsSpec,
  erlcVehicleExamples,
  loadVehiclesFromProject,
} from '../utils/erlc.js';
import type { ErlcOptions, ErlcPresetId, ErlcPresetSelection } from '../types.js';

function validatePositiveInt(value: string | undefined, min: number): string | undefined {
  const parsed = Number(value);
  if (!value || value.trim() === '') return 'Required';
  if (!Number.isInteger(parsed) || parsed < min) return `Must be an integer >= ${min}`;
  return undefined;
}

function validateCommaList(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') return 'Enter at least one value, separated by commas.';
  return undefined;
}

function parseCommaList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

async function promptVehicleNames(projectRoot?: string, allowEmpty = false): Promise<string[] | symbol> {
  const vehicles = loadVehiclesFromProject(projectRoot);
  const fallback = erlcVehicleExamples.slice(0, 3).join(', ');
  const placeholder = vehicles && vehicles.length > 0
    ? `e.g. ${vehicles.slice(0, 3).join(', ')}`
    : `e.g. ${fallback}`;

  const raw = await text({
    message: 'Vehicle names to ban (comma-separated)?',
    placeholder,
    validate: (v) => {
      if (allowEmpty && (!v || v.trim() === '')) return undefined;
      return validateCommaList(v);
    },
  });
  if (isCancel(raw)) return raw;
  const value = raw as string;
  if (allowEmpty && value.trim() === '') return [];
  return parseCommaList(value);
}

type PromptResult = Record<string, unknown> | symbol;

async function promptPresetArgs(id: ErlcPresetId, projectRoot?: string): Promise<PromptResult> {
  const spec = erlcPresetOptionsSpec[id];
  const values: Record<string, unknown> = {};

  const askText = async (
    key: string,
    message: string,
    initial?: string,
    placeholder?: string,
    allowEmpty = false
  ): Promise<symbol | undefined> => {
    const result = await text({
      message,
      initialValue: initial,
      placeholder,
      validate: (v) => {
        if (allowEmpty && (!v || v.trim() === '')) return undefined;
        if (spec[key].type === 'number') return validatePositiveInt(v, 1);
        return v && v.trim().length > 0 ? undefined : 'Required';
      },
    });
    if (isCancel(result)) return result;
    const value = result as string;
    if (spec[key].type === 'number') values[key] = Number(value);
    else values[key] = value;
    return undefined;
  };

  const askSelect = async (key: string, message: string, options: { value: string; label: string }[]): Promise<symbol | undefined> => {
    const result = await select({ message, options });
    if (isCancel(result)) return result;
    values[key] = result as string;
    return undefined;
  };

  if (id === 'welcomePlayer') {
    const err = await askText('message', 'Welcome message?', 'Welcome to the server!');
    if (err) return err;
  }

  if (id === 'banKickRejoin') {
    const err = await askText('timespan', 'Rejoin window (seconds)?', '1800');
    if (err) return err;
  }

  if (id === 'banCommand') {
    const err = await askText('commands', 'Commands to ban (comma-separated, e.g. :admin, :mod)?', ':admin');
    if (err) return err;
    const errAction = await askSelect('action', 'Punishment when the command is used?', [
      { value: 'removePermissions', label: 'Remove permissions' },
      { value: 'kick', label: 'Remove permissions + kick' },
      { value: 'ban', label: 'Remove permissions + ban' },
    ]);
    if (errAction) return errAction;
    const startsWith = await confirm({ message: 'Match commands by prefix (e.g. ":admin all")?', initialValue: true });
    if (isCancel(startsWith)) return startsWith;
    values.startsWith = startsWith as boolean;
    const errAllow = await askText('allowlist', 'Allowlist (comma-separated user IDs or mod/admin/owner)?', undefined, 'e.g. 123456789, owner', true);
    if (errAllow) return errAllow;
  }

  if (id === 'banVehicles') {
    const raw = await promptVehicleNames(projectRoot);
    if (isCancel(raw)) return raw;
    values.vehicles = raw;
    const err = await askText('delay', 'Kick delay (seconds) after the warning?', '15');
    if (err) return err;
    const errAllow = await askText('allowlist', 'Allowlist (comma-separated user IDs or mod/admin/owner)?', undefined, 'e.g. 123456789, owner', true);
    if (errAllow) return errAllow;
  }

  if (id === 'banLiveries') {
    const err = await askText('liveries', 'Liveries to ban (comma-separated)?', 'Staff');
    if (err) return err;
    const errDelay = await askText('delay', 'Kick delay (seconds) after the warning?', '15');
    if (errDelay) return errDelay;
    const errAllow = await askText('allowlist', 'Allowlist (comma-separated user IDs or mod/admin/owner)?', undefined, 'e.g. 123456789, owner', true);
    if (errAllow) return errAllow;
  }

  if (id === 'rdm') {
    const errAction = await askSelect('action', 'RDM punishment?', [
      { value: 'kick', label: 'Kick' },
      { value: 'ban', label: 'Ban' },
    ]);
    if (errAction) return errAction;
    const errKills = await askText('minKills', 'Minimum kills in the window?', '4');
    if (errKills) return errKills;
    const errSpan = await askText('timespan', 'Window (seconds)?', '30');
    if (errSpan) return errSpan;
    const errAllow = await askText('allowlist', 'Allowlist (comma-separated user IDs or mod/admin/owner)?', undefined, 'e.g. 123456789, owner', true);
    if (errAllow) return errAllow;
  }

  if (id === 'autoHint' || id === 'autoAnnouncement') {
    const err = await askText('message', 'Message to repeat in-game?', 'Welcome to the server!');
    if (err) return err;
    const errInterval = await askText('interval', 'Interval (milliseconds)?', '120000');
    if (errInterval) return errInterval;
  }

  if (id === 'autoCommand') {
    const err = await askText('command', 'Command to run in-game (e.g. :time)?', ':time');
    if (err) return err;
    const errInterval = await askText('interval', 'Interval (milliseconds)?', '120000');
    if (errInterval) return errInterval;
  }

  return values;
}

export async function erlcFlow(context: { projectRoot?: string } = {}): Promise<ErlcOptions> {
  const answers = await group(
    {
      mode: () =>
        select({
          message: 'How should the bot receive ER:LC data?',
          options: [
            { value: 'polling', label: 'Polling', hint: 'Poll the ER:LC API on an interval — no open ports needed' },
            { value: 'webhook', label: 'Webhook', hint: 'Live events via webhook server — requires a reachable port' },
          ],
        }),

      pollingRateMs: ({ results }) =>
        results.mode === 'polling'
          ? text({
              message: 'Polling interval (milliseconds)? Minimum is 500ms.',
              initialValue: '5000',
              validate: (v) => validatePositiveInt(v, 500),
            })
          : undefined,

      webhookPort: ({ results }) =>
        results.mode === 'webhook'
          ? text({
              message: 'Webhook server port?',
              initialValue: '3000',
              validate: (v) => validatePositiveInt(v, 1),
            })
          : undefined,

      webhookPath: ({ results }) =>
        results.mode === 'webhook'
          ? text({
              message: 'Webhook URL path?',
              initialValue: '/webhook',
              validate: (v) => (v && v.trim().startsWith('/') ? undefined : 'Must start with a "/"'),
            })
          : undefined,

      webhookSecret: ({ results }) =>
        results.mode === 'webhook'
          ? text({
              message: 'Webhook secret (optional)?',
              placeholder: 'leave empty for none',
            })
          : undefined,

      logChannelId: () =>
        text({
          message: 'Discord channel ID for ER:LC events (optional)?',
          placeholder: 'leave empty for none',
          validate: (v) => (!v || /^\d{17,19}$/.test(v.trim()) ? undefined : 'Must be a Discord channel ID (17-19 digits)'),
        }),

      presets: () =>
        multiselect({
          message: 'Which ER:LC automation presets?',
          options: erlcPresetMeta.map((preset) => ({
            value: preset.id,
            label: preset.label,
            hint: preset.hint,
          })),
          required: false,
        }),
    },
    {
      onCancel: () => {
        cancel('ER:LC setup cancelled.');
        process.exit(0);
      },
    }
  );

  const selectedIds = (answers.presets ?? []) as ErlcPresetId[];
  const presets: ErlcPresetSelection[] = [];

  if (selectedIds.length > 0) {
    console.log();
    log.info(pc.dim('Configure each selected preset:'));
    for (const id of selectedIds) {
      const meta = erlcPresetMeta.find((preset) => preset.id === id);
      log.step(`${meta?.label ?? id}`);
      const args = await promptPresetArgs(id, context.projectRoot);
      if (isCancel(args)) {
        cancel('ER:LC setup cancelled.');
        process.exit(0);
      }
      presets.push({ id, enabled: true, options: args as Record<string, unknown> });
    }
    console.log();
  }

  return {
    mode: answers.mode as 'polling' | 'webhook',
    pollingRateMs: answers.pollingRateMs !== undefined ? Number(answers.pollingRateMs) : 5000,
    webhook: answers.mode === 'webhook'
      ? {
          port: Number(answers.webhookPort),
          path: answers.webhookPath as string,
          secret: (answers.webhookSecret as string | undefined)?.trim() || undefined,
        }
      : undefined,
    logChannelId: (answers.logChannelId as string | undefined)?.trim() || undefined,
    presets,
  };
}
