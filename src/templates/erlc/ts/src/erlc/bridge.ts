import type { Client as DiscordClient, GuildTextBasedChannel } from 'discord.js';
import { ERLCEvents, type Client as ErlcClient, type EmergencyCall, type KillLog, type ModCall } from '@erlcjs/core';
import { config } from '../config.js';
import { erlcConfig } from './config.js';
import { warningEmbed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

async function resolveErlcChannel(discord: DiscordClient): Promise<GuildTextBasedChannel | null> {
  if (!erlcConfig.logChannelId) return null;
  const guild = discord.guilds.cache.get(config.guildId)
    ?? await discord.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) return null;
  const channel = await guild.channels.fetch(erlcConfig.logChannelId).catch(() => null);
  return channel && channel.isTextBased() ? channel : null;
}

async function sendErlcEmbed(
  discord: DiscordClient,
  title: string,
  description: string,
  footer?: string,
): Promise<void> {
  const channel = await resolveErlcChannel(discord);
  if (!channel) return;
  await channel.send({
    embeds: [warningEmbed({ title, description, footer })],
  }).catch(error => {
    logger.error('Failed to send ER:LC event embed.', error);
  });
}

/**
 * Forward interesting ER:LC events to the configured Discord log channel.
 * Set ERLC_LOG_CHANNEL_ID in your .env to enable Discord notifications.
 */
export function registerErlcNotifications(erlc: ErlcClient, discord: DiscordClient): void {
  erlc.on(ERLCEvents.modCall, (call: ModCall) => {
    void sendErlcEmbed(
      discord,
      'Moderation Call',
      `${call.callerUsername} requested moderator assistance.`,
      `Caller ID: ${call.callerId}`,
    );
  });

  erlc.on(ERLCEvents.modCallAnswered, (call: ModCall) => {
    void sendErlcEmbed(
      discord,
      'Moderation Call Answered',
      `${call.callerUsername}'s call was answered by ${call.moderatorUsername ?? 'a moderator'}.`,
    );
  });

  erlc.on(ERLCEvents.emergencyCallAdd, (call: EmergencyCall) => {
    void sendErlcEmbed(
      discord,
      `Emergency Call #${call.callNumber}`,
      `${call.description} — ${call.positionDescriptor}`,
      `Caller ID: ${call.callerId}`,
    );
  });

  erlc.on(ERLCEvents.kill, (kill: KillLog) => {
    void sendErlcEmbed(
      discord,
      'Kill Logged',
      `${kill.killerUsername} killed ${kill.killedUsername}.`,
    );
  });

  erlc.on('error', (error) => {
    logger.error('ER:LC client error.', error);
  });
}
