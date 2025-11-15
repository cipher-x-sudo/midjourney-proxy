/**
 * Extract seed value from Discord message
 * Seed can appear in message content, embed fields, embed description, or embed footer
 */
export function extractSeedFromMessage(message: any): string | null {
  if (!message) {
    return null;
  }

  // Check message content
  const content = message.content || '';
  const seedFromContent = extractSeedFromText(content);
  if (seedFromContent) {
    return seedFromContent;
  }

  // Check embed fields
  const embeds = message.embeds || [];
  for (const embed of embeds) {
    // Check embed fields
    if (embed.fields && Array.isArray(embed.fields)) {
      for (const field of embed.fields) {
        if (field.name && field.name.toLowerCase().includes('seed')) {
          const seed = extractSeedFromText(field.value || '');
          if (seed) {
            return seed;
          }
        }
        // Also check field value directly
        const seed = extractSeedFromText(field.value || '');
        if (seed) {
          return seed;
        }
      }
    }

    // Check embed description
    if (embed.description) {
      const seed = extractSeedFromText(embed.description);
      if (seed) {
        return seed;
      }
    }

    // Check embed footer
    if (embed.footer && embed.footer.text) {
      const seed = extractSeedFromText(embed.footer.text);
      if (seed) {
        return seed;
      }
    }
  }

  return null;
}

/**
 * Extract seed value from text using regex patterns
 * Patterns: "Seed: 1234567890", "seed: 1234567890", "Seed 1234567890", etc.
 */
function extractSeedFromText(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Pattern 1: "Seed: 1234567890" or "seed: 1234567890"
  const pattern1 = /[Ss]eed[:\s]+(\d+)/;
  const match1 = text.match(pattern1);
  if (match1 && match1[1]) {
    return match1[1];
  }

  // Pattern 2: "Seed 1234567890" (without colon)
  const pattern2 = /[Ss]eed\s+(\d+)/;
  const match2 = text.match(pattern2);
  if (match2 && match2[1]) {
    return match2[1];
  }

  // Pattern 3: Just look for numeric values after "seed" keyword (case insensitive)
  const pattern3 = /(?:^|\s)[Ss]eed[:\s]*(\d{8,})/;
  const match3 = text.match(pattern3);
  if (match3 && match3[1]) {
    return match3[1];
  }

  return null;
}

