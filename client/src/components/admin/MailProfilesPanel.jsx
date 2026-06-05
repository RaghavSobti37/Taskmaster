import React, { useState } from 'react';
import { Zap, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, Button, Input } from '../ui';
import {
  useCreateMailProfile,
  useDeleteMailProfile,
  useUpdateMailProfile,
} from '../../hooks/useTaskmasterQueries';
import {
  SMTP_PRESETS,
  ADDITIONAL_ROTATION_PROVIDERS,
  SMTP_AUTH_HINTS,
  inferProviderFromEmail,
  getProfileRotationProviders,
  emptyProviderCredentials,
} from '../../utils/smtpPresets';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';

export function formatProfileResetTime(iso) {
  if (!iso) return 'Resets daily at 12:00 AM UTC';
  try {
    return `Resets ${new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
  } catch {
    return 'Resets daily at 12:00 AM UTC';
  }
}

const emptyProfile = () => ({
  name: '',
  email: '',
  smtpUser: '',
  smtpPass: '',
  signature: '',
  rotationEnabled: true,
});

export default function MailProfilesPanel({ profiles = [] }) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const createProfileMutation = useCreateMailProfile();
  const updateProfileMutation = useUpdateMailProfile();
  const deleteProfileMutation = useDeleteMailProfile();

  const [newProfile, setNewProfile] = useState(emptyProfile());
  const [providerCredentials, setProviderCredentials] = useState(emptyProviderCredentials());
  const [smtpLoginMatchesFrom, setSmtpLoginMatchesFrom] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);

  const resetForm = () => {
    setEditingProfileId(null);
    setNewProfile(emptyProfile());
    setProviderCredentials(emptyProviderCredentials());
    setSmtpLoginMatchesFrom(false);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfile.name || !newProfile.email) {
      toast.warn('Fill in profile name and From email.');
      return;
    }
    const hasPrimary = newProfile.smtpUser && newProfile.smtpPass;
    const hasExtra = Object.values(providerCredentials).some((c) => c.enabled && c.smtpPass);
    if (!hasPrimary && !hasExtra) {
      toast.warn('Add primary SMTP credentials (Gmail etc.) or enable at least one additional provider with its key.');
      return;
    }
    const payload = { ...newProfile, rotationEnabled: true, providerCredentials };
    if (editingProfileId) {
      await updateProfileMutation.mutateAsync({ id: editingProfileId, ...payload });
      setEditingProfileId(null);
    } else {
      await createProfileMutation.mutateAsync(payload);
    }
    resetForm();
  };

  const startEditProfile = (p) => {
    setEditingProfileId(p._id);
    const loginMatches = p.smtpUser && p.email && p.smtpUser.toLowerCase() === p.email.toLowerCase();
    setSmtpLoginMatchesFrom(!!loginMatches);
    setNewProfile({
      name: p.name,
      email: p.email,
      smtpUser: p.smtpUser,
      smtpPass: '',
      signature: p.signature || '',
      rotationEnabled: true,
    });
    const existing = emptyProviderCredentials();
    const saved = p.providerCredentials || {};
    for (const key of ADDITIONAL_ROTATION_PROVIDERS) {
      const s = saved[key];
      if (s) {
        existing[key] = {
          smtpUser: s.smtpUser || SMTP_AUTH_HINTS[key]?.userDefault || '',
          smtpPass: '',
          enabled: s.enabled !== false && !!s.smtpPass,
        };
      }
    }
    setProviderCredentials(existing);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
            <Zap size={16} /> {editingProfileId ? 'Edit SMTP Profile' : 'Configure SMTP Profile'}
          </h3>
          {editingProfileId && (
            <Button size="xs" variant="ghost" onClick={resetForm}>
              Cancel Edit
            </Button>
          )}
        </div>
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div className="p-3 rounded-xl border border-[var(--color-action-primary)]/30 bg-[var(--color-action-primary)]/5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">SMTP Provider (auto-detected)</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Credentials only work on the matching mail server. Gmail app password → <strong>smtp.gmail.com</strong> only.
              Brevo/SendGrid/Mailjet each need a separate free account + their own SMTP key.
            </p>
            {newProfile.smtpUser && inferProviderFromEmail(newProfile.smtpUser) && (
              <p className="text-[10px] font-bold text-emerald-600">
                Detected: {SMTP_PRESETS[inferProviderFromEmail(newProfile.smtpUser)]?.label} ({SMTP_PRESETS[inferProviderFromEmail(newProfile.smtpUser)]?.smtpHost})
              </p>
            )}
            <details className="text-[10px] text-[var(--color-text-muted)]">
              <summary className="cursor-pointer font-bold text-[var(--color-action-primary)]">Need more daily sends? Sign up for free SMTP tiers</summary>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li><strong>Gmail</strong> — Google Account → Security → 2-Step ON → App passwords → create &quot;Mail&quot; password</li>
                <li><strong>Brevo</strong> — brevo.com free → SMTP &amp; API → generate SMTP key (login = your Brevo email)</li>
                <li><strong>SendGrid</strong> — sendgrid.com free → Settings → API Keys → SMTP: user <code>apikey</code>, pass = API key</li>
                <li><strong>Mailjet</strong> — mailjet.com → SMTP credentials in account settings</li>
              </ul>
              <p className="mt-2">Enable each provider below with its own SMTP credentials — campaigns rotate across all enabled providers.</p>
            </details>
          </div>

          <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">Sender Identity</p>
            <Input label="Profile Name" placeholder="e.g. TSC Marketing" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })} />
            <Input
              label="From Email Address"
              placeholder="e.g. hello@yourdomain.com"
              value={newProfile.email}
              onChange={e => {
                const email = e.target.value;
                setNewProfile(prev => ({
                  ...prev,
                  email,
                  smtpUser: smtpLoginMatchesFrom ? email : prev.smtpUser,
                }));
              }}
            />
          </div>

          <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">SMTP Credentials</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Primary mail account (Gmail, Outlook, etc.) — used for auto-detected provider.</p>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={smtpLoginMatchesFrom}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSmtpLoginMatchesFrom(checked);
                  if (checked && newProfile.email) {
                    setNewProfile(prev => ({ ...prev, smtpUser: prev.email }));
                  }
                }}
              />
              SMTP login same as From email
            </label>
            <Input
              label="SMTP Login Email"
              placeholder="e.g. youraccount@gmail.com"
              value={newProfile.smtpUser}
              disabled={smtpLoginMatchesFrom}
              onChange={e => setNewProfile({ ...newProfile, smtpUser: e.target.value })}
            />
            <Input
              label="SMTP App Password"
              type="password"
              placeholder="16-character app password"
              value={newProfile.smtpPass}
              onChange={e => setNewProfile({ ...newProfile, smtpPass: e.target.value })}
            />
          </div>
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Multi-provider rotation</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Primary credentials above = Gmail/Outlook/etc (auto-detected). Enable providers below with <strong>their own</strong> SMTP login + key.
              Campaigns rotate only across enabled providers with saved credentials.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3 max-h-[420px] overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)] sticky top-0 bg-[var(--color-bg-secondary)] py-1">
              Additional SMTP providers ({ADDITIONAL_ROTATION_PROVIDERS.length})
            </p>
            {ADDITIONAL_ROTATION_PROVIDERS.map((key) => {
              const preset = SMTP_PRESETS[key];
              const hint = SMTP_AUTH_HINTS[key];
              const cred = providerCredentials[key] || { smtpUser: hint?.userDefault || '', smtpPass: '', enabled: false };
              return (
                <div key={key} className={`p-3 rounded-lg border ${cred.enabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[var(--color-bg-border)]'} space-y-2`}>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cred.enabled}
                      onChange={(e) => setProviderCredentials((prev) => ({
                        ...prev,
                        [key]: { ...cred, enabled: e.target.checked },
                      }))}
                    />
                    {preset?.label} <span className="font-mono text-[9px] opacity-60">({preset?.smtpHost})</span>
                    <span className="text-[9px] text-[var(--color-text-muted)] ml-auto">{preset?.dailyLimit}/day</span>
                  </label>
                  {cred.enabled && (
                    <>
                      <Input
                        label={hint?.userLabel || 'SMTP login'}
                        placeholder={hint?.userPlaceholder || ''}
                        value={cred.smtpUser}
                        onChange={(e) => setProviderCredentials((prev) => ({
                          ...prev,
                          [key]: { ...cred, smtpUser: e.target.value },
                        }))}
                      />
                      <Input
                        label={hint?.passLabel || 'SMTP password / API key'}
                        type="password"
                        placeholder={editingProfileId ? 'Leave blank to keep saved key' : ''}
                        value={cred.smtpPass}
                        onChange={(e) => setProviderCredentials((prev) => ({
                          ...prev,
                          [key]: { ...cred, smtpPass: e.target.value },
                        }))}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">Default HTML Signature</p>
            <textarea
              className="w-full h-32 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none"
              placeholder="Enter HTML Signature template here..."
              value={newProfile.signature}
              onChange={e => setNewProfile({ ...newProfile, signature: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={createProfileMutation.isPending || updateProfileMutation.isPending} className="w-full">
            <Plus size={14} /> {editingProfileId ? 'Update Profile' : 'Save SMTP Profile'}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Active Configurations ({profiles.length})</h3>
        {profiles.map(p => {
          const pct = p.usage?.percent || 0;
          const rotationProviders = p.usage?.rotation?.providers || [];
          return (
            <Card key={p._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold uppercase tracking-tight text-xs block">{p.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono block">From: {p.email}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono block">SMTP login: {p.smtpUser}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)] uppercase">
                    Rotates: {getProfileRotationProviders(p).map((k) => SMTP_PRESETS[k]?.label || k).join(', ') || 'none configured'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-500 hover:bg-amber-500/10"
                    onClick={() => startEditProfile(p)}
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-500/10"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete SMTP profile?',
                        message: `Remove "${p.name}"? Campaigns using this profile may fail to resend.`,
                        confirmLabel: 'Delete',
                        type: 'danger',
                      });
                      if (ok) deleteProfileMutation.mutate(p._id);
                    }}
                    disabled={deleteProfileMutation.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                  <span>Combined daily usage</span>
                  <span className={pct >= 80 ? 'text-amber-500 font-bold' : ''}>{p.usage?.used ?? 0}/{p.usage?.limit ?? 0}</span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-action-primary)]'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-[var(--color-text-muted)]">{formatProfileResetTime(p.usage?.resetAt)}</span>
              </div>
              {rotationProviders.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--color-bg-border)] max-h-48 overflow-y-auto">
                  {rotationProviders.map((prov) => (
                    <div key={prov.providerKey} className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-[var(--color-text-muted)]">
                        <span>{prov.label} <span className="font-mono opacity-60">({prov.smtpHost})</span></span>
                        <span className={prov.percent >= 80 ? 'text-amber-500 font-bold' : ''}>{prov.used}/{prov.limit}</span>
                      </div>
                      <div className="h-1 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${prov.percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500/70'}`} style={{ width: `${prov.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {profiles.length === 0 && (
          <div className="p-12 text-center opacity-30 border border-dashed border-[var(--color-bg-border)] rounded-2xl">
            <Zap size={32} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No profiles configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
