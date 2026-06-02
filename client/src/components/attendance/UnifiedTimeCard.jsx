import React from 'react';
import { Card, Button, NexusDropdown } from '../ui';
import { Lock, Check, LogIn, LogOut, RotateCcw, Info } from 'lucide-react';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';

const PASTEL_ROSE_CELL = 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/20';
const PASTEL_ROSE_TEXT = 'text-[var(--color-pastel-rose-text)]';

const DISCREPANCY_INFO =
  'Difference between your check-in to check-out duration and total hours logged in Daily Logs for this day. Shown when the gap is 30 minutes or more. Keep both aligned for the attendance day bonus.';

const UnifiedTimeCard = ({
  entry,
  title,
  subTitle,
  isSelfMode,
  editScope,
  onCheckIn,
  onCheckOut,
  onUndo,
  editForm,
  setEditForm,
  onApproveIn,
  onApproveOut,
  isLoading
}) => {
  const [localForm, setLocalForm] = React.useState({ inTime: '', outTime: '', inMode: 'office', outMode: 'office' });
  const form = editForm || localForm;
  const setForm = setEditForm || setLocalForm;

  const inAppr = !!entry?.inTimeRecord?.isApproved;
  const outAppr = !!entry?.outTimeRecord?.isApproved;
  const hasIn = !!entry?.inTimeRecord?.manualTimestamp;
  const hasOut = !!entry?.outTimeRecord?.manualTimestamp;
  const { addToast } = useSystemToast();

  const handleApproveIn = () => {
    if (!form?.inTime) {
      addToast({ type: 'error', message: 'Morning check-in time cannot be empty.', module: MODULE.ATTENDANCE });
      return;
    }
    if (onApproveIn) onApproveIn();
  };

  const handleApproveOut = () => {
    if (!form?.outTime) {
      addToast({ type: 'error', message: 'Evening check-out time cannot be empty.', module: MODULE.ATTENDANCE });
      return;
    }
    if (onApproveOut) onApproveOut();
  };

  const TimeDisplayBlock = ({ type, time, mode, approved, marked, emptyHint }) => {
    const recorded = !!(time || marked || approved);
    return (
      <div
        className={`rounded-xl border px-4 py-3 ${
          approved
            ? 'bg-blue-500/10 border-blue-500/30'
            : marked
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-[var(--color-bg-secondary)]/60 border-dashed border-[var(--color-bg-border)]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{type}</p>
            {recorded ? (
              <span className="text-lg font-black tabular-nums">{time || '--:--'}</span>
            ) : (
              <p className="text-[13px] font-semibold text-[var(--color-text-muted)] leading-snug normal-case tracking-normal">
                {emptyHint}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {approved ? <Lock size={14} className="text-blue-500" /> : marked ? <Check size={16} className="text-emerald-500" /> : null}
            {recorded && mode && (
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{mode}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Wrapper = isSelfMode ? Card : 'div';

  return (
    <Wrapper className={isSelfMode ? "p-6 space-y-6" : "space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] shrink-0">{subTitle}</p>
          <p className="text-2xl font-black shrink-0">{title}</p>
          {entry?.overtimeMinutes > 0 && (
            <span className="shrink-0 px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 border border-violet-500/20 text-xs font-bold">
              OT: {Math.round(entry.overtimeMinutes / 60 * 10) / 10}h
            </span>
          )}
          {entry?.discrepancyMinutes >= 30 && (
            <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg ${PASTEL_ROSE_CELL} ${PASTEL_ROSE_TEXT} text-xs font-bold`}>
              Discrepancy: {entry.discrepancyMinutes} Minutes
              <button
                type="button"
                title={DISCREPANCY_INFO}
                aria-label={DISCREPANCY_INFO}
                className="inline-flex items-center opacity-80 hover:opacity-100 transition-opacity"
              >
                <Info size={13} strokeWidth={2.5} />
              </button>
            </span>
          )}
        </div>
        {(inAppr || outAppr) && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <Lock size={14} />
            {inAppr && outAppr
              ? (entry?.xpGrantedAt ? 'Locked — XP awarded' : 'Fully locked (XP on lock)')
              : 'Partially locked'}
          </span>
        )}
      </div>

      {isSelfMode ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TimeDisplayBlock
              type="Time In"
              time={entry?.inTimeRecord?.manualTimestamp}
              mode={entry?.inTimeRecord?.workMode}
              marked={hasIn}
              approved={inAppr}
              emptyHint="Enter your start time below"
            />
            <TimeDisplayBlock
              type="Time Out"
              time={entry?.outTimeRecord?.manualTimestamp}
              mode={entry?.outTimeRecord?.workMode}
              marked={hasOut}
              approved={outAppr}
              emptyHint={hasIn ? 'Enter your end time below' : 'Check in first'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Declare In-Time</label>
              <input type="time" disabled={inAppr} value={form?.inTime || ''} onChange={(e) => setForm && setForm((f) => ({ ...f, inTime: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]" />
              <Button
                variant="primary"
                className="!py-3 w-full"
                disabled={hasIn || inAppr || !form?.inTime || isLoading}
                onClick={() => onCheckIn && onCheckIn(form?.inTime)}
              >
                {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" /> : <LogIn size={16} className="mr-2" />}
                {isLoading ? 'Processing...' : 'Mark In'}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Declare Out-Time</label>
              <input type="time" disabled={outAppr} value={form?.outTime || ''} onChange={(e) => setForm && setForm((f) => ({ ...f, outTime: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]" />
              <Button
                variant="primary"
                className="!py-3 w-full"
                disabled={hasOut || outAppr || !form?.outTime || isLoading}
                onClick={() => onCheckOut && onCheckOut(form?.outTime)}
              >
                {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" /> : <LogOut size={16} className="mr-2" />}
                {isLoading ? 'Processing...' : 'Mark Out'}
              </Button>
            </div>
          </div>

          {(hasIn || hasOut) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {hasIn && !inAppr && (
                <Button size="sm" variant="ghost" onClick={() => onUndo && onUndo('in')}>
                  <RotateCcw size={14} className="mr-1.5" />
                  Undo check-in
                </Button>
              )}
              {hasOut && !outAppr && (
                <Button size="sm" variant="ghost" onClick={() => onUndo && onUndo('out')}>
                  <RotateCcw size={14} className="mr-1.5" />
                  Undo check-out
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {(!editScope || editScope === 'in') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-2">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">MORNING CHECK-IN DATA</p>
                {inAppr && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600">
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">System Logged</label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                    <span className="text-sm font-bold block">{entry?.inTimeRecord?.systemTimestamp ? new Date(entry.inTimeRecord.systemTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{entry?.inTimeRecord?.workMode || 'NONE'} - {entry?.inTimeRecord?.verificationMethod || 'NONE'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">User Declared</label>
                  <input type="time" disabled={inAppr} value={form?.inTime || ''} onChange={(e) => setForm && setForm((f) => ({ ...f, inTime: e.target.value }))} className="w-full mt-1 px-3 py-[9px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Mode Override</label>
                  <div className="mt-1">
                    <NexusDropdown
                      options={[{ value: 'wfh', label: 'WFH' }, { value: 'office', label: 'Office' }]}
                      value={form?.inMode || 'office'}
                      onChange={(v) => setForm && setForm((f) => ({ ...f, inMode: v }))}
                    />
                  </div>
                </div>
              </div>
              {!inAppr && form?.inTime && (
                <Button size="sm" variant="primary" className="w-full mt-2" onClick={handleApproveIn}>
                  ⚡ APPROVE IN-TIME ONLY
                </Button>
              )}
            </div>
          )}

          {(!editScope || editScope === 'out') && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-2">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">EVENING CHECK-OUT DATA</p>
                {outAppr && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600">
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">System Logged</label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                    <span className="text-sm font-bold block">{entry?.outTimeRecord?.systemTimestamp ? new Date(entry.outTimeRecord.systemTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{entry?.outTimeRecord?.workMode || 'NONE'} - {entry?.outTimeRecord?.verificationMethod || 'NONE'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">User Declared</label>
                  <input type="time" disabled={outAppr} value={form?.outTime || ''} onChange={(e) => setForm && setForm((f) => ({ ...f, outTime: e.target.value }))} className="w-full mt-1 px-3 py-[9px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Mode Override</label>
                  <div className="mt-1">
                    <NexusDropdown
                      options={[{ value: 'wfh', label: 'WFH' }, { value: 'office', label: 'Office' }]}
                      value={form?.outMode || 'office'}
                      onChange={(v) => setForm && setForm((f) => ({ ...f, outMode: v }))}
                    />
                  </div>
                </div>
              </div>
              {!outAppr && form?.outTime && (
                <Button size="sm" variant="primary" className="w-full mt-2" onClick={handleApproveOut}>
                  ⚡ APPROVE OUT-TIME ONLY
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
};

export default UnifiedTimeCard;
