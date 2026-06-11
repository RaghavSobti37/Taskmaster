import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { Card, Button } from '../../ui';
import WizardProgressBar from './WizardProgressBar';
import StepSetup from './StepSetup';
import StepTemplateSelect from './StepTemplateSelect';
import StepAudienceMapping from './StepAudienceMapping';
import StepPreflight from './StepPreflight';
import { useCampaignAudience } from './useCampaignAudience';
import { useCampaignSubmit } from './useCampaignSubmit';
import {
  WIZARD_DEFAULTS, validateVariableMappingComplete,
  step1Schema, step2Schema, step4Schema,
} from '../../../validation/campaignWizardSchema';
import {
  parseIndexedVariablesFromHtml, getEffectiveTemplateContent,
} from '../../../utils/indexedTemplateVariables';
import { useMailProfiles, useMailTemplates } from '../../../hooks/useTaskmasterQueries';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';

export default function CampaignWizardShell() {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);

  const { data: profiles = [] } = useMailProfiles();
  const { data: approvedTemplates = [] } = useMailTemplates('approved');

  const methods = useForm({
    defaultValues: WIZARD_DEFAULTS,
    mode: 'onChange',
  });

  const { watch, setValue, getValues, setError, clearErrors } = methods;
  const mailTemplateId = watch('mailTemplateId');
  const variableMapping = watch('variableMapping');

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => String(t._id) === String(mailTemplateId)),
    [approvedTemplates, mailTemplateId]
  );

  const templateBody = useMemo(
    () => (selectedTemplate ? getEffectiveTemplateContent(selectedTemplate) : ''),
    [selectedTemplate]
  );

  const subject = watch('subject');
  const templateIndices = useMemo(
    () => parseIndexedVariablesFromHtml(`${templateBody}${subject}`),
    [templateBody, subject]
  );

  const audience = useCampaignAudience({ templateIndices, variableMapping });
  const { submitCampaign, createCampaignMutation } = useCampaignSubmit({ approvedTemplates, audience });

  useEffect(() => {
    const templateId = searchParams.get('templateId');
    const seedSubject = searchParams.get('subject');
    if (templateId) setValue('mailTemplateId', templateId);
    // URLSearchParams.get already decodes; second decodeURIComponent throws on literals like "50% off"
    if (seedSubject) setValue('subject', seedSubject);
  }, [searchParams, setValue]);

  const validateStep = async (stepNum) => {
    const values = getValues();
    clearErrors();

    if (stepNum === 1) {
      const result = step1Schema.safeParse(values);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const field = issue.path[0];
          if (field) setError(field, { message: issue.message });
        });
        const first = result.error.issues[0];
        const fieldLabel = { title: 'Campaign name', subject: 'Email subject', resendFromEmail: 'From address', senderProfileId: 'Gmail profile', senderMode: 'Send via' }[first?.path?.[0]] || first?.path?.[0];
        toast.warn(first?.message?.includes('expected string')
          ? `${fieldLabel || 'A required field'} was not saved — re-type it and try again`
          : (first?.message || 'Complete setup fields.'));
        return false;
      }
    }

    if (stepNum === 2) {
      const result = step2Schema.safeParse(values);
      if (!result.success) {
        toast.warn('Select an approved template.');
        return false;
      }
    }

    if (stepNum === 3) {
      if (audience.previewRecipients.length === 0) {
        toast.warn('Add at least one recipient.');
        return false;
      }
      const mappingCheck = validateVariableMappingComplete(templateIndices, variableMapping);
      if (!mappingCheck.ok) {
        toast.warn(`Map all variables: ${mappingCheck.missing.map((i) => `{${i}}`).join(', ')}`);
        return false;
      }
      if (!audience.audienceHealth.ok) {
        toast.warn(audience.audienceHealth.issues.find((i) => i.severity === 'error')?.message || 'Fix audience issues.');
        return false;
      }
    }

    if (stepNum === 4) {
      const result = step4Schema.safeParse(values);
      if (!result.success) {
        toast.warn('Review pre-flight settings.');
        return false;
      }
    }

    return true;
  };

  const handleNext = async () => {
    const ok = await validateStep(step);
    if (!ok) return;
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/emails/campaigns');
      return;
    }
    setStep((s) => s - 1);
  };

  const handleSaveDraft = async (options = {}) => {
    const { stayOnPage = false, silent = false } = options;
    const ok = await validateStep(4);
    if (!ok) return false;
    return submitCampaign(getValues(), 'save_draft', { stayOnPage, silent });
  };

  const handleDispatch = async () => {
    const ok = await validateStep(4);
    if (!ok) return;
    const values = getValues();
    if (values.includeSignature && !(values.signature || '').trim()) {
      toast.warn('Save sender signature before dispatching');
      return;
    }
    if (values.includeSignature && !values.signatureSaved) {
      toast.warn('Click Save signature so the preview matches what will be sent');
      return;
    }
    const confirmed = await confirm({
      title: 'Dispatch campaign?',
      message: `Send to ${audience.audienceHealth.validCount} valid recipient(s)? This cannot be undone.`,
      confirmLabel: 'Dispatch',
      type: 'primary',
    });
    if (!confirmed) return;
    await submitCampaign(getValues(), 'dispatch');
  };

  return (
    <FormProvider {...methods}>
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft size={14} /> {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Step {step} of 4
          </span>
        </div>

        <WizardProgressBar currentStep={step} onStepClick={(s) => setStep(s)} />

        {step === 1 && <StepSetup profiles={profiles} />}
        {step === 2 && <StepTemplateSelect approvedTemplates={approvedTemplates} />}
        {step === 3 && (
          <StepAudienceMapping
            audience={audience}
            approvedTemplates={approvedTemplates}
            templateIndices={templateIndices}
          />
        )}
        {step === 4 && (
          <StepPreflight
            audience={audience}
            approvedTemplates={approvedTemplates}
            templateBody={templateBody}
            profiles={profiles}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--color-bg-border)]">
          {step < 4 ? (
            <Button variant="primary" onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2 ml-auto">
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={createCampaignMutation.isPending}
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                onClick={handleDispatch}
                disabled={createCampaignMutation.isPending || !audience.audienceHealth.ok}
              >
                Dispatch Campaign
              </Button>
            </div>
          )}
        </div>
      </Card>
    </FormProvider>
  );
}
