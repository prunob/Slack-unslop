const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../extension');
const context = vm.createContext({ URL });
vm.runInContext(readFileSync(path.join(root, 'core.js'), 'utf8'), context);
const core = context.__SVNCore;
const a = { id: 'UTEST00001', profile: { real_name: 'Marie Dupont', display_name: 'dragon42', email: 'private@example.test' } };
const b = { id: 'UTEST00002', profile: { real_name: 'Marc Martin', display_name: 'dragon42' } };
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS ${name}`); }
test('names use real_name and do not persist email', () => {
  const result = core.entry(a);
  assert.equal(result.fullName, 'Marie Dupont');
  assert.equal(JSON.stringify(result).includes('email'), false);
});
test('duplicate aliases require identity', () => {
  const directory = core.index([core.entry(a), core.entry(b)]);
  assert.equal(core.resolve(directory, '', '@dragon42'), null);
  assert.equal(core.resolve(directory, a.id, '@dragon42').fullName, 'Marie Dupont');
  assert.equal(core.resolve(directory, 'UTEST00099', '@dragon42'), null);
});
test('bots and missing real names remain unchanged', () => {
  assert.equal(core.entry({ ...a, is_bot: true }), null);
  assert.equal(core.entry({ id: a.id, profile: { display_name: 'nick' } }), null);
  assert.equal(core.entry({ id: 'USLACKBOT', real_name: 'Slackbot' }), null);
});
test('nested payloads, indexed directory and profile-only responses', () => {
  assert.equal(core.collect({ ok: true, members: [a, b] }).length, 2);
  assert.equal(core.collect({ users: { [a.id]: { profile: a.profile } } })[0].id, a.id);
  assert.equal(core.collect({ profile: a.profile }, a.id)[0].fullName, 'Marie Dupont');
});
test('workspace IDs include older nine-character identifiers', () => {
  assert.equal(core.workspace('https://app.slack.com/client/T12345678/C12345678'), 'T12345678');
  assert.equal(core.workspace('https://app.slack.com/client/TTEST00002/C12345678'), 'TTEST00002');
  assert.equal(core.workspace('not a URL'), '');
});
test('display labels remain literal text and are bounded', () => {
  const record = core.sanitize({ id: a.id, fullName: '<img src=x onerror=alert(1)>', aliases: [] });
  assert.equal(record.fullName, '<img src=x onerror=alert(1)>');
  assert.equal(core.clean('x'.repeat(1000)).length, 160);
});
console.log(`${count} core tests passed`);
