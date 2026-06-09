import React, { useState } from 'react';
import { Zap, Plus, Edit, Trash2, Mail } from 'lucide-react';
import { Card, Button, Input } from '../ui';
import {
  useCreateMailProfile,
  useDeleteMailProfile,
  useUpdateMailProfile,
} from '../../hooks/useTaskmasterQueries';
import { SMTP_PRESETS, getProfileRotationProviders } from '../../utils/smtpPresets';
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
});

/** Gmail or Google Workspace — both use smtp.gmail.com + app password */
const isGoogleMailbox = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return false;
  if (/@(gmail|googlemail)\.com$/i.test(addr)) return true;
  if (/@theshakticollective\.in$/i.test(addr)) return true;
  return false;
};

export default function MailProfilesPanel({ profiles = [] }) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const createProfileMutation = useCreateMailProfile();
  const updateProfileMutation = useUpdateMailProfile();
  const deleteProfileMutation = useDeleteMailProfile();

  const [newProfile, setNewProfile] = useState(emptyProfile());
  const [smtpLoginMatchesFrom, setSmtpLoginMatchesFrom] = useState(true);
  const [editingProfileId, setEditingProfileId] = useState(null);

  const resetForm = () => {
    setEditingProfileId(null);
    setNewProfile(emptyProfile());
    setSmtpLoginMatchesFrom(true);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfile.name || !newProfile.email) {
      toast.warn('Fill in profile name and From email.');
      return;
    }
    const login = (smtpLoginMatchesFrom ? newProfile.email : newProfile.smtpUser || '').trim();
    if (!isGoogleMailbox(login)) {
      toast.warn('Use a @gmail.com or @theshakticollective.in Google Workspace address with a Gmail app password.');
      return;
    }
    if (!newProfile.smtpPass && !editingProfileId) {
      toast.warn('Add a Gmail app password.');
      return;
    }
    const payload = {
      ...newProfile,
      smtpUser: login,
      rotationEnabled: false,
      providerType: 'gmail',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      dailyLimit: SMTP_PRESETS.gmail.dailyLimit,
      providerCredentials: {},
    };
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
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
        <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 flex items-center gap-2">
            <Mail size={14} /> Resend (recommended for campaigns)
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
            Verified domain <strong>theshakticollective.in</strong> sends via Resend API.
            Set <code className="font-mono text-[9px]">RESEND_API_KEY</code> on the API service, then pick the from address
            (artist@, helloworld@, harshika@, or add another) in the campaign wizard.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
            <Zap size={16} /> {editingProfileId ? 'Edit Gmail Profile' : 'Gmail Profile'}
          </h3>
          {editingProfileId && (
            <Button size="xs" variant="ghost" onClick={resetForm}>
              Cancel Edit
            </Button>
          )}
        </div>
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div className="p-3 rounded-xl border border-[var(--color-action-primary)]/30 bg-[var(--color-action-primary)]/5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">Gmail app password</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Google Account → Security → 2-Step Verification ON → App passwords → create &quot;Mail&quot; password.
              Works for <strong>@gmail.com</strong> and <strong>@theshakticollective.in</strong> Workspace mailboxes via <strong>smtp.gmail.com</strong> (500/day).
              Same profile can also be picked as the Resend &quot;from&quot; identity in the campaign wizard.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">Sender Identity</p>
            <Input label="Profile Name" placeholder="e.g. TSC Gmail" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })} />
            <Input
              label="From Email Address"
              placeholder="artist@theshakticollective.in"
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
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">Gmail Credentials</p>
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
              label="Gmail Login"
              placeholder="artist@theshakticollective.in"
              value={smtpLoginMatchesFrom ? newProfile.email : newProfile.smtpUser}
              disabled={smtpLoginMatchesFrom}
              onChange={e => setNewProfile({ ...newProfile, smtpUser: e.target.value })}
            />
            <Input
              label="Gmail App Password"
              type="password"
              placeholder={editingProfileId ? 'Leave blank to keep saved password' : '16-character app password'}
              value={newProfile.smtpPass}
              onChange={e => setNewProfile({ ...newProfile, smtpPass: e.target.value })}
            />
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
            <Plus size={14} /> {editingProfileId ? 'Update Gmail Profile' : 'Save Gmail Profile'}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Active Gmail Profiles ({profiles.length})</h3>
        {profiles.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] p-4 rounded-xl border border-dashed border-[var(--color-bg-border)]">
            No Gmail profiles yet. Campaigns can still send via Resend once API env vars are set.
          </p>
        )}
        {profiles.map(p => {
          const pct = p.usage?.percent || 0;
          return (
            <Card key={p._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold uppercase tracking-tight text-xs block">{p.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono block">From: {p.email}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono block">Gmail: {p.smtpUser}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)] uppercase">
                    Provider: {getProfileRotationProviders(p).map((k) => SMTP_PRESETS[k]?.label || k).join(', ') || 'Gmail'}
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
                        title: 'Delete Gmail profile?',
                        message: `Remove "${p.name}"? Campaigns using this profile may fail to resend.`,
                        confirmLabel: 'Delete',
                        variant: 'danger',
                      });
                      if (!ok) return;
                      await deleteProfileMutation.mutateAsync(p._id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {p.usage && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                    <span>Today</span>
                    <span className={pct >= 80 ? 'text-amber-500 font-bold' : ''}>{p.usage.used}/{p.usage.limit}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-action-primary)]'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-[var(--color-text-muted)]">{formatProfileResetTime(p.usage.resetAt)}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
