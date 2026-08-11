import { ERLCEvents } from '@erlcjs/core';
import { erlcConfig } from './config.js';
import { createErlcClient } from './client.js';
import { registerPresets } from './presets.js';
import { registerErlcNotifications } from './bridge.js';
import { logger } from '../lib/logger.js';
export { getErlcClient } from './client.js';
/**
 * Boot the ER:LC integration. Call this from src/index.js after the Discord
 * client is constructed and before (or after) client.login(). No-op unless
 * ERLC_SERVER_KEY is set in your .env.
 */
export async function initErlc(discord) {
    if (!erlcConfig.enabled) {
        logger.warn('ER:LC integration skipped — set ERLC_SERVER_KEY to enable it.');
        return false;
    }
    const erlc = createErlcClient();
    registerPresets(erlc);
    registerErlcNotifications(erlc, discord);
    erlc.on(ERLCEvents.serverCreate, (server) => {
        logger.success(`ER:LC connected to "${server.name}" (server #${erlc.serverId}) via ${erlcConfig.mode}.`);
    });
    logger.info(`ER:LC integration starting in ${erlcConfig.mode} mode...`);
    return true;
}
