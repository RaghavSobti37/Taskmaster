import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives';
import OrgCreateProgress from './create/OrgCreateProgress';
import StepIdentity from './create/steps/StepIdentity';
import StepProfile from './create/steps/StepProfile';
import StepFeatures from './create/steps/StepFeatures';
import StepInvites from './create/steps/StepInvites';
import StepReview from './create/steps/StepReview';
import {
  buildCreateTenantPayload,
  defaultOrgCreateForm,
  slugifyOrgSlug,
} from '../../constants/orgCreateOptions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStep(step, form) {
  if (step === 1) {
    if (!String(form.name || '').trim()) return 'Organization name is required';
    const slug = slugifyOrgSlug(form.slug || form.name);
    if (!slug) return 'Enter a valid URL slug';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return 'Slug can only use lowercase letters, numbers, and hyphens';
  }
  if (step === 2) {
    if (!form.industry) return 'Select an industry';
    if (!form.teamSize) return 'Select a team size';
    if (!form.timezone) return 'Select a timezone';
    if (!form.currency) return 'Select a currency';
  }
  if (step === 3) {
    return '';
  }
  if (step === 4) {
    const rows = form.invites || [];
    for (const row of rows) {
      const email = String(row.email || '').trim();
      if (!email) continue;
      if (!EMAIL_RE.test(email)) return `Invalid email: ${email}`;
      if (!row.role) return 'Choose a role for each email you add';
    }
  }
  return '';
}

export default function CreateOrganizationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultOrgCreateForm);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const goNext = () => {
    const err = validateStep(step, form);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = () => {
    setFieldError('');
    setSubmitError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const skipInvites = () => {
    setForm((prev) => ({ ...prev, invites: [{ email: '', role: '' }] }));
    setFieldError('');
    setStep(5);
  };

  const handleCreate = async () => {
    const err = validateStep(4, form) || validateStep(2, form) || validateStep(1, form);
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError('');
    setLoading(true);
    try {
      const payload = buildCreateTenantPayload(form);
      const { data } = await axios.post('/api/tenants/create', payload, { withCredentials: true });
      const name = data?.tenant?.name || payload.name;
      navigate(`/org/create/success?name=${encodeURIComponent(name)}`, {
        replace: true,
        state: {
          name,
          slug: data?.tenant?.slug || payload.slug,
          tenantId: data?.tenant?._id,
        },
      });
    } catch (e) {
      setSubmitError(e.response?.data?.error || e.message || 'Could not create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Create organization</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Set up a new workspace for your team on CoreKnot.
            </p>
          </div>
          <OrgCreateProgress step={step} />
        </header>

        <main className="flex-1 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-6 sm:p-8">
          {step === 1 && (
            <StepIdentity form={form} setForm={setForm} fieldError={fieldError} setFieldError={setFieldError} />
          )}
          {step === 2 && <StepProfile form={form} setForm={setForm} fieldError={fieldError} />}
          {step === 3 && <StepFeatures form={form} setForm={setForm} />}
          {step === 4 && <StepInvites form={form} setForm={setForm} fieldError={fieldError} />}
          {step === 5 && <StepReview form={form} />}
          {submitError && step === 5 && <p className="mt-4 text-xs text-rose-500">{submitError}</p>}
        </main>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <Button type="button" variant="ghost" onClick={goBack} disabled={loading}>
                Back
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step === 4 && (
              <Button type="button" variant="secondary" onClick={skipInvites} disabled={loading}>
                Skip for now
              </Button>
            )}
            {step < 5 ? (
              <Button type="button" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating…' : 'Create organization'}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
