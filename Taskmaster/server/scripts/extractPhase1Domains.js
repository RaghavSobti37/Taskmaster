/**
 * One-shot: extract phase-1 bounded contexts into domains/* with backward-compat re-exports.
 * Run: node scripts/extractPhase1Domains.js
 */
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

function reexportShim(targetRelFromShim) {
  return `/** @deprecated Import from domain path — kept for backward compatibility */\nmodule.exports = require('${targetRelFromShim}');\n`;
}

/** Move file to domain; rewrite ../ imports based on depth delta. */
function moveWithImportFix(src, dest, extraReplacements = []) {
  if (!fs.existsSync(src)) {
    console.warn('skip missing', src);
    return;
  }
  let content = read(src);
  const srcDepth = src.split(path.sep).length;
  const destDepth = dest.split(path.sep).length;
  const depthDelta = destDepth - srcDepth;

  if (depthDelta !== 0) {
    const up = '../'.repeat(Math.abs(depthDelta));
    if (depthDelta > 0) {
      content = content.replace(/require\(['"](\.\.\/[^'"]+)['"]\)/g, (match, p) => {
        const prefix = p.match(/^(\.\.\/)+/)[0];
        const rest = p.slice(prefix.length);
        const levels = prefix.length / 3;
        const newLevels = levels + depthDelta;
        return `require('${'../'.repeat(newLevels)}${rest}')`;
      });
    }
  }

  for (const [from, to] of extraReplacements) {
    content = content.split(from).join(to);
  }

  write(dest, content);

  const relToDest = path.relative(path.dirname(src), dest).split(path.sep).join('/');
  if (!relToDest.startsWith('.')) {
    write(src, reexportShim(`./${relToDest}`));
  } else {
    write(src, reexportShim(relToDest));
  }
}

const domains = {
  artists: {
    controllers: [
      'artistController.js',
      'artistAnalyticsController.js',
      'artistShareController.js',
      'connectionAuthController.js',
      'artistCrmController.js',
    ],
    services: [
      'spotifyTokenManager.js',
      'artistEnrichmentService.js',
      'connectionService.js',
      'artistEnquiryService.js',
      'artistPathImportService.js',
      'artistPathHubService.js',
      'artistCrmImportService.js',
    ],
    models: ['Artist.js', 'ArtistAuth.js', 'ArtistConnection.js', 'ArtistMetrics.js', 'ArtistPathResponse.js'],
  },
  dashboard: {
    controllers: ['dashboardController.js'],
    services: [],
    models: ['DashboardPreset.js'],
  },
  auth: {
    controllers: ['authController.js', 'userController.js'],
    services: [],
    models: ['User.js'],
  },
  integrations: {
    controllers: [
      'googleController.js',
      'exlyController.js',
      'integrationsVerifyController.js',
      'metaDataDeletionController.js',
    ],
    services: [],
    models: ['ExlyBooking.js', 'ExlyOffering.js', 'MetaDeletionRequest.js'],
  },
};

for (const [domain, spec] of Object.entries(domains)) {
  const base = path.join(SERVER, 'domains', domain);
  ensureDir(path.join(base, 'controllers'));
  ensureDir(path.join(base, 'services'));
  ensureDir(path.join(base, 'models'));

  for (const file of spec.controllers) {
    moveWithImportFix(
      path.join(SERVER, 'controllers', file),
      path.join(base, 'controllers', file),
    );
  }

  for (const file of spec.services) {
    const extra = domain === 'artists' && file === 'artistEnrichmentService.js'
      ? []
      : [];
    moveWithImportFix(
      path.join(SERVER, 'services', file),
      path.join(base, 'services', file),
      extra,
    );
  }

  // Fix artist service cross-imports after move
  if (domain === 'artists') {
    const analyticsSvc = path.join(SERVER, 'services', 'analyticsService.js');
    if (fs.existsSync(analyticsSvc)) {
      let c = read(analyticsSvc);
      if (c.includes("./spotifyTokenManager")) {
        c = c.replace(
          "require('./spotifyTokenManager')",
          "require('../domains/artists/services/spotifyTokenManager')",
        );
        write(analyticsSvc, c);
      }
    }
  }

  const modelExports = spec.models.map((m) => {
    const name = m.replace('.js', '');
    return `  ${name}: require('../../../models/${name}'),`;
  }).join('\n');

  write(
    path.join(base, 'models', 'index.js'),
    `/** ${domain} domain models — canonical re-exports from server/models */\nmodule.exports = {\n${modelExports}\n};\n`,
  );
}

console.log('Phase-1 domain file moves complete.');
