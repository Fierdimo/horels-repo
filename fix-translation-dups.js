/**
 * Fixes duplicate keys in locale translation files (en, de, fr, it).
 * Strategy:
 *  - Custom recursive-descent JSON parser
 *  - When a duplicate key is encountered and BOTH values are objects → deep merge
 *    (unique keys from the first block are preserved; second block wins on conflicts)
 *  - When values are not both objects (e.g. string vs string, string vs object) → last wins
 *  - ES was already cleaned; this script skips it.
 */

const fs = require('fs');
const path = require('path');

// Deep merge: result = base keys + override keys; override wins on conflict.
// If a key exists in both and both are objects → recurse.
function mergeObjects(base, override) {
  const result = Object.assign({}, base);
  for (const [key, value] of Object.entries(override)) {
    if (
      key in result &&
      typeof result[key] === 'object' && result[key] !== null &&
      typeof value === 'object' && value !== null
    ) {
      result[key] = mergeObjects(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Custom JSON parser that handles duplicate keys:
//   - object + object  → mergeObjects (preserves unique keys from earlier block)
//   - anything else    → last value wins
function parseJSON(str) {
  let pos = 0;
  
  function skipWhitespace() {
    while (pos < str.length && /\s/.test(str[pos])) pos++;
  }
  
  function parseValue() {
    skipWhitespace();
    const ch = str[pos];
    if (ch === '"') return parseString();
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === 't') { pos += 4; return true; }
    if (ch === 'f') { pos += 5; return false; }
    if (ch === 'n') { pos += 4; return null; }
    return parseNumber();
  }
  
  function parseString() {
    pos++; // skip opening quote
    let result = '';
    while (pos < str.length) {
      const ch = str[pos];
      if (ch === '\\') {
        pos++;
        const esc = str[pos];
        if (esc === '"') result += '"';
        else if (esc === '\\') result += '\\';
        else if (esc === '/') result += '/';
        else if (esc === 'b') result += '\b';
        else if (esc === 'f') result += '\f';
        else if (esc === 'n') result += '\n';
        else if (esc === 'r') result += '\r';
        else if (esc === 't') result += '\t';
        else if (esc === 'u') {
          const hex = str.slice(pos + 1, pos + 5);
          result += String.fromCharCode(parseInt(hex, 16));
          pos += 4;
        }
        pos++;
      } else if (ch === '"') {
        pos++; // skip closing quote
        break;
      } else {
        result += ch;
        pos++;
      }
    }
    return result;
  }
  
  function parseNumber() {
    let start = pos;
    if (str[pos] === '-') pos++;
    while (pos < str.length && /[0-9.eE+\-]/.test(str[pos])) pos++;
    return parseFloat(str.slice(start, pos));
  }
  
  function parseObject() {
    pos++; // skip {
    const obj = {};
    skipWhitespace();
    while (pos < str.length && str[pos] !== '}') {
      skipWhitespace();
      if (str[pos] === '}') break;
      const key = parseString();
      skipWhitespace();
      pos++; // skip :
      skipWhitespace();
      const value = parseValue();

      if (
        key in obj &&
        typeof obj[key] === 'object' && obj[key] !== null &&
        typeof value === 'object' && value !== null
      ) {
        // Both values are objects → deep merge (first block's unique keys survive)
        obj[key] = mergeObjects(obj[key], value);
      } else {
        // Last value wins (handles simple string/number dupes and type mismatches)
        obj[key] = value;
      }

      skipWhitespace();
      if (str[pos] === ',') pos++;
      skipWhitespace();
    }
    pos++; // skip }
    return obj;
  }

  function parseArray() {
    pos++; // skip [
    const arr = [];
    skipWhitespace();
    while (pos < str.length && str[pos] !== ']') {
      arr.push(parseValue());
      skipWhitespace();
      if (str[pos] === ',') pos++;
      skipWhitespace();
    }
    pos++; // skip ]
    return arr;
  }

  return parseValue();
}

// ── Process each locale ──────────────────────────────────────────────────────

const locales = ['en', 'de', 'fr', 'it'];

for (const locale of locales) {
  const filePath = path.join(__dirname, `frontend/src/locales/${locale}/translation.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Not found: ${filePath}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const originalLines = raw.split('\n').length;

  let data;
  try {
    data = parseJSON(raw);
  } catch (err) {
    console.error(`❌ Parse error for ${locale}:`, err.message);
    continue;
  }

  const output = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, output, 'utf8');

  const cleanedLines = output.split('\n').length;
  console.log(`✅ ${locale}: ${originalLines} → ${cleanedLines} lines (saved)`);
}

console.log('\nDone. Run: node find-dups.js > dups-output-new.txt');
