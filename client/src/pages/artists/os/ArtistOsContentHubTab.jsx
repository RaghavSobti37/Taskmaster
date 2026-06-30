import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ArtistContentTab from './ArtistContentTab';
import ArtistReleasesTab from '../workspace/ArtistReleasesTab';
import ArtistOsSubTabs from './ArtistOsSubTabs';

const SECTIONS = [
  { id: 'assets', label: 'Assets' },
  { id: 'releases', label: 'Releases' },
];

const DEFAULT_SECTION = 'assets';

export default function ArtistOsContentHubTab({ artistId, isPreview }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') || DEFAULT_SECTION;
  const section = SECTIONS.some((s) => s.id === sectionParam) ? sectionParam : DEFAULT_SECTION;

  const setSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'content');
    next.set('section', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <ArtistOsSubTabs tabs={SECTIONS} activeId={section} onChange={setSection} />
      {section === 'assets' && <ArtistContentTab artistId={artistId} isPreview={isPreview} />}
      {section === 'releases' && <ArtistReleasesTab artistId={artistId} isPreview={isPreview} />}
    </div>
  );
}
