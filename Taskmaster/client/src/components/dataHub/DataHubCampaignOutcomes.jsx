import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { Badge, Button } from '../ui';

const STATUS_VARIANT = {
  failed: 'rose',
  read: 'mint',
  delivered: 'info',
  clicked: 'warning',
  replied: 'mint',
  sent: 'neutral',
};

export default function DataHubCampaignOutcomes({ open, onClose }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [recipients, setRecipients] = useState({});
  const [loadingRecipients, setLoadingRecipients] = useState(null);
  const [loadingMore, setLoadingMore] = useState(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/data-hub/campaign-outcomes');
      setCampaigns(res.data?.campaigns || []);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadCampaigns();
  }, [open, loadCampaigns]);

  const fetchRecipients = async (name, page = 1, append = false) => {
    const encoded = encodeURIComponent(name);
    const res = await axios.get(`/api/data-hub/campaign-outcomes/${encoded}/recipients`, {
      params: { page, limit: 100 },
    });
    setRecipients((prev) => {
      if (!append) return { ...prev, [name]: res.data };
      const existing = prev[name]?.recipients || [];
      return {
        ...prev,
        [name]: {
          ...res.data,
          recipients: [...existing, ...(res.data.recipients || [])],
        },
      };
    });
    return res.data;
  };

  const toggleCampaign = async (name) => {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    if (recipients[name]) return;
    setLoadingRecipients(name);
    try {
      await fetchRecipients(name, 1, false);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to load recipients');
    } finally {
      setLoadingRecipients(null);
    }
  };

  const loadMoreRecipients = async (name) => {
    const detail = recipients[name];
    if (!detail) return;
    const nextPage = (detail.page || 1) + 1;
    if (nextPage > (detail.pages || 1)) return;
    setLoadingMore(name);
    try {
      await fetchRecipients(name, nextPage, true);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to load more');
    } finally {
      setLoadingMore(null);
    }
  };

  if (!open) return null;

  return (
    <div className="mb-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="shrink-0 text-[var(--color-text-muted)]" />
          <p className="text-sm font-semibold truncate">WhatsApp campaign outcomes</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="!px-2" onClick={loadCampaigns} disabled={loading}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" className="!px-2" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
        {loading && <p className="text-xs text-[var(--color-text-muted)] px-2 py-3">Loading campaigns…</p>}
        {!loading && campaigns.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] px-2 py-3">
            No campaign outcomes yet. Run AiSensy sync (prod) or import audience CSVs from AiSensy dashboard.
          </p>
        )}
        {campaigns.map((campaign) => {
          const name = campaign.campaignName;
          const isOpen = expanded === name;
          const detail = recipients[name];
          return (
            <div key={name} className="rounded-lg border border-[var(--color-bg-border)] overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-[var(--color-bg-secondary)]"
                onClick={() => toggleCampaign(name)}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="text-xs font-medium truncate flex-1">{name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  {campaign.total || 0}
                  {campaign.audienceSize ? ` / ${campaign.audienceSize}` : ''}
                </span>
              </button>
              <div className="px-2 pb-2 flex flex-wrap gap-1">
                {Object.entries(campaign.byStatus || {}).map(([status, count]) => (
                  <Badge key={status} variant={STATUS_VARIANT[status] || 'neutral'} className="text-[10px]">
                    {status} {count}
                  </Badge>
                ))}
              </div>
              {isOpen && (
                <div className="border-t border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
                  {loadingRecipients === name && (
                    <p className="text-xs text-[var(--color-text-muted)] px-3 py-2">Loading recipients…</p>
                  )}
                  {detail && (
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
                            <th className="text-left font-semibold px-2 py-1">Name</th>
                            <th className="text-left font-semibold px-2 py-1">Phone</th>
                            <th className="text-left font-semibold px-2 py-1">Status</th>
                            <th className="text-left font-semibold px-2 py-1">Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.recipients || []).map((row) => (
                            <tr key={`${row.phone}-${row._id || row.status}`} className="border-b border-[var(--color-bg-border)]/60">
                              <td className="px-2 py-1 truncate max-w-[120px]">{row.name || '—'}</td>
                              <td className="px-2 py-1 tabular-nums">{row.phone}</td>
                              <td className="px-2 py-1">
                                <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>{row.status}</Badge>
                              </td>
                              <td className="px-2 py-1 text-[var(--color-text-muted)] truncate max-w-[180px]" title={row.failureReason || ''}>
                                {row.failureReason
                                  || (row.metadata?.readAt ? 'read' : row.metadata?.deliveredAt ? 'delivered' : row.metadata?.clickedAt ? 'clicked' : '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {detail.total > (detail.recipients?.length || 0) && (
                        <div className="px-2 py-1 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            Showing {detail.recipients?.length || 0} of {detail.total}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!px-2 !text-[10px]"
                            disabled={loadingMore === name}
                            onClick={() => loadMoreRecipients(name)}
                          >
                            {loadingMore === name ? 'Loading…' : 'Load more'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
