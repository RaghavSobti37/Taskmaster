import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

function readComponent(relativePath) {
  return readFileSync(resolve(srcRoot, relativePath), 'utf8');
}

describe('iframe embed safety', () => {
  it('keeps PDF and HTML previews sandboxed with no referrer leakage', () => {
    const files = [
      'emails/wizard/CampaignAttachmentsField.jsx',
      'newsletter/NewsletterCuratorPanel.jsx',
      'project/ProjectFinance.jsx',
      'finance/FinanceDocumentPreview.jsx',
    ];

    files.forEach((file) => {
      const source = readComponent(file);
      expect(source, file).toMatch(/<iframe[\s\S]*sandbox=/);
      expect(source, file).toMatch(/<iframe[\s\S]*referrerPolicy="no-referrer"/);
    });
  });
});
