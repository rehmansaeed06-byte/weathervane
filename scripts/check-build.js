#!/usr/bin/env node
/*
 * check-build.js - a simple "build" check for a static site.
 *
 * There is nothing to compile, so this makes sure the pieces fit together:
 *   1. every required file exists
 *   2. index.html loads the stylesheet and both scripts, in the right order
 *   3. every element id that script.js looks up exists in index.html
 *   4. style.css has a colour theme for every theme weather.js can pick
 *
 * Exits with code 1 (which fails the CI run) if anything is wrong.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const problems = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// 1. Required files
const required = ['index.html', 'style.css', 'weather.js', 'script.js'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    problems.push('Missing required file: ' + file);
  }
}

if (problems.length === 0) {
  // 2. index.html references
  const html = read('index.html');
  for (const file of ['style.css', 'weather.js', 'script.js']) {
    if (!html.includes(file)) problems.push('index.html does not load ' + file);
  }
  if (html.indexOf('weather.js') > html.indexOf('script.js')) {
    problems.push('index.html must load weather.js before script.js');
  }

  // 3. Element ids used by script.js
  const script = read('script.js');
  const ids = new Set(
    Array.from(script.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g), (m) => m[1])
  );
  for (const id of ids) {
    if (!new RegExp('id=["\']' + id + '["\']').test(html)) {
      problems.push('script.js looks up id "' + id + '" but index.html has no element with that id');
    }
  }

  // 4. Themes
  const { THEMES } = require('../weather.js');
  const css = read('style.css');
  for (const theme of THEMES) {
    if (!css.includes('[data-theme="' + theme + '"]')) {
      problems.push('style.css has no "' + theme + '" theme');
    }
  }

  if (problems.length === 0) {
    console.log(
      'Build check passed: ' + required.length + ' files, ' + ids.size +
      ' element ids, ' + THEMES.length + ' themes.'
    );
  }
}

if (problems.length > 0) {
  console.error('Build check failed:');
  for (const problem of problems) console.error('  - ' + problem);
  process.exit(1);
}
