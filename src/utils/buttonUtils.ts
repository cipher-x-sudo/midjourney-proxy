/**
 * Button information extracted from Discord message components
 */
export interface ButtonInfo {
  /** Button custom ID used for API calls */
  customId: string;
  /** Button label text */
  label?: string;
  /** Button emoji (if present) */
  emoji?: {
    name?: string;
    id?: string;
    animated?: boolean;
  };
  /** Button type (usually 2 for button) */
  type?: number;
  /** Button style (1=primary, 2=secondary, 3=success, 4=danger, 5=link) */
  style?: number;
  /** Whether button is disabled */
  disabled?: boolean;
  /** URL (for link buttons) */
  url?: string;
}

/**
 * Extract button information from Discord message components
 * Discord message structure:
 * - components: array of action rows (type 1)
 * - each action row has components: array of buttons (type 2)
 * - each button has custom_id, label, emoji, style, etc.
 */
export function extractButtonsFromMessage(message: any): ButtonInfo[] {
  if (!message || !message.components || !Array.isArray(message.components)) {
    return [];
  }

  const buttons: ButtonInfo[] = [];

  // Iterate through action rows
  for (const component of message.components) {
    // Action row (type 1) contains buttons
    if (component.type === 1 && component.components && Array.isArray(component.components)) {
      // Iterate through buttons in the action row
      for (const button of component.components) {
        // Button (type 2)
        if (button.type === 2 && button.custom_id) {
          const buttonInfo: ButtonInfo = {
            customId: button.custom_id,
            type: button.type,
          };

          if (button.label) {
            buttonInfo.label = button.label;
          }

          if (button.emoji) {
            buttonInfo.emoji = {
              name: button.emoji.name,
              id: button.emoji.id,
              animated: button.emoji.animated,
            };
          }

          if (button.style !== undefined) {
            buttonInfo.style = button.style;
          }

          if (button.disabled !== undefined) {
            buttonInfo.disabled = button.disabled;
          }

          if (button.url) {
            buttonInfo.url = button.url;
          }

          buttons.push(buttonInfo);
        }
      }
    }
  }

  return buttons;
}

