import { z } from 'zod';
import { isVerifiedResendEmail } from '../constants/resendFromEmails';

export const step1Schema = z.object({
  title: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  senderMode: z.enum(['single', 'system_resend']),
  senderProfileId: z.string().optional(),
  senderProfileIds: z.array(z.string()).optional(),
  resendFromEmail: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.senderMode === 'single' && !data.senderProfileId) {
    ctx.addIssue({ code: 'custom', message: 'Select a Gmail profile', path: ['senderProfileId'] });
  }
  if (data.senderMode === 'system_resend' && !isVerifiedResendEmail(data.resendFromEmail)) {
    ctx.addIssue({ code: 'custom', message: 'Select a from address on theshakticollective.in', path: ['resendFromEmail'] });
  }
});

export const step2Schema = z.object({
  mailTemplateId: z.string().min(1, 'Select an approved template'),
});

export const step3Schema = z.object({
  variableMapping: z.record(z.string()),
});

export const step4Schema = z.object({
  includeSignature: z.boolean(),
  includeUnsubscribe: z.boolean(),
  signature: z.string().optional(),
  signatureSaved: z.boolean().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string().optional(),
    storageKey: z.string(),
    storageUrl: z.string().optional(),
  })).optional(),
});

export const WIZARD_DEFAULTS = {
  title: '',
  subject: '',
  senderMode: 'system_resend',
  senderProfileId: '',
  senderProfileIds: [],
  resendFromEmail: 'artist@theshakticollective.in',
  mailTemplateId: '',
  variableMapping: {},
  includeSignature: false,
  includeUnsubscribe: false,
  signature: '',
  signatureSaved: false,
  attachments: [],
};

export function validateVariableMappingComplete(indices, mapping) {
  const missing = (indices || []).filter((idx) => {
    const col = mapping?.[idx] ?? mapping?.[String(idx)];
    return !col || !String(col).trim();
  });
  return { ok: missing.length === 0, missing };
}

export const STEP_FIELDS = {
  1: ['title', 'subject', 'senderMode', 'senderProfileId', 'senderProfileIds', 'resendFromEmail'],
  2: ['mailTemplateId'],
  3: ['variableMapping'],
  4: ['includeSignature', 'includeUnsubscribe', 'signature', 'signatureSaved', 'attachments'],
};
