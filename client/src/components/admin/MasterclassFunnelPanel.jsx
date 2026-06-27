import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Button, Skeleton } from '../ui';
import { formatInr, formatPercent } from '../../utils/exlyFormatters';
import { shortMentorName } from '../../utils/exlyCourseLabels';

const MetricBlock = ({ label, value, sub, tone = 'default' }) => {
  const toneClass = {
    mint: 'text-[var(--color-pastel-mint-text)]',
    rose: 'text-[var(--color-pastel-rose-text)]',
    muted: 'text-[var(--color-text-muted)]',
    default: 'text-[var(--color-text-primary)]',
  }[tone] || 'text-[var(--color-text-primary)]';

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-xl font-black font-mono tabular-nums leading-tight mt-0.5 ${toneClass}`}>{value}</p>
      {sub && (
        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] mt-0.5">{sub}</p>
      )}
    </div>
  );
};

const ConvBadge = ({ rate, enrollments }) => {
  if (!enrollments) {
    return (
      <span className="text-[10px] font-mono text-[var(--color-text-muted)]">—</span>
    );
  }
  const strong = rate >= 5;
  return (
    <span
      className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${
        strong
          ? 'text-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)]'
          : 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'
      }`}
    >
      {formatPercent(rate)}
    </span>
  );
};

const MENTOR_BADGE = {
  Sandesh: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
  Prasad: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)]',
};

const MentorBadge = ({ mentorShort }) => {
  if (!mentorShort || mentorShort === 'TSC') return null;
  const cls = MENTOR_BADGE[mentorShort] || 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]';
  return (
    <span className={`inline-flex text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cls}`}>
      {mentorShort}
    </span>
  );
};

