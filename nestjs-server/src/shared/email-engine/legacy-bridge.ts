import { createRequire } from 'module';
import { join } from 'path';

const legacyRequire = createRequire(__filename);

/** Monorepo `server/` root — works from `dist/shared/email-engine`. */
const SERVER_ROOT = join(__dirname, '../../../../server');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLegacy(relativePath: string): any {
  return legacyRequire(join(SERVER_ROOT, relativePath));
}

/** Locked geo helpers — do not reimplement; see docs/EMAIL_ENGINE_LOCKED.md */
export const geoLookup = loadLegacy('utils/geoLookup.js');

/** Locked tracking URL builder — TRACKING_BASE_URL contract */
export const trackingUrls = loadLegacy('utils/trackingUrls.js');

/** Locked open pixel + click wrap injection */
export const emailTracker = loadLegacy('utils/emailTracker.js');

/** Atomic open/click claim helpers (shared with Express track.js) */
export const trackingClaim = loadLegacy('utils/trackingClaim.js');

/** Legacy Mongoose models (tenant-aware writes match Express) */
export const legacyModels = {
  EmailLog: loadLegacy('models/EmailLog.js'),
  Lead: loadLegacy('models/Lead.js'),
  Campaign: loadLegacy('models/Campaign.js'),
  MailCampaign: loadLegacy('models/MailCampaign.js'),
  MailEvent: loadLegacy('models/MailEvent.js'),
};

/** Locked Resend webhook handler reference (geo + tag lookup path) */
export const resendWebhookHandler = loadLegacy(
  'domains/mail/webhooks/resendWebhookHandler.js',
);

export const mailService = loadLegacy('services/mailService.js');
