import React from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Card, Badge, Button, DataTable } from '../ui';
import { useDeleteNewsletterArticle } from '../../hooks/queries/newsletter';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';

const categoryLabel = (categories, key) => categories.find((c) => c.key === key)?.label || key;

const NewsletterWeekBoard = ({
  articles = [],
  categories = [],
  issueStatus,
  editable = false,
  onChanged,
}) => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const deleteMutation = useDeleteNewsletterArticle();

  const canDelete = (row) => {
    if (issueStatus === 'sent') return false;
    if (isAdminUser(user)) return true;
    return row.addedBy?.toString?.() === user?._id || row.addedByUser?._id === user?._id;
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Remove link?',
      message: 'This article will be removed from the weekly board.',
      confirmLabel: 'Remove',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(row._id);
      toast.success('Link removed');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const columns = [
    {
      header: 'Article',
      render: (row) => (
        <div className="min-w-[14rem]">
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-xs tracking-tight hover:text-[var(--color-pastel-mint-text)] inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {row.title || row.url}
            <ExternalLink size={12} />
          </a>
          <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2 mt-1">{row.description}</p>
        </div>
      ),
    },
    {
      header: 'Category',
      render: (row) => (
        <Badge variant="info" className="!text-[9px]">
          {categoryLabel(categories, row.category)}
        </Badge>
      ),
    },
    {
      header: 'Added by',
      render: (row) => (
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {row.addedByUser?.name || row.addedByUser?.email || 'Team member'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.included === false ? 'slate' : row.fetchStatus === 'success' ? 'success' : 'warning'}>
          {row.included === false ? 'Excluded' : row.fetchStatus}
        </Badge>
      ),
    },
    ...(editable ? [{
      header: '',
      render: (row) => (
        canDelete(row) ? (
          <Button
            size="xs"
            variant="ghost"
            className="text-[var(--color-pastel-rose-text)]"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={14} />
          </Button>
        ) : null
      ),
    }] : []),
  ];

  return (
    <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
      <DataTable columns={columns} data={articles} />
      {articles.length === 0 && (
        <div className="p-12 text-center opacity-40">
          <p className="text-xs font-black uppercase tracking-widest">No links saved this week yet</p>
        </div>
      )}
    </Card>
  );
};

export default NewsletterWeekBoard;
