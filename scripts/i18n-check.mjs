#!/usr/bin/env node
/**
 * i18n Coverage Check Script
 * 
 * Compares all translation keys across all locales against the English (base) locale.
 * Reports missing keys per locale.
 * 
 * Usage: node scripts/i18n-check.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nPath = resolve(__dirname, '../client/src/lib/i18n.ts');

const content = readFileSync(i18nPath, 'utf-8');

// Extract each locale's keys by parsing the const declarations
const locales = ['en', 'zhCN', 'zhTW', 'ja', 'ko', 'es', 'pt', 'ru', 'ar', 'vi', 'th', 'id'];
const localeDisplayNames = {
  en: 'English',
  zhCN: 'zh-CN',
  zhTW: 'zh-TW',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
};

// Find all translation keys in each locale section
function extractKeys(content, varName) {
  // Find the start of the const declaration
  const startRegex = new RegExp(`^const ${varName}: Record<string, string> = \\{`, 'm');
  const startMatch = content.match(startRegex);
  if (!startMatch) {
    console.error(`Could not find locale: ${varName}`);
    return new Set();
  }
  
  const startIndex = startMatch.index + startMatch[0].length;
  
  // Find the matching closing brace
  let braceCount = 1;
  let i = startIndex;
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    i++;
  }
  
  const section = content.substring(startIndex, i - 1);
  
  // Extract all keys (quoted strings before colons)
  const keys = new Set();
  const keyRegex = /"([^"]+)":/g;
  let match;
  while ((match = keyRegex.exec(section)) !== null) {
    keys.add(match[1]);
  }
  
  return keys;
}

// Extract keys for all locales
const localeKeys = {};
for (const locale of locales) {
  localeKeys[locale] = extractKeys(content, locale);
}

const baseKeys = localeKeys.en;
console.log(`\n📊 i18n Coverage Report`);
console.log(`${'='.repeat(60)}`);
console.log(`Base locale (English): ${baseKeys.size} keys\n`);

let totalMissing = 0;
const missingByLocale = {};

for (const locale of locales) {
  if (locale === 'en') continue;
  
  const keys = localeKeys[locale];
  const missing = [];
  
  for (const key of baseKeys) {
    if (!keys.has(key)) {
      missing.push(key);
    }
  }
  
  const coverage = ((keys.size / baseKeys.size) * 100).toFixed(1);
  const displayName = localeDisplayNames[locale];
  
  if (missing.length > 0) {
    console.log(`❌ ${displayName}: ${keys.size}/${baseKeys.size} keys (${coverage}%) - ${missing.length} missing`);
    for (const key of missing) {
      console.log(`   - "${key}"`);
    }
    missingByLocale[locale] = missing;
    totalMissing += missing.length;
  } else {
    console.log(`✅ ${displayName}: ${keys.size}/${baseKeys.size} keys (${coverage}%)`);
  }
}

console.log(`\n${'='.repeat(60)}`);
if (totalMissing === 0) {
  console.log(`✅ All locales have 100% coverage!`);
  process.exit(0);
} else {
  console.log(`❌ Total missing: ${totalMissing} keys across ${Object.keys(missingByLocale).length} locales`);
  
  // Output JSON for automated fixing
  if (process.argv.includes('--json')) {
    console.log('\n--- MISSING KEYS JSON ---');
    console.log(JSON.stringify(missingByLocale, null, 2));
  }
  
  process.exit(1);
}
