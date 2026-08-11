import { z } from 'zod';
const erlcEnvSchema = z.object({
    ERLC_MODE: z.enum(['polling', 'webhook']).default('polling'),
    ERLC_POLLING_RATE_MS: z.string().optional(),
    ERLC_WEBHOOK_PORT: z.string().optional(),
    ERLC_WEBHOOK_PATH: z.string().optional(),
    ERLC_WEBHOOK_SECRET: z.string().optional(),
});
const erlcEnvResult = erlcEnvSchema.safeParse(process.env);
const serverKey = (process.env.ERLC_SERVER_KEY ?? '').trim();
if (serverKey && !erlcEnvResult.success) {
    console.error('[ERLC Config] Invalid ER:LC environment configuration:');
    for (const issue of erlcEnvResult.error.issues) {
        console.error(`  - ${issue.message}`);
    }
    process.exit(1);
}
function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
export const erlcConfig = {
    enabled: serverKey.length > 0,
    serverKey,
    globalKey: (process.env.ERLC_GLOBAL_KEY ?? '').trim() || undefined,
    mode: erlcEnvResult.success ? erlcEnvResult.data.ERLC_MODE : 'polling',
    pollingRateMs: toNumber(erlcEnvResult.success ? erlcEnvResult.data.ERLC_POLLING_RATE_MS : undefined, 5000),
    webhook: {
        enabled: erlcEnvResult.success ? erlcEnvResult.data.ERLC_MODE === 'webhook' : false,
        port: toNumber(erlcEnvResult.success ? erlcEnvResult.data.ERLC_WEBHOOK_PORT : undefined, 3000),
        path: (erlcEnvResult.success ? erlcEnvResult.data.ERLC_WEBHOOK_PATH : undefined) || '/webhook',
        secret: (erlcEnvResult.success ? erlcEnvResult.data.ERLC_WEBHOOK_SECRET : undefined) || undefined,
    },
    logChannelId: (process.env.ERLC_LOG_CHANNEL_ID ?? '').trim() || undefined,
};
