import React, { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui';
import NexusDropdown from '../ui/NexusDropdown';
import {
  usePreviewNewsletterLink,
  useCreateNewsletterArticle,
} from '../../hooks/queries/newsletter';
import { useToast } from '../../contexts/ToastContext';

const NewsletterLinkForm = ({ issueId, categories = [], onSaved }) => {
  const toast = useToast();
  const previewMutation = usePreviewNewsletterLink();
  const createMutation = useCreateNewsletterArticle();

  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('other');
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');

  const categoryOptions = categories.map((c) => ({ value: c.key, label: c.label }));

  const resetForm = () => {
    setUrl('');
    setPreview(null);
    setTitle('');
    setDescription('');
    setImageUrl('');
    setNotes('');
    setCategory('other');
  };

  const handlePreview = async () => {
    if (!url.trim()) {
      toast.warn('Paste an article URL first');
      return;
    }
    try {
      const data = await previewMutation.mutateAsync(url.trim());
      setPreview(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setImageUrl(data.imageUrl || '');
      if (data.fetchStatus === 'failed') {
        toast.warn('Could not auto-fetch metadata — fill in title and description manually');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      toast.warn('URL required');
      return;
    }
    try {
      await createMutation.mutateAsync({
        issueId,
        url: preview?.url || url.trim(),
        category,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Link saved for this week');
      resetForm();
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  return (
    <Card className="p-4 border border-[var(--color-bg-border)] space-y-4">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-[var(--color-pastel-mint-text)]" />
        <h3 className="text-sm font-bold tracking-tight">Add article for this week</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={previewMutation.isPending || !url.trim()}
        >
          {previewMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Preview
        </Button>
      </div>

      {(preview || title || description) && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <NexusDropdown
              label="Category"
              value={category}
              onChange={setCategory}
              options={categoryOptions}
            />
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              label="Description"
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input label="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-lg border border-[var(--color-bg-border)] overflow-hidden bg-[var(--color-bg-surface)]">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-full h-36 object-cover" />
            ) : (
              <div className="h-36 flex items-center justify-center text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                No preview image
              </div>
            )}
            <div className="p-3 space-y-2">
              {preview?.fetchStatus && (
                <Badge variant={preview.fetchStatus === 'success' ? 'success' : preview.fetchStatus === 'manual' ? 'info' : 'warning'}>
                  {preview.fetchStatus}
                </Badge>
              )}
              <p className="text-sm font-bold">{title || 'Untitled article'}</p>
              <p className="text-xs text-[var(--color-text-muted)] line-clamp-4">{description || 'No description yet'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={resetForm}>Clear</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={createMutation.isPending || !url.trim()}
        >
          {createMutation.isPending ? 'Saving…' : 'Save for this week'}
        </Button>
      </div>
    </Card>
  );
};

export default NewsletterLinkForm;
