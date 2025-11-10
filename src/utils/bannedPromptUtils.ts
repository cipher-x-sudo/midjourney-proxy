import { BannedPromptException } from '../exceptions/BannedPromptException';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Banned words list
 */
let BANNED_WORDS: string[] = [];

/**
 * Initialize banned words from file
 */
function initBannedWords(): void {
  const bannedWordsFilePath = process.env.BANNED_WORDS_FILE || '/home/spring/config/banned-words.txt';
  let filePath: string;

  if (fs.existsSync(bannedWordsFilePath)) {
    filePath = bannedWordsFilePath;
  } else {
    // Try resource file
    const resourcePath = path.join(__dirname, '../../resources/banned-words.txt');
    if (fs.existsSync(resourcePath)) {
      filePath = resourcePath;
    } else {
      // Fallback to default location
      filePath = path.join(__dirname, '../../resources/banned-words.txt');
    }
  }

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      BANNED_WORDS = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } else {
      console.warn(`Banned words file not found: ${filePath}`);
      BANNED_WORDS = [];
    }
  } catch (e) {
    console.error(`Failed to load banned words: ${e}`);
    BANNED_WORDS = [];
  }
}

// Initialize on module load
initBannedWords();

/**
 * Check if prompt contains banned words
 */
export function checkBanned(promptEn: string): void {
  const finalPromptEn = promptEn.toLowerCase();
  for (const word of BANNED_WORDS) {
    const regex = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (regex.test(finalPromptEn)) {
      const index = finalPromptEn.toLowerCase().indexOf(word.toLowerCase());
      if (index !== -1) {
        throw new BannedPromptException(promptEn.substring(index, index + word.length));
      }
    }
  }
}

