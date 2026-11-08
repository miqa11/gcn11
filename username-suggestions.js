const { randomInt } = require("node:crypto");

// Keep the requested spelling and fit suffixes within the registration limit.
function suggestUsernames(username, isUnavailable) {
  const suggestions = [];
  const seen = new Set();
  for (let attempt = 0; attempt < 100 && suggestions.length < 3; attempt++) {
    const suffix = String(attempt < 10 ? attempt + 1 : randomInt(10, 100000));
    const candidate = username.slice(0, 20 - suffix.length).trimEnd() + suffix;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isUnavailable(candidate)) suggestions.push(candidate);
  }
  return suggestions;
}

module.exports = { suggestUsernames };
