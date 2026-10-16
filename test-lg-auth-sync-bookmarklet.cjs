// Verifies the Auth Sync bookmarklet survives being collapsed onto one line
// (Chrome strips newlines when a javascript: URL is pasted or bookmarked).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'lg-auth-sync.js'), 'utf8');
const window = { addEventListener() {} };
const document = { readyState: 'complete', getElementById: () => null, addEventListener() {} };
const location = { origin: 'https://wildmanhockey-elitechelmedia.app' };
new Function('window', 'document', 'location', 'sessionStorage', 'localStorage', src)(
  window, document, location, { getItem: () => null }, {});

const { bookmarklet, collector } = window.WildmanLgAuthSync;
assert.ok(bookmarklet.startsWith('javascript:'), 'bookmarklet must start with javascript:');
assert.ok(!/[\r\n]/.test(bookmarklet), 'bookmarklet must be a single line');
const code = bookmarklet.slice('javascript:'.length);
new Function(code); // throws SyntaxError if it does not parse

// Simulate what Chrome does to a pasted/bookmarked URL.
new Function(code.replace(/[\r\n]/g, ''));
// The raw collector source must also survive newline stripping (no // line comments).
new Function('(' + collector.toString().replace(/[\r\n]/g, '') + ')("x")');

// The bookmarklet must not embed any secret material.
assert.ok(!/(sb_secret_|service_role|eyJ[A-Za-z0-9_-]{10,}|apikey|Bearer )/i.test(bookmarklet), 'bookmarklet must not embed keys/tokens');
console.log('ok - Auth Sync bookmarklet parses as one line (' + bookmarklet.length + ' chars)');
