import { formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, ExternalLink, X } from 'lucide-react';
import { Button, Input } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { getProjectRoleForUser } from '../../constants/taskOptions';
import { useArtists } from '../../hooks/queries/artists';
import {
  PROJECT_GOAL_METRIC_KEYS,
  PROJECT_GOAL_METRIC_LABELS,
} from '../../utils/projectGoalMetrics';
import ProjectGoalMetricCards, { ProjectGoalMetricCardsSkeleton } from './ProjectGoalMetricCards';
import ProjectCrmDigestSettings from './ProjectCrmDigestSettings';

function KeywordInput({ label, hint, values, onChange }) {
  const [text, setText] = useState('');

  const add = () => {
    const next = text.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setText('');
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">{label}</span>
      {hint && <p className="text-[9px] text-[var(--color-text-muted)]">{hint}</p>}
      <div className="flex gap-2">
        <Input
          value={text}
          placeholder="Add keyword…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]"
            >
              {kw}
              <button
                type="button"
                className="text-[var(--color-text-muted)] hover:text-rose-400"
                onClick={() => onChange(values.filter((v) => v !== kw))}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildDraft(goal) {
  return {
    endDate: goal.endDate ? goal.endDate.slice(0, 10) : '',
    targets: Object.fromEntries(
      PROJECT_GOAL_METRIC_KEYS.map((key) => [key, { target: goal.targets?.[key]?.target ?? 0 }])
    ),
    sourceLinks: {
      artistIds: (goal.sourceLinks?.artistIds || []).map(String),
      offeringIds: (goal.sourceLinks?.offeringIds || []).map(String),
      offeringKeywords: goal.sourceLinks?.offeringKeywords || [],
      leadKeywords: goal.sourceLinks?.leadKeywords || [],
      referenceUrls: (goal.sourceLinks?.referenceUrls || []).map((r) => ({
        _id: r._id,
        label: r.label,
        url: r.url,
      })),
    },
    metricOverrides: Object.fromEntries(
      PROJECT_GOAL_METRIC_KEYS.map((key) => [
        key,
        {
          enabled: goal.metricOverrides?.[key]?.enabled ?? false,
          value: goal.metricOverrides?.[key]?.value ?? 0,
        },
      ])
    ),
  };
}

export default function ProjectGoalsPanel({ projectId, project, startInEdit = false }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = getProjectRoleForUser(project, user?._id);
  const canEdit = isAdminUser(user) || role === 'admin' || role === 'manager';

  const { data, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'goals'],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/goals`)).data,
    enabled: !!projectId,
  });

  const { data: artists = [] } = useArtists();

  const [draft, setDraft] = useState(null);
  const [newRef, setNewRef] = useState({ label: '', url: '' });

  useEffect(() => {
    if (startInEdit && canEdit && data?.goal && !draft) {
      setDraft(buildDraft(data.goal));
    }
  }, [startInEdit, canEdit, data?.goal, draft]);

  const saveMutation = useMutation({
    mutationFn: (payload) => axios.put(`/api/projects/${projectId}/goals`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'goals'] });
      setDraft(null);
    },
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <ProjectGoalMetricCardsSkeleton />
      </div>
    );
  }

  const goal = data?.goal || {};
  const progress = data?.progress || {};
  const weekly = data?.weekly;
  const history = data?.history || [];
  const linkedArtists = data?.linkedArtists || [];
  const linkedOfferings = data?.linkedOfferings || [];
  const exlyOfferings = data?.exlyOfferings || [];
  const sourceLinks = goal.sourceLinks || {};

  const startEdit = () => setDraft(buildDraft(goal));

  const updateSourceLinks = (patch) => {
    setDraft((prev) => ({
      ...prev,
      sourceLinks: { ...prev.sourceLinks, ...patch },
    }));
  };

  const addReferenceUrl = () => {
    const label = newRef.label.trim();
    const url = newRef.url.trim();
    if (!label || !url) return;
    updateSourceLinks({
      referenceUrls: [...(draft.sourceLinks.referenceUrls || []), { label, url }],
    });
    setNewRef({ label: '', url: '' });
  };

  const availableArtists = artists.filter(
    (a) => !(draft?.sourceLinks?.artistIds || []).includes(String(a._id))
  );

  const availableOfferings = exlyOfferings.filter(
    (o) => !(draft?.sourceLinks?.offeringIds || []).includes(String(o.offeringId))
  );

  return (
    <div className="space-y-6 p-4">
      <ProjectCrmDigestSettings projectId={projectId} project={project} />
      <div className="flex items-center justify-end gap-3">
        {canEdit && !draft && (
          <Button variant="secondary" size="sm" onClick={startEdit}>Edit goals & links</Button>
        )}
        {canEdit && draft && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
              Save
            </Button>
          </div>
        )}
      </div>

      {draft && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border border-[var(--color-bg-border)] rounded-xl">
            <label className="space-y-1 sm:col-span-2 lg:col-span-3">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">End date (optional)</span>
              <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
            </label>
            {PROJECT_GOAL_METRIC_KEYS.map((key) => (
              <label key={key} className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">{PROJECT_GOAL_METRIC_LABELS[key].label} target</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.targets[key]?.target ?? 0}
                  onChange={(e) => setDraft({
                    ...draft,
                    targets: {
                      ...draft.targets,
                      [key]: { target: Number(e.target.value) || 0 },
                    },
                  })}
                />
              </label>
            ))}
          </div>

          <div className="p-4 border border-[var(--color-bg-border)] rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Analytics links</span>
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)]">
              Link Exly offerings and CRM data to this project. Sales and leads auto-count from linked offerings.
            </p>

            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">Exly offerings</span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(draft.sourceLinks.offeringIds || []).map((offeringId) => {
                  const offering = exlyOfferings.find((o) => String(o.offeringId) === offeringId)
                    || linkedOfferings.find((o) => String(o.offeringId) === offeringId);
                  return (
                    <span
                      key={offeringId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]"
                    >
                      {offering?.title || offeringId}
                      <button
                        type="button"
                        className="text-[var(--color-text-muted)] hover:text-rose-400"
                        onClick={() => updateSourceLinks({
                          offeringIds: draft.sourceLinks.offeringIds.filter((x) => x !== offeringId),
                        })}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {availableOfferings.length > 0 ? (
                <select
                  className="w-full text-[11px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1.5"
                  defaultValue=""
                  onChange={(e) => {
                    const offeringId = e.target.value;
                    if (!offeringId) return;
                    updateSourceLinks({
                      offeringIds: [...(draft.sourceLinks.offeringIds || []), offeringId],
                    });
                    e.target.value = '';
                  }}
                >
                  <option value="">Add Exly offering…</option>
                  {availableOfferings.map((o) => (
                    <option key={o.offeringId} value={String(o.offeringId)}>
                      {o.title}{o.eventDate ? ` · ${o.eventDate}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[9px] text-[var(--color-text-muted)]">No Exly offerings in database — sync Exly first.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">Linked artists</span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(draft.sourceLinks.artistIds || []).map((id) => {
                  const artist = artists.find((a) => String(a._id) === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]"
                    >
                      {artist?.name || id}
                      <button
                        type="button"
                        className="text-[var(--color-text-muted)] hover:text-rose-400"
                        onClick={() => updateSourceLinks({
                          artistIds: draft.sourceLinks.artistIds.filter((x) => x !== id),
                        })}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {availableArtists.length > 0 && (
                <select
                  className="w-full text-[11px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1.5"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    updateSourceLinks({
                      artistIds: [...(draft.sourceLinks.artistIds || []), id],
                    });
                    e.target.value = '';
                  }}
                >
                  <option value="">Add artist…</option>
                  {availableArtists.map((a) => (
                    <option key={a._id} value={String(a._id)}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>

            <KeywordInput
              label="Exly offering keywords (optional)"
              hint="Extra title/owner keyword matches beyond linked offerings"
              values={draft.sourceLinks.offeringKeywords || []}
              onChange={(offeringKeywords) => updateSourceLinks({ offeringKeywords })}
            />

            <KeywordInput
              label="CRM lead keywords"
              hint="Matches lead source, tags, or Exly offering title"
              values={draft.sourceLinks.leadKeywords || []}
              onChange={(leadKeywords) => updateSourceLinks({ leadKeywords })}
            />

            <div className="space-y-2">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">Reference links</span>
              {(draft.sourceLinks.referenceUrls || []).map((row, idx) => (
                <div key={row._id || idx} className="flex items-center gap-2 text-[10px]">
                  <span className="font-medium truncate">{row.label}</span>
                  <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-400 truncate flex-1">{row.url}</a>
                  <button
                    type="button"
                    className="text-[var(--color-text-muted)] hover:text-rose-400 shrink-0"
                    onClick={() => updateSourceLinks({
                      referenceUrls: draft.sourceLinks.referenceUrls.filter((_, i) => i !== idx),
                    })}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Label"
                  value={newRef.label}
                  onChange={(e) => setNewRef({ ...newRef, label: e.target.value })}
                />
                <Input
                  placeholder="https://…"
                  value={newRef.url}
                  onChange={(e) => setNewRef({ ...newRef, url: e.target.value })}
                  className="sm:col-span-2"
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addReferenceUrl}>Add link</Button>
            </div>
          </div>

          <div className="p-4 border border-[var(--color-bg-border)] rounded-xl space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest">Manual overrides</span>
            <p className="text-[9px] text-[var(--color-text-muted)]">
              Replace auto-synced values with a fixed number when data is incomplete or off-platform.
            </p>
            {PROJECT_GOAL_METRIC_KEYS.map((key) => (
              <div key={key} className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[10px] min-w-[140px]">
                  <input
                    type="checkbox"
                    checked={draft.metricOverrides[key]?.enabled ?? false}
                    onChange={(e) => setDraft({
                      ...draft,
                      metricOverrides: {
                        ...draft.metricOverrides,
                        [key]: {
                          ...draft.metricOverrides[key],
                          enabled: e.target.checked,
                        },
                      },
                    })}
                  />
                  {PROJECT_GOAL_METRIC_LABELS[key].label}
                </label>
                <Input
                  type="number"
                  min={0}
                  disabled={!draft.metricOverrides[key]?.enabled}
                  value={draft.metricOverrides[key]?.value ?? 0}
                  className="max-w-[160px]"
                  onChange={(e) => setDraft({
                    ...draft,
                    metricOverrides: {
                      ...draft.metricOverrides,
                      [key]: {
                        ...draft.metricOverrides[key],
                        value: Number(e.target.value) || 0,
                      },
                    },
                  })}
                />
                {progress[key]?.auto != null && (
                  <span className="text-[9px] text-[var(--color-text-muted)]">
                    Auto: {PROJECT_GOAL_METRIC_LABELS[key].format(progress[key].auto)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!draft && (linkedArtists.length > 0 || linkedOfferings.length > 0 || sourceLinks.offeringKeywords?.length || sourceLinks.leadKeywords?.length || sourceLinks.referenceUrls?.length) && (
        <div className="p-4 border border-[var(--color-bg-border)] rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Analytics links</span>
          </div>
          {linkedOfferings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)] w-full">Exly offerings</span>
              {linkedOfferings.map((o) => (
                <span key={o.offeringId} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">{o.title}</span>
              ))}
            </div>
          )}
          {linkedArtists.length > 0 && (
            <div className="text-[10px]">
              <span className="text-[var(--color-text-muted)] uppercase font-bold text-[9px]">Artists: </span>
              {linkedArtists.map((a) => a.name).join(', ')}
            </div>
          )}
          {sourceLinks.offeringKeywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)] w-full">Exly keywords</span>
              {sourceLinks.offeringKeywords.map((kw) => (
                <span key={kw} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">{kw}</span>
              ))}
            </div>
          )}
          {sourceLinks.leadKeywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)] w-full">Lead keywords</span>
              {sourceLinks.leadKeywords.map((kw) => (
                <span key={kw} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">{kw}</span>
              ))}
            </div>
          )}
          {sourceLinks.referenceUrls?.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">Reference links</span>
              {sourceLinks.referenceUrls.map((row) => (
                <a
                  key={row._id || row.url}
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:underline"
                >
                  <ExternalLink size={11} />
                  {row.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {goal.endDate && (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Goal deadline: {formatWeekdayDateLong(new Date(goal.endDate))}
        </p>
      )}

      {!draft && (
        <ProjectGoalMetricCards progress={progress} weekly={weekly} history={history} />
      )}
    </div>
  );
}
