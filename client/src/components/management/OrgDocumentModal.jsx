import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link2, Upload } from 'lucide-react';
import { ORG_DOCUMENT_CATEGORIES } from '@shared/orgDocumentCategories';
import { NexusModal, ModalFooter } from '../ui/modals';
import { Button, Input } from '../ui/primitives';
import { uploadOrgDocumentFiles } from '../../utils/orgDocumentUpload';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'Other',
  tags: '',
  externalUrl: '',
};

function normalizeExternalUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export default function OrgDocumentModal({
  isOpen,
  onClose,
  editingDoc,
  onSaveLink,
  onSaveFile,
  isSaving,
}) {
  const [mode, setMode] = useState('file');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const isEdit = Boolean(editingDoc);

  const resetState = useCallback(() => {
    setMode(editingDoc?.sourceType === 'link' ? 'link' : 'file');
    setForm(
      editingDoc
        ? {
            title: editingDoc.title || '',
            description: editingDoc.description || '',
            category: editingDoc.category || 'Other',
            tags: (editingDoc.tags || []).join(', '),
            externalUrl: editingDoc.externalUrl || '',
          }
        : EMPTY_FORM,
    );
    setSelectedFile(null);
    setUploadProgress(0);
    setError('');
  }, [editingDoc]);

  React.useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen, resetState]);

  const canSubmit = useMemo(() => {
    if (!form.title.trim()) return false;
    if (isEdit) return true;
    if (mode === 'link') return Boolean(form.externalUrl.trim());
    return Boolean(selectedFile);
  }, [form.title, form.externalUrl, isEdit, mode, selectedFile]);

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.title.trim()) {
        setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const handleFilePick = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.title.trim()) {
        setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const buildPayloadBase = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    tags: form.tags,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (isEdit) {
        await onSaveLink({
          id: editingDoc._id,
          ...buildPayloadBase(),
        });
        onClose();
        return;
      }

      if (mode === 'link') {
        await onSaveLink({
          ...buildPayloadBase(),
          sourceType: 'link',
          externalUrl: normalizeExternalUrl(form.externalUrl),
        });
        onClose();
        return;
      }

      if (!selectedFile) {
        setError('Select a file to upload');
        return;
      }

      const [uploaded] = await uploadOrgDocumentFiles([selectedFile], {
        onProgress: setUploadProgress,
      });
      if (!uploaded?.url) {
        setError('Upload failed');
        return;
      }

      await onSaveFile({
        ...buildPayloadBase(),
        sourceType: 'file',
        fileUrl: uploaded.url,
        fileKey: uploaded.key,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        fileType: uploaded.type,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    }
  };

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit document' : 'Add document'}
      width="max-w-xl"
      showFooter={false}
      footer={(
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="org-document-form"
            size="sm"
            variant="success"
            disabled={!canSubmit || isSaving}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add document'}
          </Button>
        </ModalFooter>
      )}
    >
      <form id="org-document-form" className="space-y-4" onSubmit={handleSubmit}>
        {!isEdit && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'file' ? 'primary' : 'ghost'}
              onClick={() => setMode('file')}
            >
              <Upload size={14} /> Upload file
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'link' ? 'primary' : 'ghost'}
              onClick={() => setMode('link')}
            >
              <Link2 size={14} /> Add link
            </Button>
          </div>
        )}

        {!isEdit && mode === 'file' && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[var(--color-border-subtle)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--color-action-primary)]/50 transition-colors"
          >
            <Upload size={32} className="mx-auto mb-2 text-[var(--color-action-primary)]" />
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : 'Drag & drop or click to browse'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">PDF, images, spreadsheets — up to 32MB</p>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <p className="text-xs mt-2">{uploadProgress}% uploaded</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
        )}

        {!isEdit && mode === 'link' && (
          <Input
            label="External URL"
            value={form.externalUrl}
            onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
            placeholder="https://drive.google.com/..."
            required
          />
        )}

        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Category
          <select
            className="mt-1 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {ORG_DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        <Input
          label="Tags"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="comma-separated"
        />

        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Description
          <textarea
            className="mt-1 w-full min-h-[80px] rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        {error && (
          <p className="text-sm text-red-400" role="alert">{error}</p>
        )}
      </form>
    </NexusModal>
  );
}
