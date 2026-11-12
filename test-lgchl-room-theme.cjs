const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {LEAGUE} = require('./lgchl-locker-chooser.js');
const code = fs.readFileSync('lgchl-room-theme.js', 'utf8');
function run(search, theme) {
 const body = {dataset: {roomTheme: theme}}, label = {hidden: true};
 vm.runInNewContext(code, {document: {body, querySelector: () => label},
  window: {LGLockerChooser: {LEAGUE}}, location: {search}, URLSearchParams});
 return {body, label};
}
for (const [id, league] of Object.entries(LEAGUE)) {
 const {body, label} = run('?team=' + id, 's55-playoffs');
 assert.equal(body.dataset.roomLeague, league);
 assert.equal(label.hidden, false);
 assert.equal(run('?team=' + id, 'regular').label.hidden, true);
}
assert.equal(run('', 's55-playoffs').body.dataset.roomLeague, 'WHL');
for (const id of ['nope', '0', '-1', '1.5']) assert.equal(run('?team=' + id, 's55-playoffs').body.dataset.roomLeague, undefined);
console.log('PASS: all league mappings, removable season label, default Calgary and invalid IDs.');
