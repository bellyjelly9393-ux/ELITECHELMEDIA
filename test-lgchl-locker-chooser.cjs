const fs = require('node:fs');
const assert = require('node:assert/strict');
const chooser = require('./lgchl-locker-chooser.js');
const snapshot = JSON.parse(fs.readFileSync('assets/lgchl/rosters/main-rosters-s55.json', 'utf8'));
const source = fs.readFileSync('lgchl-locker-chooser.js', 'utf8');

const clubs = chooser.clubsFromSnapshot(snapshot);
assert.equal(clubs.length, 62);
assert.equal(new Set(clubs.map(club => club.id)).size, 62);
assert.equal(clubs.filter(club => club.league === 'WHL').length, 24);
assert.equal(clubs.filter(club => club.league === 'OHL').length, 20);
assert.equal(clubs.filter(club => club.league === 'QMJHL').length, 18);
assert.ok(clubs.every(club => chooser.ORDER.includes(club.league)));
for (const id of Object.keys(snapshot.teams)) assert.equal(chooser.LEAGUE[Number(id)], clubs.find(club => club.id === Number(id)).league);

const hitmen = chooser.filterClubs(clubs, 'Hitmen');
assert.deepEqual(hitmen.map(club => club.name), ['Calgary Hitmen']);
assert.equal(hitmen[0].id, 412);
assert.equal(chooser.roomHref(412), 'lgchl-team.html?team=412');
const oshawa = chooser.filterClubs(clubs, 'Oshawa');
assert.deepEqual(oshawa.map(club => [club.name, club.league]), [['Oshawa Generals', 'OHL']]);
const ohl = chooser.filterClubs(clubs, 'ohl');
assert.equal(ohl.length, 20);
assert.ok(ohl.every(club => club.league === 'OHL'));

const html = chooser.renderList(clubs, 412, clubs.filter(club => club.league === 'WHL').findIndex(club => club.id === 412), 'list');
assert.equal((html.match(/role="option"/g) || []).length, 62);
assert.equal((html.match(/lgchl-team\.html\?team=\d+/g) || []).length, 62);
assert.ok(html.includes('href="lgchl-team.html?team=412"'));
assert.ok(html.includes('Calgary Hitmen'));
assert.ok(html.includes('aria-current="page"'));
assert.ok(html.indexOf('>WHL<') < html.indexOf('>OHL<'));
assert.ok(html.indexOf('>OHL<') < html.indexOf('>QMJHL<'));
assert.equal((chooser.renderList(chooser.filterClubs(clubs, 'steel'), 0, 0, 'list').match(/role="option"/g) || []).length, 1);
assert.equal(chooser.renderList([], 0, 0, 'list'), '');
assert.doesNotMatch(html, /hitman|war\s*room|training\s*camp|hitmen-hq|chelmachine|elitechel series/i);
assert.doesNotMatch(source, /lgchl_standings|war-room|hitmen-hq|training camp/i);

const poisoned = chooser.clubsFromSnapshot({season:55, teams:{9:{name:'Private War Room', players:[]}, 412:snapshot.teams[412]}});
assert.deepEqual(poisoned.map(club => club.name), ['Calgary Hitmen']);
assert.deepEqual(chooser.clubsFromSnapshot({season:54, teams:snapshot.teams}), []);

const team = fs.readFileSync('lgchl-team.html', 'utf8');
assert.match(team, /id="roomTeam"/);
assert.match(team, /data-locker-chooser/);
assert.match(team, /data-locker-variant="room"/);
assert.match(team, /lgchl-locker-chooser\.js/);
assert.match(team, /lgchl-locker-chooser\.css/);
const nav = fs.readFileSync('public-navigation.js', 'utf8');
const markup = JSON.parse(nav.match(/const markup=(.*);\n/)[1]);
assert.match(markup, /data-locker-chooser/);
assert.match(markup, /data-locker-variant="nav"/);
assert.match(markup, /href="lgchl-team\.html"/);
assert.doesNotMatch(markup, /war\s*room|hitmen-hq|scouting|management/i);
assert.match(nav, /lgchl-locker-chooser\.js/);
for (const page of ['lgchl-media.html', 'lgchl-player.html']) {
  const htmlPage = fs.readFileSync(page, 'utf8');
  assert.match(htmlPage, /data-locker-chooser/, page);
  assert.match(htmlPage, /data-locker-variant="sub"/, page);
  assert.doesNotMatch(htmlPage, /lgchl-team\.html\?team=412">Team rooms/, page);
}
const css = fs.readFileSync('lgchl-locker-chooser.css', 'utf8');
assert.match(css, /max-width:1080px/);
assert.match(css, /min-height:44px/);
assert.doesNotMatch(css, /#(?:a12a20|e62b18|d42a2a|f6cd2a)/i);

console.log('PASS: searchable public locker pull-down lists 62 Season 55 clubs by WHL/OHL/QMJHL, filters by name, and stays off the private room.');
