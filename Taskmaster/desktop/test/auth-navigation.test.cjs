const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isCoreKnotAppReturn,
  shouldOpenAuthPopup,
  toAuthUrl,
} = require('../src/authNavigation.cjs');

test('desktop opens CoreKnot auth routes in auth popup', () => {
  assert.equal(shouldOpenAuthPopup('https://tsccoreknot.com/login?redirect=%2Fdashboard'), true);
  assert.equal(shouldOpenAuthPopup('https://auth.tsccoreknot.com/login'), true);
  assert.equal(shouldOpenAuthPopup('https://tsccoreknot.com/dashboard'), false);
});

test('desktop maps app-host auth route to auth host', () => {
  assert.equal(
    toAuthUrl('https://tsccoreknot.com/login?redirect=%2Fdashboard'),
    'https://auth.tsccoreknot.com/login?redirect=%2Fdashboard',
  );
});

test('desktop detects successful app return from auth popup', () => {
  assert.equal(isCoreKnotAppReturn('https://tsccoreknot.com/dashboard'), true);
  assert.equal(isCoreKnotAppReturn('https://tsccoreknot.com/login'), false);
});
