import { Client } from '@erlcjs/core';
import { erlcConfig } from './config.js';
let erlcClient = null;
/**
 * Create (once) the ER:LC API client. Webhook mode starts a local HTTP server
 * that the ER:LC webhook will push events to; polling mode pulls the API on an
 * interval. Either way `registerPresets` and the Discord bridge are wired up
 * by src/erlc/index.js.
 */
export function createErlcClient() {
    erlcClient = new Client({
        serverKey: erlcConfig.serverKey,
        globalKey: erlcConfig.globalKey,
        ...(erlcConfig.webhook.enabled
            ? {
                webhook: {
                    enabled: true,
                    port: erlcConfig.webhook.port,
                    path: erlcConfig.webhook.path,
                    secret: erlcConfig.webhook.secret,
                },
                polling: { enabled: false },
            }
            : {
                polling: {
                    enabled: true,
                    pollingRateMs: erlcConfig.pollingRateMs,
                },
            }),
    });
    return erlcClient;
}
/** Access the live ER:LC client from commands and components. */
export function getErlcClient() {
    return erlcClient;
}
