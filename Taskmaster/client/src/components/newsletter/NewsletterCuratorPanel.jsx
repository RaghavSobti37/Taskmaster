import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Sparkles, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Badge } from '../ui';
import NexusDropdown from '../ui/NexusDropdown';
import {
  useCurateNewsletterIssue,
  useCompileNewsletterIssue,
  useUpdateNewsletterArticle,
  useNewsletterHtmlPreview,
} from '../../hooks/queries/newsletter';
import { useToast } from '../../contexts/ToastContext';

const categoryLabel = (categories, key) => categories.find((c) => c.key === key)?.label || key;

const NewsletterCuratorPanel = ({ issue, articles = [], categories = [] }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const curateMutation = useCurateNewsletterIssue();
  const compileMutation = useCompileNewsletterIssue();
  const updateMutation = useUpdateNewsletterArticle();

  const [introTitle, setIntroTitle] = useState(issue?.introTitle || '');
  const [introBlurb, setIntroBlurb] = useState(issue?.introBlurb || '');
  const [localArticles, setLocalArticles] = useState(articles);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const { data: previewData, refetch: refetchPreview } = useNewsletterHtmlPreview(
    issue?._id,
    issue?.status === 'ready' || !!issue?.compiledHtml,
  );

  useEffect(() => {
    setIntroTitle(issue?.introTitle || '');
    setIntroBlurb(issue?.introBlurb || '');
    setLocalArticles(articles);
  }, [issue, articles]);

  const persistOrder = async (nextArticles) => {
    setLocalArticles(nextArticles);
    await curateMutation.mutateAsync({
      issueId: issue._id,
      introTitle,
      introBlurb,
      status: 'curating',
      articles: nextArticles.map((a, index) => ({
        id: a._id,
        sortOrder: index,
        included: a.included !== false,
      })),
    });
  };

  const moveArticle = async (index, direction) => {
    const next = [...localArticles];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await persistOrder(next);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const toggleIncluded = async (article) => {
    const next = localArticles.map((a) => (
      a._id === article._id ? { ...a, included: a.included === false } : a
    ));
    try {
      await persistOrder(next);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const saveIntro = async () => {
    try {
      await curateMutation.mutateAsync({
        issueId: issue._id,
        introTitle,
        introBlurb,
        status: 'curating',
      });
      toast.success('Intro saved');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleCompile = async () => {
    try {
      await saveIntro();
      await compileMutation.mutateAsync(issue._id);
      await refetchPreview();
      toast.success('Newsletter compiled');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const startEdit = (article) => {
    setEditingId(article._id);
    setEditDraft({
      title: article.title || '',
      description: article.description || '',
      imageUrl: article.imageUrl || '',
      category: article.category || 'other',
      notes: article.notes || '',
    });
  };

  const saveEdit = async () => {
    try {
      await updateMutation.mutateAsync({ id: editingId, ...editDraft, fetchStatus: 'manual' });
      setEditingId(null);
      toast.success('Article updated');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const previewHtml = previewData?.html || issue?.compiledHtml;

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-[var(--color-bg-border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Curate {issue?.weekKey}</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
              Status: <Badge variant={issue?.status === 'ready' ? 'success' : 'info'}>{issue?.status}</Badge>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleCompile} disabled={compileMutation.isPending || !localArticles.length}>
              <Sparkles size={14} /> {compileMutation.isPending ? 'Compiling…' : 'Compile newsletter'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/emails/newsletter/send/${issue._id}`)}
              disabled={issue?.status !== 'ready' && !previewHtml}
            >
              <Send size={14} /> Send
            </Button>
          </div>
        </div>

        <Input label="Intro title" value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} />
        <Input label="Intro blurb" multiline rows={3} value={introBlurb} onChange={(e) => setIntroBlurb(e.target.value)} />
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={saveIntro} disabled={curateMutation.isPending}>Save intro</Button>
        </div>
      </Card>

      <Card className="p-0 border border-[var(--color-bg-border)] divide-y divide-[var(--color-bg-border)]">
        {localArticles.map((article, index) => (
          <div key={article._id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="info" className="!text-[9px]">{categoryLabel(categories, article.category)}</Badge>
                  <Badge variant={article.included === false ? 'slate' : 'mint'}>
                    {article.included === false ? 'Excluded' : 'Included'}
                  </Badge>
                </div>
                <p className="font-bold text-sm mt-2">{article.title || article.url}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{article.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="xs" variant="ghost" onClick={() => moveArticle(index, -1)} disabled={index === 0}>
                  <ArrowUp size={14} />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => moveArticle(index, 1)} disabled={index === localArticles.length - 1}>
                  <ArrowDown size={14} />
                </Button>
                <Button size="xs" variant="secondary" onClick={() => startEdit(article)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => toggleIncluded(article)}>
                  {article.included === false ? 'Include' : 'Exclude'}
                </Button>
              </div>
            </div>

            {editingId === article._id && (
              <div className="grid gap-3 md:grid-cols-2 border-t border-[var(--color-bg-border)] pt-3">
                <NexusDropdown
                  label="Category"
                  value={editDraft.category}
                  onChange={(value) => setEditDraft((d) => ({ ...d, category: value }))}
                  options={categories.map((c) => ({ value: c.key, label: c.label }))}
                />
                <Input label="Title" value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
                <Input label="Description" multiline rows={3} value={editDraft.description} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />
                <Input label="Image URL" value={editDraft.imageUrl} onChange={(e) => setEditDraft((d) => ({ ...d, imageUrl: e.target.value }))} />
                <Input label="Notes" value={editDraft.notes} onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))} />
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>Save article</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {localArticles.length === 0 && (
          <div className="p-10 text-center text-[var(--color-text-muted)] text-xs uppercase tracking-widest">
            No articles to curate
          </div>
        )}
      </Card>

      {previewHtml && (
        <Card className="p-4 border border-[var(--color-bg-border)] space-y-3">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <h3 className="text-sm font-bold">Compiled preview</h3>
          </div>
          <iframe
            title="Newsletter preview"
            srcDoc={previewHtml}
            className="w-full min-h-[520px] rounded-lg border border-[var(--color-bg-border)] bg-white"
            sandbox=""
          />
        </Card>
      )}
    </div>
  );
};

export default NewsletterCuratorPanel;
