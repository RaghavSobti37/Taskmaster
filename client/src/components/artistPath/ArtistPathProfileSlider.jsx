import React, { useState, lazy, Suspense } from 'react';
import { Mail, Phone, MapPin, Music } from 'lucide-react';
import { FullScreenWorkspace, Badge, Card, Spinner } from '../ui';
import { useArtistPathPerson } from '../../hooks/queries/artistPath';
import { useDataHubPersonSection } from '../../hooks/useTaskmasterQueries';
import { ANSWER_LABELS } from '@shared/artistPathSchema';

const DataHubPersonDetail = lazy(() => import('../dataHub/DataHubPersonDetail'));

function answerLabel(key) {
  return ANSWER_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(d);
  }
}

export default function ArtistPathProfileSlider({ personId, onClose }) {
  const { data, isLoading } = useArtistPathPerson(personId);
  const [showDataHub, setShowDataHub] = useState(false);
  const [crmTab, setCrmTab] = useState(false);
  const { data: crmData, isLoading: crmLoading } = useDataHubPersonSection(crmTab ? personId : null, 'crm');

  const hub = data?.hub;
  const name = hub?.name || data?.person?.canonicalName || 'Artist Path Respondent';
  const email = data?.email || hub?.email;
  const phone = data?.phone || hub?.phone;
  const city = hub?.city || data?.person?.city;
  const responses = data?.responses || [];

  return (
    <>
      <FullScreenWorkspace
        isOpen={!!personId}
        onClose={onClose}
        title={name}
        subtitle="Artist Path questionnaire responses"
        mainClassName="max-w-3xl"
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
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        )}

        {!isLoading && (
          <>
            <Card className="p-4 mb-6">
              <div className="flex flex-wrap gap-3 text-sm">
                {email && (
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Mail size={14} /> {email}
                  </span>
                )}
                {phone && (
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Phone size={14} /> {phone}
                  </span>
                )}
                {city && (
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <MapPin size={14} /> {city}
                  </span>
                )}
              </div>
            </Card>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCrmTab(false)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                  !crmTab ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)]'
                }`}
              >
                Q&amp;A ({responses.length})
              </button>
              <button
                type="button"
                onClick={() => setCrmTab(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                  crmTab ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)]'
                }`}
              >
                CRM summary
              </button>
            </div>

            {!crmTab && (
              <div className="space-y-4">
                {responses.map((resp) => (
                  <Card key={resp._id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Music size={14} className="text-[var(--color-action-primary)]" />
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">
                          {formatDate(resp.submittedAt)}
                        </span>
                      </div>
                      {resp.answers?.artistType && (
                        <Badge variant="mint">{resp.answers.artistType}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(resp.answers || {}).map(([key, value]) => {
                        if (!value || key === 'name' || key === 'email' || key === 'phone' || key === 'city') return null;
                        return (
                          <div key={key}>
                            <p className="text-[9px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                              {answerLabel(key)}
                            </p>
                            <p className="text-sm mt-0.5">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
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