const CoursePills = ({ courses }) => {
  if (!courses?.length) {
    return <span className="text-[10px] text-[var(--color-text-muted)] italic">No course enrollments yet</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {courses.map((c) => (
        <span
          key={`${c.shortName}-${c.priceLabel}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-primary)]"
          title={`${c.shortName} at ${c.priceLabel}`}
        >
          <span className="font-black font-mono text-[var(--color-pastel-mint-text)]">{c.count}</span>
          <span className="font-bold">{c.shortName}</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span className="font-mono text-[var(--color-text-muted)]">{c.priceLabel}</span>
        </span>
      ))}
    </div>
  );
};

const SessionRow = ({ session, expanded, onToggle, onOpenSession }) => (
  <>
    <tr
      className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/40 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <td className="py-2.5 px-3 align-top w-8">
        {expanded ? (
          <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
        )}
      </td>
      <td className="py-2.5 px-3 align-top min-w-[160px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <MentorBadge mentorShort={session.mentorShort || shortMentorName(session.mentor)} />
          <p className="text-xs font-bold text-[var(--color-text-primary)] leading-snug">{session.masterclass}</p>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">{session.sessionLabel}</p>
      </td>
      <td className="py-2.5 px-3 align-top text-right">
        <span className="text-sm font-black font-mono text-[var(--color-text-primary)]">
          {session.registrations.toLocaleString('en-IN')}
        </span>
        <p className="text-[9px] text-[var(--color-text-muted)] font-mono">
          {session.paidRegistrations} paid · {session.freeRegistrations} free
        </p>
      </td>
      <td className="py-2.5 px-3 align-top text-center">
        <span className="text-sm font-black font-mono text-[var(--color-pastel-mint-text)]">
          {session.courseEnrollments.toLocaleString('en-IN')}
        </span>
      </td>
      <td className="py-2.5 px-3 align-top text-center">
        <ConvBadge rate={session.conversionRate} enrollments={session.courseEnrollments} />
      </td>
      <td className="py-2.5 px-3 align-top hidden lg:table-cell">
        <CoursePills courses={session.coursesEnrolled?.slice(0, 2)} />
      </td>
      <td className="py-2.5 px-3 align-top text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!text-[10px] !h-7 !px-2"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSession?.(session.exlyOfferingId);
          }}
        >
          Registrants
        </Button>
      </td>
    </tr>
    {expanded && (
      <tr className="bg-[var(--color-bg-secondary)]/30 border-b border-[var(--color-bg-border)]">
        <td colSpan={7} className="px-4 py-3 space-y-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Masterclass → Course
            </p>
            <CoursePills courses={session.coursesEnrolled} />
          </div>
          {session.students?.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                Enrolled students ({session.students.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {session.students.map((s, i) => (
                  <div
                    key={`${s.name}-${i}`}
                    className="text-[10px] px-2 py-1 rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
                  >
                    <span className="font-bold text-[var(--color-text-primary)]">{s.name || '—'}</span>
                    <span className="text-[var(--color-text-muted)]"> → </span>
                    <span className="font-bold text-[var(--color-pastel-mint-text)]">{s.shortName || s.course}</span>
                    {(s.priceLabel || s.plan) && (
                      <span className="block text-[9px] text-[var(--color-text-muted)] font-mono">
                        {s.priceLabel || s.plan}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[9px] font-mono text-[var(--color-text-muted)]">
            Ticket revenue ₹ {formatInr(session.masterclassRevenue, { exact: true })}
          </p>
        </td>
      </tr>
    )}
  </>
);

const MasterclassFunnelPanel = ({ onOpenSession }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('sessions');
  const [expandedId, setExpandedId] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/exly/masterclass-funnel');
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load masterclass funnel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = report?.summary;
  const themes = report?.themes || [];
  const sessions = report?.sessions || [];

  const funnelArrow = useMemo(() => {
    if (!summary) return '';
    return `${summary.totalRegistrations.toLocaleString('en-IN')} regs → ${summary.totalCourseEnrollments.toLocaleString('en-IN')} course`;
  }, [summary]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-bg-border)]">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
              Masterclass → Course
            </h2>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 max-w-xl">
            Live masterclass interest (Exly registrations) matched to CRM Converted leads — same email/phone cohort.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={fetchReport}
          className="!text-[10px] shrink-0"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="py-2 px-3 border border-[#C5221F]/20 bg-[#FCE8E6] text-[#C5221F] flex items-center gap-2 text-[10px] font-bold rounded">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-[var(--color-bg-border)]">
            <MetricBlock
              label="Funnel"
              value={funnelArrow}
              sub={`${formatPercent(summary.overallConversionRate)} overall`}
            />
            <MetricBlock
              label="Sessions"
              value={String(summary.masterclassSessions)}
              sub={`${summary.sessionsWithEnrollments} with enrollments`}
            />
            <MetricBlock
              label="Typical session"
              value={String(summary.medianEnrollmentsPerSession)}
              sub={`avg ${summary.avgEnrollmentsPerSession} course enrollments`}
              tone="mint"
            />
            <MetricBlock
              label="Ticket revenue"
              value={`₹ ${formatInr(summary.masterclassTicketRevenue, { exact: true })}`}
              tone="muted"
            />
          </div>

          <div className="flex gap-2 border-b border-[var(--color-bg-border)]">
            {[
              { id: 'sessions', label: 'By session' },
              { id: 'themes', label: 'By masterclass theme' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                  view === tab.id
                    ? 'border-[var(--color-action-primary)] text-[var(--color-text-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {view === 'themes' ? (
            <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-lg">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                    <th className="py-2 px-3">Masterclass</th>
                    <th className="py-2 px-3 text-right">Regs</th>
                    <th className="py-2 px-3 text-center">→ Course</th>
                    <th className="py-2 px-3 text-center">Conv %</th>
                    <th className="py-2 px-3 text-center">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {themes.map((t) => (
                    <tr
                      key={t.masterclass}
                      className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/40"
                    >
                      <td className="py-2.5 px-3 text-xs font-bold text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MentorBadge mentorShort={shortMentorName(t.mentor)} />
                          <span>{t.masterclass}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-sm">{t.registrations.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-[var(--color-pastel-mint-text)]">
                        {t.courseEnrollments.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <ConvBadge rate={t.conversionRate} enrollments={t.courseEnrollments} />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-xs">{t.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-lg">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                    <th className="py-2 px-3 w-8" aria-label="Expand" />
                    <th className="py-2 px-3">Masterclass</th>
                    <th className="py-2 px-3 text-right">Regs</th>
                    <th className="py-2 px-3 text-center">→ Course</th>
                    <th className="py-2 px-3 text-center">Conv %</th>
                    <th className="py-2 px-3 hidden lg:table-cell">Course · price</th>
                    <th className="py-2 px-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow
                      key={session.exlyOfferingId}
                      session={session}
                      expanded={expandedId === session.exlyOfferingId}
                      onToggle={() =>
                        setExpandedId((id) =>
                          id === session.exlyOfferingId ? null : session.exlyOfferingId
                        )
                      }
                      onOpenSession={onOpenSession}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report?.generatedAt && (
            <p className="text-[9px] font-mono text-[var(--color-text-muted)] text-right">
              Generated {new Date(report.generatedAt).toLocaleString('en-IN')}
            </p>
          )}
        </>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="py-12 text-center opacity-40">
          <Users size={24} className="mx-auto mb-2" />
          <p className="text-[10px] font-black uppercase tracking-widest">No masterclass sessions in Exly yet</p>
        </div>
      )}
    </div>
  );
};

export default MasterclassFunnelPanel;
