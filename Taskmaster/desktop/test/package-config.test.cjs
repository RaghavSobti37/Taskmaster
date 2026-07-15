const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

test('desktop beta publishes GitHub prerelease update metadata', () => {
  const [publish] = pkg.build.publish;
  assert.equal(publish.provider, 'github');
  assert.equal(publish.owner, 'RaghavSobti37');
  assert.equal(publish.repo, 'Taskmaster');
  assert.equal(publish.releaseType, 'prerelease');
  assert.equal(publish.channel, 'beta');
});

test('desktop beta ships installable targets', () => {
  assert.deepEqual(pkg.build.win.target, ['nsis']);
  assert.deepEqual(pkg.build.mac.target, ['dmg']);
  assert.deepEqual(pkg.build.linux.target, ['AppImage']);
});
