import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ArtistTeamTab from '../workspace/ArtistTeamTab';
import ArtistNotesTab from './ArtistNotesTab';
import ArtistDocumentsTab from './ArtistDocumentsTab';
import ArtistContractsTab from './ArtistContractsTab';
import ArtistOsSubTabs from './ArtistOsSubTabs';

const SECTIONS = [
  { id: 'members', label: 'Members' },
  { id: 'notes', label: 'Notes' },
  { id: 'documents', label: 'Documents' },
  { id: 'contracts', label: 'Contracts' },
];

const DEFAULT_SECTION = 'members';

export default function ArtistOsTeamHubTab({ artistId, artistName, canManageTeam, isPreview }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') || DEFAULT_SECTION;
  const section = SECTIONS.some((s) => s.id === sectionParam) ? sectionParam : DEFAULT_SECTION;

  const setSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'team');
    next.set('section', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <ArtistOsSubTabs tabs={SECTIONS} activeId={section} onChange={setSection} />
      {section === 'members' && <ArtistTeamTab artistId={artistId} canManageTeam={canManageTeam} />}
      {section === 'notes' && <ArtistNotesTab artistId={artistId} isPreview={isPreview} />}
      {section === 'documents' && <ArtistDocumentsTab artistId={artistId} artistName={artistName} isPreview={isPreview} />}
      {section === 'contracts' && <ArtistContractsTab artistId={artistId} isPreview={isPreview} />}
    </div>
  );
}
