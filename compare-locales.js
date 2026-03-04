const fs = require('fs');

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const locales = ['es', 'en', 'de', 'fr', 'it'];
const data = {};
for (const l of locales) {
  data[l] = JSON.parse(fs.readFileSync(`frontend/src/locales/${l}/translation.json`, 'utf8'));
}

const esKeys = new Set(flattenKeys(data['es']));
console.log('ES total keys:', esKeys.size);

for (const locale of ['en', 'de', 'fr', 'it']) {
  const lKeys = new Set(flattenKeys(data[locale]));
  const missing = [...esKeys].filter(k => !lKeys.has(k));
  const extra = [...lKeys].filter(k => !esKeys.has(k));
  console.log('\n=== ' + locale + ' ===');
  console.log('Total keys: ' + lKeys.size);
  console.log('Missing vs ES (' + missing.length + '):');
  missing.forEach(k => console.log('  MISSING: ' + k));
  console.log('Extra vs ES (' + extra.length + '):');
  extra.forEach(k => console.log('  EXTRA: ' + k));
}
