import React from 'react';
import { Disc, Play, ExternalLink, Heart, MessageSquare } from 'lucide-react';
import { FaInstagram } from 'react-icons/fa';
import { DataTable, Badge, PageSkeleton } from '../ui';
import { formatNumber } from '../../config/integrations.config';

const spotifyColumns = [
  {
    header: 'Track',
    render: (row) => (
      <div className="flex items-center gap-3 py-1">
        {row.albumImage ? (
          <img src={row.albumImage} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Disc size={16} /></div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs">{row.trackName}</span>
            {row.url && <a href={row.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /></a>}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">{row.albumName || 'Single'}</span>
        </div>
      </div>
    ),
  },
  {
    header: 'Popularity',
    render: (row) => (
      <div className="flex items-center gap-2 min-w-[80px]">
        <div className="flex-1 h-1.5 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.popularity || 0}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums">{row.popularity ?? '—'}</span>
      </div>
    ),
  },
];

const youtubeColumns = [
  {
    header: 'Video',
    render: (row) => (
      <div className="flex items-center gap-3">
        <Play size={16} className="text-red-500" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs line-clamp-1">{row.videoTitle}</span>
            {row.isNative !== false ? <Badge variant="success">Native</Badge> : <Badge variant="apricot">Featured</Badge>}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">{row.channelName}</span>
        </div>
      </div>
    ),
  },
  { header: 'Views', render: (row) => <span className="text-xs font-bold tabular-nums">{formatNumber(row.views)}</span> },
  { header: 'Likes', render: (row) => <span className="text-xs flex items-center gap-1 tabular-nums"><Heart size={12} className="text-rose-500" />{formatNumber(row.likes)}</span> },
  { header: 'Comments', render: (row) => <span className="text-xs flex items-center gap-1 tabular-nums"><MessageSquare size={12} />{formatNumber(row.comments)}</span> },
];

const metaColumns = [
  {
    header: 'Post',
    render: (row) => (
      <div className="flex items-center gap-3">
        <FaInstagram className="text-pink-500" />
        <span className="font-bold text-xs line-clamp-1 max-w-xs">{row.caption}</span>
      </div>
    ),
  },
  { header: 'Reach', render: (row) => <span className="text-xs font-bold tabular-nums">{formatNumber(row.reach)}</span> },
  { header: 'Likes', render: (row) => <span className="text-xs font-bold tabular-nums">{formatNumber(row.like_count)}</span> },
  { header: 'Comments', render: (row) => <span className="text-xs tabular-nums">{formatNumber(row.comments_count)}</span> },
];

const COLUMN_MAP = { spotify: spotifyColumns, youtube: youtubeColumns, instagram: metaColumns, meta: metaColumns };

export default function AssetTable({
  activeTab,
  tracks = [],
  videos = [],
  posts = [],
  loading,
  onRowClick,
  videoFilter,
  onVideoFilterChange,
}) {
  const filteredVideos = videos.filter((v) => {
    if (videoFilter === 'native') return v.isNative !== false;
    if (videoFilter === 'external') return v.isNative === false;
    return true;
  });

  const tabKey = activeTab === 'meta' ? 'instagram' : activeTab;
  const columns = COLUMN_MAP[tabKey] || spotifyColumns;
  const data = activeTab === 'spotify' ? tracks : activeTab === 'youtube' ? filteredVideos : posts;

  return (
    <div className="border-t border-[var(--color-bg-border)]">
      {activeTab === 'youtube' && onVideoFilterChange && (
        <div className="py-2 flex gap-1 border-b border-[var(--color-bg-border)]">
          {['all', 'native', 'external'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onVideoFilterChange(f)}
              className={`px-3 py-1 rounded-[var(--radius-atomic)] text-[10px] font-bold uppercase tracking-wide capitalize transition-colors ${
                videoFilter === f
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {f === 'external' ? 'Featured' : f}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <PageSkeleton />
      ) : (
        <DataTable columns={columns} data={data} onRowClick={onRowClick} />
      )}
      {!loading && !data.length && (
        <div className="py-10 text-center text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-widest">
          No assets — sync or connect platform
        </div>
      )}
    </div>
  );
}
