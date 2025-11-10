/**
 * Discord message types
 */
export enum MessageType {
  /** Create */
  CREATE = 'CREATE',
  /** Update */
  UPDATE = 'UPDATE',
  /** Delete */
  DELETE = 'DELETE',
}

/**
 * Get message type from Discord event type string
 */
export function getMessageType(type: string): MessageType | null {
  switch (type) {
    case 'MESSAGE_CREATE':
      return MessageType.CREATE;
    case 'MESSAGE_UPDATE':
      return MessageType.UPDATE;
    case 'MESSAGE_DELETE':
      return MessageType.DELETE;
    default:
      return null;
  }
}

