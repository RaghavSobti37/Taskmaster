import React from 'react';
import { Card, Button } from '../../../components/ui';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { useArtistOsDocuments } from '../../../hooks/queries/artistOs';

export function getArtistDocumentsDescription(artistName) {
  if (artistName) {
    return `Central document vault for ${artistName} is coming soon. Until then, attach contract URLs in Contracts or upload invoices via org Finance OCR.`;
  }
  return 'Central document vault for this artist is coming soon. Until then, attach contract URLs in Contracts or upload invoices via org Finance OCR.';
}

export default function ArtistDocumentsTab({ artistId, artistName, isPreview }) {
  const [, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useArtistOsDocuments(artistId, !!artistId && !isPreview);
  const items = data?.items || [];

  const openContractsSection = () => {
    setSearchParams({ tab: 'team', section: 'contracts' });
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
    <Card className="p-6 rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-[var(--color-action-primary)]" />
        <p className="text-sm font-black">Documents</p>
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {data?.message || getArtistDocumentsDescription(artistName)}
      </p>
      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Contract attachments</p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold truncate">{item.title}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-[var(--color-action-primary)] underline shrink-0">
                  View
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!isPreview && artistId && (
          <Button size="sm" variant="secondary" onClick={openContractsSection}>
            View contracts
          </Button>
        )}
        <Link to="/management?tab=finance" className="inline-flex">
          <Button size="sm" variant="secondary">
            Org Finance OCR
            <ExternalLink size={12} className="ml-1 opacity-60" />
          </Button>
        </Link>
      </div>
    </Card>
    </ArtistOsQueryShell>
  );
}
