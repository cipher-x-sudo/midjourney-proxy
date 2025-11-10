import { config } from '../config';
import {
  DISCORD_SERVER_URL,
  DISCORD_CDN_URL,
  DISCORD_WSS_URL,
  DISCORD_UPLOAD_URL,
} from '../constants';

/**
 * Discord helper utilities
 */
export class DiscordHelper {
  /**
   * Get Discord server URL
   */
  getServer(): string {
    return config.mj.ngDiscord.server || DISCORD_SERVER_URL;
  }

  /**
   * Get Discord CDN URL
   */
  getCdn(): string {
    return config.mj.ngDiscord.cdn || DISCORD_CDN_URL;
  }

  /**
   * Get Discord WebSocket URL
   */
  getWss(): string {
    return config.mj.ngDiscord.wss || DISCORD_WSS_URL;
  }

  /**
   * Get Discord resume WebSocket URL
   */
  getResumeWss(): string {
    return config.mj.ngDiscord.resumeWss || config.mj.ngDiscord.wss || DISCORD_WSS_URL;
  }

  /**
   * Get Discord upload server URL
   */
  getUploadServer(): string {
    return config.mj.ngDiscord.uploadServer || DISCORD_UPLOAD_URL;
  }

  /**
   * Get Discord upload URL (replace with ngDiscord upload server if configured)
   */
  getDiscordUploadUrl(uploadUrl: string): string {
    if (!config.mj.ngDiscord.uploadServer || !uploadUrl) {
      return uploadUrl;
    }
    const uploadServer = config.mj.ngDiscord.uploadServer.endsWith('/')
      ? config.mj.ngDiscord.uploadServer.slice(0, -1)
      : config.mj.ngDiscord.uploadServer;
    return uploadUrl.replace(DISCORD_UPLOAD_URL, uploadServer);
  }

  /**
   * Get message hash from image URL
   */
  getMessageHash(imageUrl: string): string | null {
    if (!imageUrl) {
      return null;
    }
    if (imageUrl.endsWith('_grid_0.webp')) {
      const hashStartIndex = imageUrl.lastIndexOf('/');
      if (hashStartIndex < 0) {
        return null;
      }
      return imageUrl.substring(hashStartIndex + 1, imageUrl.length - '_grid_0.webp'.length);
    }
    const hashStartIndex = imageUrl.lastIndexOf('_');
    if (hashStartIndex < 0) {
      return null;
    }
    const hashPart = imageUrl.substring(hashStartIndex + 1);
    const dotIndex = hashPart.indexOf('.');
    return dotIndex > 0 ? hashPart.substring(0, dotIndex) : hashPart;
  }
}

