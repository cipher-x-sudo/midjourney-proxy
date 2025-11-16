/**
 * Return codes for API responses
 */
export const ReturnCode = {
  /** Success */
  SUCCESS: 1,
  /** Data not found */
  NOT_FOUND: 3,
  /** Validation error */
  VALIDATION_ERROR: 4,
  /** System error */
  FAILURE: 9,
  /** Already exists */
  EXISTED: 21,
  /** In queue */
  IN_QUEUE: 22,
  /** Queue is full */
  QUEUE_REJECTED: 23,
  /** Prompt contains sensitive words */
  BANNED_PROMPT: 24,
} as const;

/**
 * Task property names
 */
export const TASK_PROPERTY_NOTIFY_HOOK = 'notifyHook';
export const TASK_PROPERTY_FINAL_PROMPT = 'finalPrompt';
export const TASK_PROPERTY_MESSAGE_ID = 'messageId';
export const TASK_PROPERTY_MESSAGE_HASH = 'messageHash';
export const TASK_PROPERTY_PROGRESS_MESSAGE_ID = 'progressMessageId';
export const TASK_PROPERTY_FLAGS = 'flags';
export const TASK_PROPERTY_NONCE = 'nonce';
export const TASK_PROPERTY_DISCORD_INSTANCE_ID = 'discordInstanceId';
export const TASK_PROPERTY_REFERENCED_MESSAGE_ID = 'referencedMessageId';
export const TASK_PROPERTY_SEED = 'seed';
export const TASK_PROPERTY_SEED_REQUESTED_AT = 'seedRequestedAt';
export const TASK_PROPERTY_BUTTONS = 'buttons';
export const TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID = 'iframe_modal_custom_id';
export const TASK_PROPERTY_REMIX_MODAL_MESSAGE_ID = 'remixModalMessageId';
export const TASK_PROPERTY_INTERACTION_METADATA_ID = 'interactionMetadataId';
export const TASK_PROPERTY_CUSTOM_ID = 'customId';

/**
 * API secret header name
 */
export const API_SECRET_HEADER_NAME = 'mj-api-secret';

/**
 * Default Discord user agent
 */
export const DEFAULT_DISCORD_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';

/**
 * Message handled flag
 */
export const MJ_MESSAGE_HANDLED = 'mj_proxy_handled';

/**
 * Discord server URLs
 */
export const DISCORD_SERVER_URL = 'https://discord.com';
export const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
export const DISCORD_WSS_URL = 'wss://gateway.discord.gg';
export const DISCORD_UPLOAD_URL = 'https://discord-attachments-uploads-prd.storage.googleapis.com';

/**
 * WebSocket op codes
 */
export const WebSocketCode = {
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALIDATE_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
  DISPATCH: 0,
} as const;

