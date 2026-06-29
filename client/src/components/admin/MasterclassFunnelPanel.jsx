import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDisplayDateTime } from '../../utils/dateDisplay';
import axios from 'axios';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  GraduationCap,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Button, DeltaBadge, Skeleton } from '../ui';
import { formatInr, formatPercent } from '../../utils/exlyFormatters';
import { shortMentorName } from '../../utils/exlyCourseLabels';
import ExlyPageLegend from './ExlyPageLegend';

const MENTOR_FILTERS = ['Sandesh', 'Prasad'];

const MENTOR_BADGE = {
  Sandesh: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
  Prasad: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)]',
};

const SORT_OPTIONS = [
  { id: 'regs_desc', label: 'Regs ↓' },
  { id: 'conv_desc', label: 'Conv% ↓' },
  { id: 'conv_asc', label: 'Conv% ↑' },
  { id: 'date_desc', label: 'Date ↓' },
  { id: 'date_asc', label: 'Date ↑' },
];

function parseSessionTimestamp(session) {
  const raw = session.sessionDate || session.sessionLabel?.split('·')[0]?.trim() || '';
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function hasMeaningfulPrice(priceLabel) {
  if (!priceLabel) return false;
  const trimmed = String(priceLabel).trim();
  return trimmed !== '' && trimmed !== '—' && trimmed !== '-';
}

function computePeriodDeltas(sessions) {
  const dated = sessions
    .map((s) => ({ ...s, ts: parseSessionTimestamp(s) }))
    .filter((s) => s.ts > 0)
    .sort((a, b) => a.ts - b.ts);

  if (dated.length < 2) return null;

  const mid = Math.floor(dated.length / 2);
  const prior = dated.slice(0, mid);
  const recent = dated.slice(mid);

  const agg = (list) =>
    list.reduce(
      (acc, s) => {
        acc.regs += s.registrations;
        acc.enrollments += s.courseEnrollments;
        acc.revenue += s.masterclassRevenue;
        return acc;
      },
      { regs: 0, enrollments: 0, revenue: 0 },
    );

  const p = agg(prior);
  const r = agg(recent);
  const convPrior = p.regs ? (p.enrollments / p.regs) * 100 : 0;
  const convRecent = r.regs ? (r.enrollments / r.regs) * 100 : 0;

  const pctChange = (next, prev) => {
    if (!prev && !next) return null;
    if (!prev) return 100;
    return Number((((next - prev) / prev) * 100).toFixed(1));
  };

  return {
    conversionDelta: Number((convRecent - convPrior).toFixed(1)),
    regsPct: pctChange(r.regs, p.regs),
    revenuePct: pctChange(r.revenue, p.revenue),
    periodLabel: 'vs earlier sessions',
  };
}

const MetricBlock = ({ label, value, sub, tone = 'default', delta, deltaSuffix = '', deltaLabel }) => {
  const toneClass = {
    mint: 'text-[var(--color-pastel-mint-text)]',
    rose: 'text-[var(--color-pastel-rose-text)]',
    muted: 'text-[var(--color-text-muted)]',
    default: 'text-[var(--color-text-primary)]',
  }[tone] || 'text-[var(--color-text-primary)]';

  const deltaDirection =
    delta == null || delta === 0 ? null : delta > 0 ? 'up' : 'down';
  const deltaText =
    delta == null || delta === 0
      ? null
      : `${delta > 0 ? '+' : ''}${delta}${deltaSuffix}`;

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-xl font-black font-mono tabular-nums leading-tight mt-0.5 ${toneClass}`}>{value}</p>
      {(sub || deltaText) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {sub && (
            <p className="text-[9px] font-semibold text-[var(--color-text-muted)]">{sub}</p>
          )}
          {deltaText && deltaDirection && (
            <DeltaBadge
              value={deltaText}
              direction={deltaDirection}
              className="!text-[9px] !px-1 !py-0"
            />
          )}
          {deltaLabel && deltaText && (
            <span className="text-[8px] text-[var(--color-text-muted)]">{deltaLabel}</span>
          )}
        </div>
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
      {courses.map((c) => {
        const showPrice = hasMeaningfulPrice(c.priceLabel);
        return (
          <span
            key={`${c.shortName}-${c.priceLabel}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-primary)]"
            title={showPrice ? `${c.shortName} · ${c.priceLabel}` : c.shortName}
          >
            <span className="font-black font-mono text-[var(--color-pastel-mint-text)]">{c.count}</span>
            <span className="font-bold">{c.shortName}</span>
            {showPrice && (
              <>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="font-mono text-[var(--color-text-muted)]">{c.priceLabel}</span>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
};

const MentorFilterPills = ({ counts, active, onChange }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mr-0.5">
      Mentor
    </span>
    {MENTOR_FILTERS.map((name) => {
      const isActive = active === name;
      const swatch = MENTOR_BADGE[name] || 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]';
      return (
        <button
          key={name}
          type="button"
          onClick={() => onChange(isActive ? null : name)}
          className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all ${
            isActive
              ? `${swatch} border-current ring-1 ring-current/30`
              : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:text-[var(--color-text-primary)]'
          }`}
          aria-pressed={isActive}
        >
          {name}
          <span className={`font-mono text-[8px] ${isActive ? 'opacity-90' : 'opacity-70'}`}>
            ({counts[name] || 0})
          </span>
        </button>
      );
    })}
    {active && (
      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-[9px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
      >
        Clear
      </button>
    )}
  </div>
);

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
          className="!h-7 !w-7 !p-0"
          title="View registrants"
          aria-label={`View registrants for ${session.masterclass}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenSession?.(session.exlyOfferingId);
          }}
        >
          <Eye size={14} />
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
                    {hasMeaningfulPrice(s.priceLabel || s.plan) && (
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
  const [mentorFilter, setMentorFilter] = useState(null);
  const [sortBy, setSortBy] = useState('regs_desc');

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

  const mentorCounts = useMemo(() => {
    const counts = { Sandesh: 0, Prasad: 0 };
    sessions.forEach((s) => {
      const m = s.mentorShort || shortMentorName(s.mentor);
      if (counts[m] !== undefined) counts[m] += 1;
    });
    return counts;
  }, [sessions]);

  const periodDeltas = useMemo(() => computePeriodDeltas(sessions), [sessions]);

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (mentorFilter) {
      list = list.filter((s) => (s.mentorShort || shortMentorName(s.mentor)) === mentorFilter);
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'conv_desc':
          return b.conversionRate - a.conversionRate || b.registrations - a.registrations;
        case 'conv_asc':
          return a.conversionRate - b.conversionRate || b.registrations - a.registrations;
        case 'date_desc':
          return parseSessionTimestamp(b) - parseSessionTimestamp(a) || b.registrations - a.registrations;
        case 'date_asc':
          return parseSessionTimestamp(a) - parseSessionTimestamp(b) || b.registrations - a.registrations;
        case 'regs_desc':
        default:
          return b.registrations - a.registrations || b.courseEnrollments - a.courseEnrollments;
      }
    });
    return sorted;
  }, [sessions, mentorFilter, sortBy]);

  const filteredThemes = useMemo(() => {
    if (!mentorFilter) return themes;
    return themes.filter((t) => shortMentorName(t.mentor) === mentorFilter);
  }, [themes, mentorFilter]);

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
              delta={periodDeltas?.conversionDelta}
              deltaSuffix="pp"
              deltaLabel={periodDeltas?.periodLabel}
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
              delta={periodDeltas?.revenuePct}
              deltaSuffix="%"
              deltaLabel={periodDeltas?.periodLabel}
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <MentorFilterPills
              counts={mentorCounts}
              active={mentorFilter}
              onChange={setMentorFilter}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ExlyPageLegend />
              {view === 'sessions' && (
                <label className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                  <span className="font-bold uppercase tracking-wider">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-[10px] font-bold bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded px-2 py-1 text-[var(--color-text-primary)]"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
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
                  {filteredThemes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[10px] text-[var(--color-text-muted)]">
                        No themes match this mentor filter.
                      </td>
                    </tr>
                  ) : (
                    filteredThemes.map((t) => (
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
                    ))
                  )}
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
                    <th className="py-2 px-3 hidden lg:table-cell">Course</th>
                    <th className="py-2 px-3 text-right w-10" aria-label="Registrants" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[10px] text-[var(--color-text-muted)]">
                        No sessions match this mentor filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {report?.generatedAt && (
            <p className="text-[9px] font-mono text-[var(--color-text-muted)] text-right">
              Generated {formatDisplayDateTime(report.generatedAt)}
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
