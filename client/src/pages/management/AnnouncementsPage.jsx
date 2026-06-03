import React, { useMemo, useState } from 'react';
import { Megaphone, Mail, Radio } from 'lucide-react';
import { ListPageLayout, Input, Button, DataLoading } from '../../components/ui';
import WorkspaceProjectFields from '../../components/forms/WorkspaceProjectFields';
import { useAnnouncementTargets, useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from '../../hooks/useTaskmasterQueries';
import { useConfirm } from '../../contexts/confirmContext';

const AnnouncementsPage = () => {
  const { confirm } = useConfirm();
  const { data: announcements = [], isLoading: announcementsLoading } = useAnnouncements(true, 4000, true);
  const { data: targets, isLoading: targetsLoading } = useAnnouncementTargets(true);
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

  const announcementStats = useMemo(() => {
    const emailPending = announcements.filter(
      (a) => a.emailDispatch && ['queued', 'sending', 'pending'].includes(String(a.emailDispatch.status || '').toLowerCase())
    ).length;
    const withEmail = announcements.filter((a) => a.emailDispatch).length;
    return {
      total: announcements.length,
      withEmail,
      emailPending,
    };
  }, [announcements]);

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
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Published',
            value: announcementStats.total,
            icon: Megaphone,
            variant: 'mint',
            info: 'Announcements visible in the feed.',
          },
          {
            id: 'email',
            label: 'With Email',
            value: announcementStats.withEmail,
            icon: Mail,
            variant: 'info',
            info: 'Broadcasts that also sent email to the audience.',
          },
          {
            id: 'pending',
            label: 'Email In Flight',
            value: announcementStats.emailPending,
            icon: Radio,
            variant: 'apricot',
            info: 'Announcements whose email dispatch is still queued or sending.',
          },
        ],
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-[var(--color-bg-border)] lg:pr-6">
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
              {targetsLoading ? (
                <DataLoading message="Loading users..." className="py-6" />
              ) : (
              <>
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
              </>
              )}
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
        </section>

        <section className="lg:col-span-4 p-4 flex flex-col gap-3 self-start w-full">
          <h3 className="tm-section-label text-[var(--color-text-primary)]">Recent Announcements</h3>
          {announcementsLoading ? (
            <DataLoading message="Loading announcements..." className="py-8" />
          ) : announcements.length === 0 ? (
            <p className="tm-caption py-4 text-center">No announcements yet.</p>
          ) : (
            <div className="space-y-2 max-h-[min(70vh,32rem)] overflow-y-auto pr-0.5">
              {announcements.map((item) => (
                <div key={item._id} className="border-b border-[var(--color-bg-border)] pb-3 last:border-0 space-y-2">
                  <div>
                    <p className="tm-task-title">{item.title}</p>
                    <p className="tm-caption mt-1 whitespace-pre-wrap break-words">{item.message}</p>
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
        </section>
      </div>
    </ListPageLayout>
  );
};

export default AnnouncementsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
