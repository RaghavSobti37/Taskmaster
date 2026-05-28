import React, { useMemo, useState } from 'react';
import { PageContainer, PageHeader, Card, Input, Button } from '../../components/ui';
import { useAnnouncementTargets, useAnnouncements, useCreateAnnouncement } from '../../hooks/useTaskmasterQueries';

const AnnouncementsPage = () => {
  const { data: announcements = [] } = useAnnouncements(true);
  const { data: targets } = useAnnouncementTargets(true);
  const createAnnouncement = useCreateAnnouncement();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaLink, setCtaLink] = useState('');

  const users = targets?.users || [];
  const projects = targets?.projects || [];

  const canSubmit = useMemo(() => title.trim() && message.trim(), [title, message]);

  const toggleUser = (id) => {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    createAnnouncement.mutate({
      title,
      message,
      audienceType,
      recipients: audienceType === 'selected' ? selectedUsers : [],
      projectId: audienceType === 'project' ? projectId : null,
      sendEmail,
      expiresAt: expiresAt || null,
      ctaText: ctaText.trim() || undefined,
      ctaLink: ctaLink.trim() || undefined
    });
    setTitle('');
    setMessage('');
    setSelectedUsers([]);
    setProjectId('');
    setExpiresAt('');
    setCtaText('');
    setCtaLink('');
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader title="Announcements" subtitle="Create global, selected-user, or project announcements." />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-5 space-y-4 min-h-[620px]">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="space-y-2">
            <label className="text-xs font-bold">Audience</label>
            <select className="w-full border rounded-lg p-2 bg-transparent" value={audienceType} onChange={(e) => setAudienceType(e.target.value)}>
              <option value="all">All Users</option>
              <option value="selected">Selected Users</option>
              <option value="project">Project Members</option>
            </select>
          </div>

          {audienceType === 'selected' && (
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
              <div className="flex gap-2">
                <Button size="xs" variant="ghost" onClick={() => setSelectedUsers(users.map((u) => u._id))}>Select all</Button>
                <Button size="xs" variant="ghost" onClick={() => setSelectedUsers([])}>Deselect all</Button>
              </div>
              {users.map((u) => (
                <label key={u._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedUsers.includes(u._id)} onChange={() => toggleUser(u._id)} />
                  {u.name} ({u.email})
                </label>
              ))}
            </div>
          )}

          {audienceType === 'project' && (
            <select className="w-full border rounded-lg p-2 bg-transparent" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          )}

          <Input
            label="End date & time (optional)"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <Input label="CTA button text (optional)" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Learn more" />
          <Input label="CTA link (optional)" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} placeholder="https://..." />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Send emails to audience
          </label>
          <Button disabled={!canSubmit || createAnnouncement.isPending} onClick={handleSubmit}>
            {createAnnouncement.isPending ? 'Sending...' : 'Publish Announcement'}
          </Button>
        </Card>

        <Card className="lg:col-span-4 p-3 space-y-2">
          <h3 className="text-sm font-black">Recent Announcements</h3>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {announcements.map((item) => (
              <div key={item._id} className="rounded-xl border border-[var(--color-bg-border)] p-3">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{item.message}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Audience: {item.audienceType} {item.projectId?.name ? `(${item.projectId.name})` : ''}
                </p>
              </div>
            ))}
            {announcements.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No announcements yet.</p>}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default AnnouncementsPage;
