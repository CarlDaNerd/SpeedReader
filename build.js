const fs = require('fs');
const path = require('path');

// ── Read source files ──────────────────────────────────────────────────────
const core     = fs.readFileSync('reader-core.js', 'utf8');
const template = fs.readFileSync('index.template.html', 'utf8');

// ── Build standalone index.html ────────────────────────────────────────────
// Replace the placeholder comment with the actual core JS
const output = template.replace('// __READER_CORE__', core);
fs.writeFileSync('index.html', output, 'utf8');
console.log('Built index.html');

// ── Copy reader-core.js into extension folder ──────────────────────────────
const extDest = path.join('Extention', 'reader-core.js');
fs.copyFileSync('reader-core.js', extDest);
console.log('Copied reader-core.js to Extention/');