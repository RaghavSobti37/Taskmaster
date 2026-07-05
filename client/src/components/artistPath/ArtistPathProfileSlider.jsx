import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Mail, Phone, MapPin, Music } from 'lucide-react';
import { FullScreenWorkspace, Badge, Card, Spinner } from '../ui';
import { formatDisplayDateTime } from '../../utils/dateDisplay';
import { useArtistPathPerson } from '../../hooks/queries/artistPath';
import { useDataHubPersonSection } from '../../hooks/queries/dataHub';
import { displayRespondentName, displayStageBadge } from '../../utils/artistPathDisplay';
import ArtistPathAnswerSections from './ArtistPathAnswerSections';
import ArtistPathSocialLinks from './ArtistPathSocialLinks';

const DataHubPersonDetail = lazy(() => import('../dataHub/DataHubPersonDetail'));

function formatDate(d) {
  return formatDisplayDateTime(d);
}

export default function ArtistPathProfileSlider({ personId, onClose }) {
  const { data, isLoading, isFetching } = useArtistPathPerson(personId);
  const [showDataHub, setShowDataHub] = useState(false);
  const [crmTab, setCrmTab] = useState(false);

  useEffect(() => {
    setCrmTab(false);
    setShowDataHub(false);
  }, [personId]);
  const { data: crmData, isLoading: crmLoading } = useDataHubPersonSection(crmTab ? personId : null, 'crm');

  const hub = data?.hub;
  const responses = data?.responses || [];
  const latestAnswers = responses[0]?.answers || {};

  const email = data?.email || hub?.email;
  const phone = data?.phone || hub?.phone;
  const city = hub?.city || data?.person?.city || latestAnswers.city;

  const displayName = displayRespondentName({
    name: hub?.name || data?.person?.canonicalName || latestAnswers.name,
    email,
    stageName: latestAnswers.stageName,
    latestArtistType: hub?.latestArtistType,
  });
  const stageBadge = displayStageBadge({
    stageName: latestAnswers.stageName,
    latestArtistType: hub?.latestArtistType,
  });
  const latestSubmittedAt = responses[0]?.submittedAt;

  const MetaItem = ({ icon: Icon, children }) => (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] whitespace-nowrap">
      <Icon size={14} className="shrink-0 opacity-80" />
      <span className="truncate max-w-[14rem] sm:max-w-none">{children}</span>
    </span>
  );

  return (
    <>
      <FullScreenWorkspace
        isOpen={!!personId}
        onClose={onClose}
        title={displayName}
        subtitle={stageBadge ? `@ ${stageBadge}` : 'Artist Path questionnaire'}
        centerMain={false}
        mainClassName="w-full"
        extraActions={(
          <button
            type="button"
            onClick={() => setShowDataHub(true)}
            className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-border)]"
          >
            Full profile
          </button>
        )}
      >
        {(isLoading || isFetching) && (
          <div className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        )}

        {!isLoading && !isFetching && (
          <>
            <ArtistPathSocialLinks answers={latestAnswers} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 mb-5 border-b border-[var(--color-bg-border)]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm flex-1 min-w-0">
                {email && <MetaItem icon={Mail}>{email}</MetaItem>}
                {phone && <MetaItem icon={Phone}>{phone}</MetaItem>}
                {city && <MetaItem icon={MapPin}>{city}</MetaItem>}
                {!crmTab && latestSubmittedAt && (
                  <MetaItem icon={Music}>{formatDate(latestSubmittedAt)}</MetaItem>
                )}
                {stageBadge && (
                  <Badge variant="mint" className="shrink-0">{stageBadge}</Badge>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCrmTab(false)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                    !crmTab ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  Questionnaire ({responses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCrmTab(true)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                    crmTab ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  CRM summary
                </button>
              </div>
            </div>

            {!crmTab && (
              <div className="space-y-8">
                {responses.map((resp) => (
                  <div key={resp._id} className="space-y-4">
                    {responses.length > 1 && (
                      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <Music size={14} className="text-[var(--color-action-primary)]" />
                        <span className="text-xs font-bold">{formatDate(resp.submittedAt)}</span>
                        {displayStageBadge({ stageName: resp.answers?.stageName }) && (
                          <Badge variant="mint">{resp.answers.stageName}</Badge>
                        )}
                      </div>
                    )}
                    <ArtistPathAnswerSections answers={resp.answers} />
                  </div>
                ))}
                {!responses.length && (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No questionnaire responses</p>
                )}
              </div>
            )}

            {crmTab && (
              <div className="space-y-4">
                {crmLoading && <Spinner size="md" />}
                {!crmLoading && (crmData?.crm?.leads || []).map((lead) => (
                  <Card key={lead._id} className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="mint">{lead.leadStatus}</Badge>
                      <Badge variant="neutral">{lead.callStatus}</Badge>
                      <span className="text-xs text-[var(--color-text-muted)]">Source: {lead.source}</span>
                    </div>
                    {lead.notes && <p className="text-xs text-[var(--color-text-muted)]">{lead.notes}</p>}
                  </Card>
                ))}
                {!crmLoading && !crmData?.crm?.leads?.length && (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No CRM lead linked</p>
                )}
              </div>
            )}
          </>
        )}
      </FullScreenWorkspace>

      {showDataHub && personId && (
        <Suspense fallback={null}>
          <DataHubPersonDetail
            contactId={personId}
            onClose={() => setShowDataHub(false)}
          />
        </Suspense>
      )}
    </>
  );
}
