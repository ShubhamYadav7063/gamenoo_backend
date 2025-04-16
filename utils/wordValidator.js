// const fs = require("fs");
// const path = require("path");

// // A simple word list in memory
// // For a production app, you'd want to use a proper dictionary file
// // or database, but this will work for our demo
// const commonWords = [
//   "able",
//   "about",
//   "above",
//   "act",
//   "add",
//   "after",
//   "again",
//   "age",
//   "air",
//   "all",
//   "also",
//   "and",
//   "animal",
//   "answer",
//   "any",
//   "appear",
//   "are",
//   "area",
//   "arms",
//   "around",
//   "art",
//   "ask",
//   "back",
//   "bad",
//   "ball",
//   "bank",
//   "base",
//   "bat",
//   "bear",
//   "beat",
//   "beauty",
//   "bed",
//   "been",
//   "before",
//   "began",
//   "begin",
//   "behind",
//   "being",
//   "best",
//   "better",
//   "between",
//   "big",
//   "bird",
//   "bit",
//   "black",
//   "blue",
//   "boat",
//   "body",
//   "bone",
//   "book",
//   "born",
//   "both",
//   "bottom",
//   "box",
//   "boy",
//   "break",
//   "bring",
//   "brought",
//   "build",
//   "built",
//   "busy",
//   "but",
//   "buy",
//   "call",
//   "came",
//   "can",
//   "car",
//   "care",
//   "carry",
//   "case",
//   "cat",
//   "cause",
//   "center",
//   "certain",
//   "change",
//   "check",
//   "child",
//   "city",
//   "class",
//   "clear",
//   "close",
//   "cold",
//   "color",
//   "come",
//   "common",
//   "could",
//   "country",
//   "course",
//   "cut",
//   "dark",
//   "day",
//   "deep",
//   "did",
//   "die",
//   "direct",
//   "does",
//   "dog",
//   "done",
//   "door",
//   "down",
//   "draw",
//   "dream",
//   "drive",
//   "drop",
//   "dry",
//   "during",
//   "each",
//   "ear",
//   "early",
//   "earth",
//   "east",
//   "eat",
//   "edge",
//   "egg",
//   "else",
//   "end",
//   "enough",
//   "even",
//   "ever",
//   "every",
//   "example",
//   "eye",
//   "face",
//   "fact",
//   "fall",
//   "family",
//   "far",
//   "farm",
//   "fast",
//   "father",
//   "fear",
//   "feel",
//   "feet",
//   "few",
//   "field",
//   "fig",
//   "fill",
//   "final",
//   "find",
//   "fine",
//   "fire",
//   "first",
//   "fish",
//   "five",
//   "fly",
//   "follow",
//   "food",
//   "foot",
//   "for",
//   "force",
//   "form",
//   "found",
//   "four",
//   "free",
//   "friend",
//   "from",
//   "front",
//   "full",
//   "game",
//   "gave",
//   "get",
//   "girl",
//   "give",
//   "given",
//   "gold",
//   "good",
//   "got",
//   "great",
//   "green",
//   "ground",
//   "group",
//   "grow",
//   "had",
//   "half",
//   "hand",
//   "hard",
//   "has",
//   "hat",
//   "have",
//   "head",
//   "hear",
//   "heart",
//   "heat",
//   "help",
//   "her",
//   "here",
//   "high",
//   "hill",
//   "him",
//   "his",
//   "hit",
//   "hold",
//   "home",
//   "hope",
//   "horse",
//   "hot",
//   "hour",
//   "house",
//   "how",
//   "hundred",
//   "in",
//   "not",
//   // ... add hundreds more words for a real game
// ];

// // Simple word validation
// function validateWord(word) {
//   // Check if the word is in our list
//   // For a real game, you'd use a more comprehensive dictionary
//   return word.length >= 2 && commonWords.includes(word.toLowerCase());
// }

// module.exports = { validateWord };

const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Local cache to avoid excessive API calls
let wordCache = {};

// Try to load existing cache if available
try {
  const cachePath = path.join(__dirname, "word-cache.json");
  if (fs.existsSync(cachePath)) {
    wordCache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    console.log(`Loaded ${Object.keys(wordCache).length} words from cache`);
  }
} catch (error) {
  console.warn("Failed to load word cache:", error.message);
}

// Save cache periodically to disk
function saveCache() {
  try {
    const cachePath = path.join(__dirname, "word-cache.json");
    fs.writeFileSync(cachePath, JSON.stringify(wordCache, null, 2));
    console.log(`Saved ${Object.keys(wordCache).length} words to cache`);
  } catch (error) {
    console.warn("Failed to save word cache:", error.message);
  }
}

// Set up automatic cache saving every 5 minutes
setInterval(saveCache, 5 * 60 * 1000);

/**
 * Validates a word using the Free Dictionary API
 * @param {string} word The word to validate
 * @returns {Promise<boolean>} Whether the word is valid
 */
async function validateWord(word) {
  if (!word || word.length < 2) return false;

  const normalizedWord = word.toLowerCase().trim();

  // Check cache first
  if (wordCache[normalizedWord] !== undefined) {
    return wordCache[normalizedWord];
  }

  try {
    // Use Free Dictionary API to check if the word exists
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${normalizedWord}`,
      {
        timeout: 3000, // 3 second timeout
      }
    );

    // If we get a 200 response, the word exists
    const isValid = response.status === 200;

    // Cache the result
    wordCache[normalizedWord] = isValid;

    return isValid;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Word not found in dictionary
      wordCache[normalizedWord] = false;
      return false;
    }

    // For any other error (network error, timeout, etc.),
    // fall back to the local list just in case
    console.warn(`API error for word "${normalizedWord}": ${error.message}`);
    return commonWords.includes(normalizedWord);
  }
}

// Maintain the original list as a fallback
const commonWords = [
  "able",
  "about",
  "above",
  "act",
  "add",
  "after",
  "again",
  "age",
  "air",
  "all",
  "also",
  "and",
  "animal",
  "answer",
  "any",
  "appear",
  "are",
  "area",
  "arms",
  "around",
  "art",
  "ask",
  "back",
  "bad",
  "ball",
  "bank",
  "base",
  "bat",
  "bear",
  "beat",
  // ... truncated for brevity
  "in",
  "not",
  // In a real implementation, you'd have many more words
];

module.exports = { validateWord };
