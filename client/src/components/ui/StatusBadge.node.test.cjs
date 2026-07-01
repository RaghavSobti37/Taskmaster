const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('resolveStatusRole maps positive states to positive role', async () => {
  const { resolveStatusRole } = await import(
    pathToFileURL(path.join(__dirname, 'statusRole.js')).href
  );
  assert.equal(resolveStatusRole('Available'), 'positive');
  assert.equal(resolveStatusRole('INVOICE'), 'positive');
});

test('resolveStatusRole maps in-use to active (not teal)', async () => {
  const { resolveStatusRole } = await import(
    pathToFileURL(path.join(__dirname, 'statusRole.js')).href
  );
  assert.equal(resolveStatusRole('In Use'), 'active');
});

test('resolveStatusRole maps category to neutral', async () => {
  const { resolveStatusRole } = await import(
    pathToFileURL(path.join(__dirname, 'statusRole.js')).href
  );
  assert.equal(resolveStatusRole('category'), 'neutral');
});

test('resolveStatusRole maps errors to error role', async () => {
  const { resolveStatusRole } = await import(
    pathToFileURL(path.join(__dirname, 'statusRole.js')).href
  );
  assert.equal(resolveStatusRole('Damaged'), 'error');
  assert.equal(resolveStatusRole('danger'), 'error');
});
