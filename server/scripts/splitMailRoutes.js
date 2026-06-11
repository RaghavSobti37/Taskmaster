const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../routes/mailRoutes.js'), 'utf8');
const lines = src.split(/\r?\n/);

const outDir = path.join(__dirname, '../domains/mail/routes');

const header = lines.slice(0, 39).join('\n').replace(/require\('\.\.\//g, "require('../../../");

const commonImports = `const express = require('express');
const router = express.Router();
const MailCampaign = require('../../../models/MailCampaign');
const EmailProfile = require('../../../models/EmailProfile');
const MailTemplate = require('../../../models/MailTemplate');
const MailEvent = require('../../../models/MailEvent');
const Lead = require('../../../models/Lead');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { sendCampaign, scanBounces, updateEmailTags } = require('../../../services/mailService');
const { validateBody } = require('../../../validation/validateBody');
`;

const sections = [
  {
    file: 'templatesRouter.js',
    start: 40,
    end: 269,
    prefix: header + '\n',
  },
  {
    file: 'profilesRouter.js',
    start: 271,
    end: 419,
    prefix: commonImports +
      `const { getDailyLimitForProvider, FREE_ROTATION_PROVIDER_KEYS } = require('../../../utils/smtpPresets');
const { mergeProviderCredentials } = require('../../../utils/profileCredentials');
const { getTodaySendCountsByProfileProvider, syncProviderUsageFromEvents, buildProfileUsage } = require('../../../services/profileSendStats');
const { mailProfileBody, updateMailProfileBody } = require('../../../validation/schemas/mail');
`,
  },
  {
    file: 'campaignsRouter.js',
    start: 421,
    end: 716,
    prefix: commonImports +
      `const { createCampaignBody } = require('../../../validation/schemas/mail');
`,
  },
  {
    file: 'analyticsRouter.js',
    start: 718,
    end: 969,
    prefix: commonImports,
  },
  {
    file: 'holysheetRouter.js',
    start: 1071,
    end: 1130,
    prefix: `const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../../middleware/authMiddleware');
const { google } = require('googleapis');
`,
  },
];

for (const sec of sections) {
  const body = lines.slice(sec.start, sec.end + 1).join('\n');
  const content = sec.prefix + body + '\nmodule.exports = router;\n';
  fs.writeFileSync(path.join(outDir, sec.file), content);
  console.log('wrote', sec.file);
}
