import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { Card, Button, Spinner } from '../../ui';
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
import {
  clearCampaignWizardDraft,
  campaignWizardDraftFingerprint,
  readCampaignWizardDraft,
  writeCampaignWizardDraft,
} from '../../../utils/campaignWizardDraftStorage';

const DRAFT_AUTOSAVE_DEBOUNCE_MS = 5000;

export default function CampaignWizardShell() {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [submittingAction, setSubmittingAction] = useState(null);

  const { data: profiles = [] } = useMailProfiles();
  const {
    data: approvedTemplates = [],
    refetch: refetchApprovedTemplates,
    isFetching: approvedTemplatesFetching,
  } = useMailTemplates('approved');

  const methods = useForm({
    defaultValues: WIZARD_DEFAULTS,
    mode: 'onChange',
  });

  const { watch, setValue, getValues, setError, clearErrors, reset } = methods;
  const draftRestoredRef = useRef(false);
  const lastAutosavedFingerprintRef = useRef(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
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
  const { submitCampaign, createCampaignMutation } = useCampaignSubmit({
    approvedTemplates,
    audience,
    onDraftCommitted: clearCampaignWizardDraft,
  });

  const persistLocalDraft = useCallback((options = {}) => {
    const { silent = true, force = false } = options;
    const payload = {
      formValues: getValues(),
      step,
      audience: audience.getAudienceSnapshot(),
    };
    const fingerprint = campaignWizardDraftFingerprint(payload);
    if (!force && fingerprint === lastAutosavedFingerprintRef.current) {
      return true;
    }
    const ok = writeCampaignWizardDraft(payload);
    if (ok) {
      lastAutosavedFingerprintRef.current = fingerprint;
      setDraftSavedAt(new Date().toISOString());
      if (!silent) toast.success('Draft saved');
    } else if (!silent) {
      toast.warn('Could not save draft locally');
    }
    return ok;
  }, [audience, getValues, step, toast]);

  useEffect(() => {
    if (draftRestoredRef.current) return;
    if (searchParams.get('templateId') || searchParams.get('subject')) return;
    const draft = readCampaignWizardDraft();
    if (!draft?.formValues) return;
    draftRestoredRef.current = true;
    reset({ ...WIZARD_DEFAULTS, ...draft.formValues });
    if (draft.audience) audience.restoreFromSnapshot(draft.audience);
    if (draft.step >= 1 && draft.step <= 4) setStep(draft.step);
    if (draft.savedAt) setDraftSavedAt(draft.savedAt);
    lastAutosavedFingerprintRef.current = campaignWizardDraftFingerprint({
      formValues: draft.formValues,
      step: draft.step,
      audience: draft.audience,
    });
    toast.success('Restored your saved campaign draft');
  }, [audience, reset, searchParams, toast]);

  const watchedForm = watch();
  useEffect(() => {
    if (!draftRestoredRef.current && !watchedForm.title && !watchedForm.subject) return undefined;
    draftRestoredRef.current = true;
    const timer = window.setTimeout(() => {
      persistLocalDraft({ silent: true });
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [watchedForm, step, audience.previewRecipients.length, persistLocalDraft]);

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
    const { stayOnPage = true, silent = false } = options;
    persistLocalDraft({ silent: true, force: true });

    if (step < 4) {
      if (!silent) toast.success('Draft saved — restores after refresh');
      return true;
    }

    const ok = await validateStep(4);
    if (!ok) return false;
    setSubmittingAction('save_draft');
    try {
      return await submitCampaign(getValues(), 'save_draft', { stayOnPage, silent });
    } finally {
      setSubmittingAction(null);
    }
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
    setSubmittingAction('dispatch');
    try {
      await submitCampaign(getValues(), 'dispatch');
    } finally {
      setSubmittingAction(null);
    }
  };

  const isSubmitting = createCampaignMutation.isPending;

  return (
    <FormProvider {...methods}>
      <div className="relative">
        {isSubmitting && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-[var(--color-bg-primary)]/85"
            aria-live="polite"
            aria-busy="true"
          >
            <Spinner size="lg" />
            <p className="text-sm font-medium text-[var(--color-text-muted)]">
              {submittingAction === 'dispatch' ? 'Dispatching campaign…' : 'Saving draft…'}
            </p>
          </div>
        )}
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
        {step === 2 && (
          <StepTemplateSelect
            approvedTemplates={approvedTemplates}
            onRefreshTemplates={refetchApprovedTemplates}
            templatesRefreshing={approvedTemplatesFetching}
            onContinue={handleNext}
          />
        )}
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

        {step !== 2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--color-bg-border)]">
          {step < 4 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={handleNext}>
                Continue
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSaveDraft({ stayOnPage: true, silent: false })}
                disabled={isSubmitting}
              >
                {submittingAction === 'save_draft' ? 'Saving…' : 'Save draft'}
              </Button>
              {draftSavedAt && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Auto-saved {new Date(draftSavedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 ml-auto">
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
              >
                {submittingAction === 'save_draft' ? 'Saving…' : 'Save as Draft'}
              </Button>
              <Button
                variant="primary"
                onClick={handleDispatch}
                disabled={isSubmitting || !audience.audienceHealth.ok}
              >
                {submittingAction === 'dispatch' ? 'Dispatching…' : 'Dispatch Campaign'}
              </Button>
            </div>
          )}
        </div>
        )}
      </Card>
      </div>
    </FormProvider>
  );
}
