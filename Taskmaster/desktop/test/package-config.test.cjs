const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const mainSource = readFileSync(join(__dirname, '..', 'src', 'main.cjs'), 'utf8');

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

test('desktop beta artifact names do not expose version numbers', () => {
  assert.equal(pkg.build.productName, 'CoreKnot Beta');
  assert.equal(pkg.build.artifactName, 'CoreKnot-Beta-${os}-${arch}.${ext}');
  assert.equal(pkg.build.artifactName.includes('${version}'), false);
});

test('desktop updater copy does not expose version numbers', () => {
  assert.equal(mainSource.includes('info.version'), false);
  assert.equal(mainSource.includes('releaseVersion'), false);
  assert.equal(mainSource.includes('Version ${app.getVersion()}'), false);
});

test('desktop auth opens in default browser instead of embedded app window', () => {
  assert.match(mainSource, /will-navigate/);
  assert.match(mainSource, /auth\.tsccoreknot\.com/);
  assert.match(mainSource, /shell\.openExternal/);
});
