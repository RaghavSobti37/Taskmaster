import React from 'react';
import {
  FinanceCategoryBadge,
  FinanceDividerLabel,
  FinanceDocActions,
  FinanceDocDateCell,
  FinanceDocNameCell,
  FinanceFolderNameCell,
  FinanceProjectCell,
  FinanceSizeCell,
  FinanceUploaderCell,
} from './FinanceDocumentRow';

export function buildProjectFinanceTableColumns({
  onViewDoc,
  onDeleteDoc,
  onConfirmDeleteDoc,
}) {
  return [
    {
      key: 'title',
      header: 'Document Title',
      mobilePrimary: true,
      render: (row) => <FinanceDocNameCell doc={row} />,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row) => (
        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase">
          {row.metadata?.vendor || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      align: 'right',
      render: (row) => (
        <span className="text-xs font-black text-[var(--color-text-primary)] tabular-nums">
          {row.metadata?.amount
            ? `${row.metadata.currency || 'INR'} ${Number(row.metadata.amount).toLocaleString('en-IN')}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <FinanceCategoryBadge category={row.category} isFolder={false} />,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => (
        <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest tabular-nums">
          {new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      mobileAction: true,
      align: 'right',
      render: (row) => (
        <FinanceDocActions
          doc={row}
          isFolder={false}
          onView={onViewDoc}
          onDelete={onDeleteDoc}
          onConfirmDelete={onConfirmDeleteDoc}
        />
      ),
    },
  ];
}

export function buildFinanceTableColumns({
  onViewDoc,
  onDeleteDoc,
  onDeleteFolder,
  onConfirmDeleteDoc,
  deleteFolderPending,
}) {
  return [
    {
      key: 'title',
      sortKey: 'title',
      header: 'Name',
      mobilePrimary: true,
      render: (row) => {
        if (row._isDivider) return <FinanceDividerLabel label={row.label} />;
        if (row.isFolder) return <FinanceFolderNameCell doc={row} />;
        return <FinanceDocNameCell doc={row} />;
      },
    },
    {
      key: 'project',
      header: 'Project',
      mobileHidden: true,
      render: (row) => (row._isDivider ? null : <FinanceProjectCell doc={row} />),
    },
    {
      key: 'category',
      sortKey: 'category',
      header: 'Category',
      render: (row) => (row._isDivider ? null : <FinanceCategoryBadge category={row.category} isFolder={row.isFolder} />),
    },
    {
      key: 'fileSize',
      sortKey: 'fileSize',
      header: 'Size',
      numeric: true,
      mobileHidden: true,
      render: (row) => <FinanceSizeCell doc={row} />,
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      mobileHidden: true,
      render: (row) => <FinanceUploaderCell doc={row} />,
    },
    {
      key: 'docDate',
      sortKey: 'docDate',
      header: 'Doc Date',
      mobileHidden: true,
      render: (row) => <FinanceDocDateCell doc={row} />,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      mobileAction: true,
      align: 'right',
      render: (row) => (
        <FinanceDocActions
          doc={row}
          isFolder={row.isFolder}
          onView={onViewDoc}
          onDelete={onDeleteDoc}
          onDeleteFolder={(e) => onDeleteFolder?.(e, row)}
          deleteFolderPending={deleteFolderPending}
          onConfirmDelete={onConfirmDeleteDoc}
        />
      ),
    },
  ];
}
