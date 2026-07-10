import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { Button, Input } from '../ui';
import {
  getCrmDigestSegmentForProject,
  CRM_DIGEST_PLAN_OPTIONS,
} from '../../utils/crmDigestProjectsClient';

function buildDraft(crmDigest = {}) {
  return {
    monthlyTargetLakhs: crmDigest.monthlyTargetLakhs ?? 0,
    planValues: Object.fromEntries(
      CRM_DIGEST_PLAN_OPTIONS.map((key) => [key, crmDigest.planValues?.[key] ?? 0]),
    ),
  };
}

export default function ProjectCrmDigestSettings({ projectId, project }) {
  const segment = getCrmDigestSegmentForProject(project);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', projectId, 'crm-digest'],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/goals/crm-digest`)).data,
    enabled: !!projectId && !!segment,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => axios.put(`/api/projects/${projectId}/goals/crm-digest`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'crm-digest'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'goals'] });
      setDraft(null);
    },
  });

  if (!segment) return null;

  const canEdit = data?.canEdit;
  const isAcademy = segment.key === 'academy';
  const editing = Boolean(draft);

  return (
    <section className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Target size={16} className="text-[var(--color-brand-teal)]" />
            CRM stats settings
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {segment.label} · used in Admin → CRM Stats
            {isAcademy ? ' (sales conversions + plan values)' : ' (artist conversions)'}
          </p>
        </div>
        {canEdit && !editing && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(buildDraft(data?.crmDigest))}>
            Edit
          </Button>
        )}
      </div>

      {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading digest settings…</p>}
      {error && <p className="text-xs text-rose-400">Could not load CRM digest settings.</p>}

      {!isLoading && !editing && data?.crmDigest && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Monthly target</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">
              {Number(data.crmDigest.monthlyTargetLakhs || 0).toLocaleString('en-IN')} Lakhs
            </p>
          </div>
          {isAcademy && (
            <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Plan values (INR)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CRM_DIGEST_PLAN_OPTIONS.map((plan) => (
                  <div key={plan} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">{plan}</span>
                    <span className="font-semibold">₹{Number(data.crmDigest.planValues?.[plan] || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!canEdit && !isLoading && (
        <p className="text-xs text-[var(--color-text-muted)]">Only admins can change digest targets and plan values.</p>
      )}

      {editing && draft && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({
              monthlyTargetLakhs: Number(draft.monthlyTargetLakhs) || 0,
              planValues: isAcademy ? draft.planValues : undefined,
            });
          }}
        >
          <Input
            label="Monthly target (Lakhs)"
            type="number"
            min="0"
            step="0.1"
            value={draft.monthlyTargetLakhs}
            onChange={(e) => setDraft({ ...draft, monthlyTargetLakhs: e.target.value })}
          />
          {isAcademy && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CRM_DIGEST_PLAN_OPTIONS.map((plan) => (
                <Input
                  key={plan}
                  label={`${plan} plan value (₹)`}
                  type="number"
                  min="0"
                  step="1000"
                  value={draft.planValues[plan]}
                  onChange={(e) => setDraft({
                    ...draft,
                    planValues: { ...draft.planValues, [plan]: e.target.value },
                  })}
                />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save digest settings'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
