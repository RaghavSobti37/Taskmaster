import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEffectiveTemplateContent } from '../../../utils/indexedTemplateVariables';
import { estimateJsonBytes, PAYLOAD_SAFE_BYTES } from '../../../utils/smtpPresets';
import { useCreateCampaign } from '../../../hooks/useTaskmasterQueries';
import { useToast } from '../../../contexts/ToastContext';

export function buildCampaignPayloadFromForm(formValues, approvedTemplates, customRecipients, leadIds = []) {
  const template = approvedTemplates.find((t) => String(t._id) === String(formValues.mailTemplateId));
  const templateBody = template ? getEffectiveTemplateContent(template) : '';
  const { senderMode, senderProfileId, senderProfileIds } = formValues;

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

export function useCampaignSubmit({ approvedTemplates, audience, onDraftCommitted }) {
  const toast = useToast();
  const navigate = useNavigate();
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

    let response;
    try {
      response = await createCampaignMutation.mutateAsync(payload);
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.error || err.message || 'Campaign save failed.');
      }
      return false;
    }
    const campaign = response?.data ?? response;
    const campaignId = campaign?.campaignId || campaign?._id;

    if (!silent) {
      const queued = campaign?.dispatch?.queuedCount;
      if (action === 'dispatch') {
        toast.success(
          queued != null
            ? `Dispatch started — ${queued} email(s) queue in background. Track progress on the campaign page.`
            : 'Dispatch started — emails send in the background. Track progress on the campaign page.',
        );
      } else {
        toast.success('Campaign saved as draft.');
      }
    }
    onDraftCommitted?.();
    if (!stayOnPage) {
      audience.resetAudience();
      if (action === 'dispatch' && campaignId) {
        navigate(`/campaign/${campaignId}`, { state: { from: '/emails/create' } });
      } else {
        navigate('/emails/campaigns');
      }
    }
    return true;
  }, [approvedTemplates, audience, buildCampaignPayload, createCampaignMutation, navigate, onDraftCommitted, toast]);

  return { buildCampaignPayload, submitCampaign, createCampaignMutation };
}
