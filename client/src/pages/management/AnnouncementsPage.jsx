import React, { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { PageContainer, PageHeader, Card, Input, Button } from '../../components/ui';
import WorkspaceProjectFields from '../../components/forms/WorkspaceProjectFields';
import { useAnnouncementTargets, useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from '../../hooks/useTaskmasterQueries';
import { useConfirm } from '../../contexts/ConfirmContext';

const AnnouncementsPage = () => {
  const { confirm } = useConfirm();
  const { data: announcements = [] } = useAnnouncements(true, 4000, true);
  const { data: targets } = useAnnouncementTargets(true);
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [projectWorkspace, setProjectWorkspace] = useState('General');
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
    setProjectWorkspace('General');
    setExpiresAt('');
    setCtaText('');
    setCtaLink('');
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader title="Announcements" subtitle="Create global, selected-user, or project announcements." icon={Megaphone} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-8 p-5 space-y-4">
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
            <WorkspaceProjectFields
              projects={projects}
              workspace={projectWorkspace}
              projectId={projectId}
              onChange={({ workspace, projectId: pid }) => {
                setProjectWorkspace(workspace);
                setProjectId(pid);
              }}
              layout="stacked"
            />
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

        <Card className="lg:col-span-4 p-4 flex flex-col gap-3 self-start w-full">
          <h3 className="tm-section-label text-[var(--color-text-primary)]">Recent Announcements</h3>
          {announcements.length === 0 ? (
            <p className="tm-caption py-4 text-center">No announcements yet.</p>
          ) : (
            <div className="space-y-2 max-h-[min(70vh,32rem)] overflow-y-auto pr-0.5">
              {announcements.map((item) => (
                <div key={item._id} className="rounded-xl border border-[var(--color-bg-border)] p-3 space-y-2">
                  <div>
                    <p className="tm-task-title">{item.title}</p>
                    <p className="tm-caption mt-1 line-clamp-3">{item.message}</p>
                    <p className="tm-caption mt-1">
                      Audience: {item.audienceType}
                      {item.projectId?.name ? ` (${item.projectId.name})` : ''}
                    </p>
                  </div>
                  {!!item.emailDispatch && (
                    <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1">
                      <p className="tm-section-label !text-[9px]">
                        Email: {item.emailDispatch.status || 'idle'}
                      </p>
                      <p className="tm-caption">
                        {item.emailDispatch.sent || 0}/{item.emailDispatch.total || 0} sent
                        {(item.emailDispatch.failed || 0) > 0 ? ` · ${item.emailDispatch.failed} failed` : ''}
                      </p>
                      {!!item.emailDispatch.recipients?.length && (
                        <details className="tm-caption">
                          <summary className="cursor-pointer hover:text-[var(--color-text-primary)]">
                            Recipients ({item.emailDispatch.recipients.length})
                          </summary>
                          <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                            {item.emailDispatch.recipients.map((r) => (
                              <div key={r._id || r.email} className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="truncate">{r.email}</span>
                                <span className="font-semibold shrink-0">{r.status}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end pt-0.5">
                    <Button
                      size="xs"
                      variant="danger"
                      disabled={deleteAnnouncement.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete announcement?',
                          message: 'Delete this announcement?',
                          confirmLabel: 'Delete',
                          type: 'danger',
                        });
                        if (ok) deleteAnnouncement.mutate(item._id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
};

export default AnnouncementsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
