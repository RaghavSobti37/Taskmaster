import { useCallback } from 'react';
import { getEffectiveTemplateContent } from '../../../utils/indexedTemplateVariables';
import { estimateJsonBytes, PAYLOAD_SAFE_BYTES } from '../../../utils/smtpPresets';
import { useCreateCampaign } from '../../../hooks/useTaskmasterQueries';
import { useToast } from '../../../contexts/ToastContext';
import { buildAutoMailerUrl } from '../../../utils/autoMailerUrl';

export function buildCampaignPayloadFromForm(formValues, approvedTemplates, customRecipients, leadIds = []) {
  const template = approvedTemplates.find((t) => String(t._id) === String(formValues.mailTemplateId));
  const templateBody = template ? getEffectiveTemplateContent(template) : '';
  const { senderMode, senderProfileId } = formValues;

  return {
    title: formValues.title,
    subject: formValues.subject,
    content: templateBody,
    mailTemplateId: formValues.mailTemplateId,
    variableMapping: formValues.variableMapping || {},
    senderProfileId: senderMode === 'single' ? senderProfileId || undefined : undefined,
    senderMode,
    senderProfileIds: [],
    ...(senderMode === 'system_resend' ? {
      systemProvider: 'resend',
      resendFromEmail: formValues.resendFromEmail?.trim().toLowerCase(),
      emailStreamSlug: formValues.emailStreamSlug?.trim().toLowerCase(),
    } : {}),
    includeSignature: formValues.includeSignature,
    signature: formValues.includeSignature ? (formValues.signature || '').trim() : '',
    removeUnsubscribe: !formValues.includeUnsubscribe,
    attachments: (formValues.attachments || []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      storageKey: a.storageKey,
      storageUrl: a.storageUrl,
    })),
    leadIds,
    customRecipients,
  };
}

export function useCampaignSubmit({ approvedTemplates, audience }) {
  const toast = useToast();
  const createCampaignMutation = useCreateCampaign();

  const buildCampaignPayload = useCallback((formValues) => (
    buildCampaignPayloadFromForm(
      formValues,
      approvedTemplates,
      audience.buildMergedRecipients(),
      audience.buildLeadIds?.() || []
    )
  ), [approvedTemplates, audience]);

  const submitCampaign = useCallback(async (formValues, action = 'save_draft', { stayOnPage = false, silent = false } = {}) => {
    if (!audience.audienceHealth.ok) {
      toast.warn(audience.audienceHealth.issues.find((i) => i.severity === 'error')?.message || 'Fix audience issues first.');
      return false;
    }

    const template = approvedTemplates.find((t) => String(t._id) === String(formValues.mailTemplateId));
    const templateBody = template ? getEffectiveTemplateContent(template) : '';
    const payload = { ...buildCampaignPayload(formValues), action };
    const payloadSize = estimateJsonBytes(payload);

    if (payloadSize > PAYLOAD_SAFE_BYTES) {
      toast.error(`Campaign payload too large (${(payloadSize / 1024 / 1024).toFixed(1)}MB). Reduce HTML or image size.`);
      return false;
    }
    if ((templateBody.match(/data:image/gi) || []).length > 3) {
      const proceed = window.confirm('Large inline images detected. Continue anyway?');
      if (!proceed) return false;
    }

    try {
      window.location.assign(buildAutoMailerUrl('/emails/create'));
    } catch (err) {
      if (!silent) {
        toast.error(err.message || 'Could not open Auto-Mailer.');
      }
      return false;
    }

    if (!silent) {
      toast.success(
        action === 'dispatch'
          ? 'Opening Auto-Mailer to finish campaign dispatch.'
          : 'Opening Auto-Mailer to save the campaign draft.'
      );
    }
    if (!stayOnPage) {
      audience.resetAudience();
    }
    return true;
  }, [approvedTemplates, audience, buildCampaignPayload, toast]);

  return { buildCampaignPayload, submitCampaign, createCampaignMutation };
}
