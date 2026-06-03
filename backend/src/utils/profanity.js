const Filter = require('bad-words');

const filter = new Filter();

// Add domain-specific slurs if needed
// filter.addWords('word1', 'word2');

const containsProfanity = (text) => {
  try {
    return filter.isProfane(text);
  } catch {
    return false;
  }
};

const cleanText = (text) => {
  try {
    return filter.clean(text);
  } catch {
    return text;
  }
};

module.exports = { containsProfanity, cleanText };
