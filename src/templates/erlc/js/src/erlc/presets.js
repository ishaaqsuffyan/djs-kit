import { ERLCEvents, } from '@erlcjs/core';
import { autoAnnouncement, autoCommand, autoHint, banCommand, banKickRejoin, banLiveries, banVehicles, CommandPunishments, LiveryPunishments, RDM, VehiclePunishments, welcomePlayer, } from '@erlcjs/presets';
import { erlcPresets } from './presets.config.js';
function toArray(value) {
    if (Array.isArray(value))
        return value.map(String);
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
}
function toAllowlist(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((entry) => typeof entry === 'number' || typeof entry === 'string');
}
/**
 * Register every enabled preset from src/erlc/presets.config.js.
 * Edit that file (or rerun `djs-kit add erlc`) to enable/disable presets.
 */
export function registerPresets(client) {
    const p = erlcPresets;
    if (p.welcomePlayer.enabled) {
        client.on(ERLCEvents.playerJoin, welcomePlayer(String(p.welcomePlayer.options.message ?? 'Welcome to the server!')));
    }
    if (p.banKickRejoin.enabled) {
        client.on(ERLCEvents.playerJoin, banKickRejoin(Number(p.banKickRejoin.options.timespan ?? 1800)));
    }
    if (p.banCommand.enabled) {
        const commands = toArray(p.banCommand.options.commands);
        const action = String(p.banCommand.options.action ?? 'removePermissions') === 'kick'
            ? CommandPunishments.kick()
            : String(p.banCommand.options.action) === 'ban'
                ? CommandPunishments.ban()
                : CommandPunishments.removePermissions();
        client.on(ERLCEvents.command, banCommand(commands, action, Boolean(p.banCommand.options.startsWith), toAllowlist(p.banCommand.options.allowlist)));
    }
    if (p.banVehicles.enabled) {
        client.on(ERLCEvents.vehicleAdd, banVehicles(toArray(p.banVehicles.options.vehicles), VehiclePunishments.warnThenKick(Number(p.banVehicles.options.delay ?? 15)), toAllowlist(p.banVehicles.options.allowlist)));
    }
    if (p.banLiveries.enabled) {
        client.on(ERLCEvents.vehicleAdd, banLiveries(toArray(p.banLiveries.options.liveries), LiveryPunishments.warnThenKick(Number(p.banLiveries.options.delay ?? 15)), toAllowlist(p.banLiveries.options.allowlist)));
    }
    if (p.rdm.enabled) {
        const action = String(p.rdm.options.action ?? 'kick') === 'ban'
            ? (log) => log.killer.ban()
            : (log) => log.killer.kick();
        client.on(ERLCEvents.kill, RDM(action, toAllowlist(p.rdm.options.allowlist), Number(p.rdm.options.minKills ?? 4), Number(p.rdm.options.timespan ?? 30)));
    }
    if (p.autoHint.enabled) {
        autoHint(client, String(p.autoHint.options.message ?? ''), Number(p.autoHint.options.interval ?? 120000));
    }
    if (p.autoAnnouncement.enabled) {
        autoAnnouncement(client, String(p.autoAnnouncement.options.message ?? ''), Number(p.autoAnnouncement.options.interval ?? 120000));
    }
    if (p.autoCommand.enabled) {
        autoCommand(client, String(p.autoCommand.options.command ?? ''), Number(p.autoCommand.options.interval ?? 120000));
    }
}
