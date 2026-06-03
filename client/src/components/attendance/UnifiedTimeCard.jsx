import React from 'react';
import { Button, Badge, NexusDropdown } from '../ui';
import { Lock, Check, LogIn, LogOut, RotateCcw, Info } from 'lucide-react';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import {
  getSelfMarkPanelVisibility,
  isAtOrAfterMarkOutCutoff,
  hasRecordedCheckIn,
  hasRecordedCheckOut,
  formatAttendanceRecordTime,
} from '../../utils/attendanceUtils';

const PASTEL_ROSE_CELL = 'bg-[var(--color-pastel-rose-bg)] border-[var(--color-pastel-rose-text)]/20';
const PASTEL_ROSE_TEXT = 'text-[var(--color-pastel-rose-text)]';

const DISCREPANCY_INFO =
  'Difference between your check-in to check-out duration and total hours logged in Daily Logs for this day. Shown when the gap is 30 minutes or more. Keep both aligned for the attendance day bonus.';

const LOCKED_FIELD_CLASS =
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-secondary)] focus:ring-0';
const LOCKED_SECTION_CLASS = 'rounded-lg border border-blue-500/15 bg-blue-500/[0.03]';

/** Uncontrolled type="time" — controlled value breaks multi-digit hour/minute entry in Chrome/Edge. */
const AttendanceTimeInput = ({ value, onChange, disabled, className, 'aria-label': ariaLabel }) => {
  const inputRef = React.useRef(null);
  const [remountKey, setRemountKey] = React.useState(0);
  const lastExternal = React.useRef(value);

  React.useEffect(() => {
    if (lastExternal.current === value) return;
    if (inputRef.current && document.activeElement === inputRef.current) {
      lastExternal.current = value;
      return;
    }
    lastExternal.current = value;
    setRemountKey((k) => k + 1);
  }, [value]);

  return (
    <input
      key={remountKey}
      ref={inputRef}
      type="time"
      aria-label={ariaLabel}
      disabled={disabled}
      defaultValue={value || ''}
      onChange={onChange}
      className={className}
    />
  );
};

const UnifiedTimeCard = ({
  entry,
  title,
  subTitle,
  hideTitleRow = false,
  compact = false,
  alwaysShowMarkInAccess = false,
  isSelfMode,
  editScope,
  onCheckIn,
  onCheckOut,
  onUndo,
  editForm,
  setEditForm,
  onApproveIn,
  onApproveOut,
  isLoading,
  readOnly = false,
}) => {
  const [localForm, setLocalForm] = React.useState({ inTime: '', outTime: '', inMode: 'office', outMode: 'office' });
  const [showMarkInExpanded, setShowMarkInExpanded] = React.useState(false);
  const form = editForm || localForm;
  const setForm = setEditForm || setLocalForm;

  const inAppr = !!entry?.inTimeRecord?.isApproved;
  const outAppr = !!entry?.outTimeRecord?.isApproved;
  const inFieldLocked = inAppr || (readOnly && (!editScope || editScope === 'in'));
  const outFieldLocked = outAppr || (readOnly && (!editScope || editScope === 'out'));
  const hasIn = hasRecordedCheckIn(entry);
  const hasOut = hasRecordedCheckOut(entry);
  const inDisplayTime = formatAttendanceRecordTime(entry?.inTimeRecord);
  const outDisplayTime = formatAttendanceRecordTime(entry?.outTimeRecord);
  const { addToast } = useSystemToast();

  React.useEffect(() => {
    if (editForm) return;
    setLocalForm((f) => ({
      ...f,
      inTime: inDisplayTime || (hasIn ? '' : f.inTime),
      outTime: outDisplayTime || (hasOut ? '' : f.outTime),
      inMode: entry?.inTimeRecord?.workMode || f.inMode || 'office',
      outMode: entry?.outTimeRecord?.workMode || f.outMode || 'office',
    }));
  }, [entry, editForm, inDisplayTime, outDisplayTime, hasIn, hasOut]);

  React.useEffect(() => {
    if (hasIn) setShowMarkInExpanded(false);
  }, [hasIn]);

  const markInDisabled = hasIn || inFieldLocked || isLoading || !form?.inTime;
  const markOutDisabled = hasOut || outFieldLocked || isLoading || !form?.outTime;
  const markInTitle = inAppr
    ? 'Check-in is locked'
    : hasIn
      ? 'Check-in already recorded. Use undo to mark in again.'
      : !form?.inTime
        ? 'Enter your start time first'
        : undefined;
  const markOutTitle = outAppr
    ? 'Check-out is locked'
    : hasOut
      ? 'Check-out already recorded. Use undo to mark out again.'
      : !form?.outTime
        ? 'Enter your end time first'
        : undefined;

  const panelVisibility = getSelfMarkPanelVisibility({
    hasIn,
    hasOut,
    showInExpanded: showMarkInExpanded,
    alwaysShowMarkInAccess,
  });
  const afterMarkOutCutoff = isAtOrAfterMarkOutCutoff();

  const handleApproveIn = () => {
    if (isLoading || inFieldLocked) return;
    if (!form?.inTime) {
      addToast({ type: 'error', message: 'Morning check-in time cannot be empty.', module: MODULE.ATTENDANCE });
      return;
    }
    if (onApproveIn) onApproveIn();
  };

  const handleApproveOut = () => {
    if (isLoading) return;
    if (!form?.outTime) {
      addToast({ type: 'error', message: 'Evening check-out time cannot be empty.', module: MODULE.ATTENDANCE });
      return;
    }
    if (onApproveOut) onApproveOut();
  };

  const SelfMarkTimeControl = ({
    time,
    mode,
    marked,
    approved,
    emptyHint,
    value,
    onChange,
    inputAriaLabel,
    undoAriaLabel,
    canUndo,
    onUndo,
  }) => {
    const recorded = !!(time || marked || approved);
    const stateClass = approved
      ? 'border-blue-500/30 bg-blue-500/5'
      : marked
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-dashed border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40';
    const boxPad = compact ? 'p-2' : 'p-3';
    const timeClass = compact
      ? 'text-2xl font-semibold tabular-nums tracking-tight leading-none text-[var(--color-text-primary)]'
      : 'text-4xl font-semibold tabular-nums tracking-tight leading-none text-[var(--color-text-primary)]';
    const hintClass = compact
      ? 'text-[10px] font-medium text-[var(--color-text-muted)] leading-snug normal-case tracking-normal'
      : 'text-[11px] font-semibold text-[var(--color-text-muted)] leading-snug normal-case tracking-normal';

    const fieldRowClass = compact ? 'min-h-10' : 'min-h-12';
    const innerInputClass = compact
      ? `w-full min-w-0 min-h-10 h-10 px-0 text-center text-2xl font-semibold tabular-nums tracking-tight bg-transparent border-0 outline-none focus:ring-0 text-[var(--color-text-primary)] [color-scheme:dark] ${approved ? LOCKED_FIELD_CLASS : ''}`
      : `w-full min-w-0 min-h-12 h-12 px-0 text-center text-3xl font-semibold tabular-nums tracking-tight bg-transparent border-0 outline-none focus:ring-0 text-[var(--color-text-primary)] [color-scheme:dark] ${approved ? LOCKED_FIELD_CLASS : ''}`;
    const showStatusIcon = approved || (marked && !canUndo);
    const hasActions = canUndo || showStatusIcon;

    return (
      <div className={`rounded-[var(--radius-atomic)] border ${boxPad} ${stateClass}`}>
        {!recorded && <p className={`${hintClass} mb-1.5`}>{emptyHint}</p>}
        <div
          className={`grid items-center min-w-0 ${hasActions ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-1'} ${fieldRowClass}`}
        >
          {hasActions && <div aria-hidden className="min-w-0" />}
          <div className="flex min-w-0 justify-center">
            {recorded ? (
              <span className={`${timeClass} truncate text-center`}>
                {time || '--:--'}
              </span>
            ) : (
              <AttendanceTimeInput
                aria-label={inputAriaLabel}
                disabled={approved}
                value={value}
                onChange={onChange}
                className={innerInputClass}
              />
            )}
          </div>
          {hasActions && (
            <div className="flex shrink-0 items-center justify-end gap-1">
              {canUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  aria-label={undoAriaLabel}
                  title={undoAriaLabel}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-atomic)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-action-primary)]"
                >
                  <RotateCcw size={compact ? 13 : 14} />
                </button>
              )}
              {showStatusIcon && (
                <span className="inline-flex h-7 w-7 items-center justify-center" aria-hidden>
                  {approved ? (
                    <Lock size={compact ? 12 : 14} className="text-blue-500" />
                  ) : (
                    <Check size={compact ? 14 : 16} className="text-emerald-500" />
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        {recorded && mode && (
          <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] mt-1 text-right truncate">{mode}</p>
        )}
      </div>
    );
  };

  const wrapperClass = compact
    ? 'space-y-2'
    : isSelfMode
      ? hideTitleRow
        ? 'space-y-6'
        : 'space-y-6 border-t border-[var(--color-bg-border)] pt-4'
      : 'space-y-6';

  const panelGridClass = compact
    ? panelVisibility.showInPanel && panelVisibility.showOutPanel
      ? 'grid grid-cols-2 gap-2 min-w-0'
      : 'grid grid-cols-1 gap-2 min-w-0'
    : panelVisibility.showInPanel && panelVisibility.showOutPanel
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      : 'grid grid-cols-1 gap-4 max-w-md';
  const panelBodyClass = compact ? 'p-2.5 space-y-2.5 flex flex-col flex-1 min-w-0' : 'p-4 space-y-4 flex flex-col flex-1';
  const panelHeaderClass = compact ? 'px-2.5 py-1.5' : 'px-3 py-2';
  const markActionClass = compact ? 'space-y-1.5' : 'space-y-2';
  const actionBtnClass = compact ? '!py-2 w-full text-xs' : '!py-3 w-full';
  const inEmptyHint = compact ? 'Not checked in' : 'Enter your start time below';
  const outEmptyHint = hasIn
    ? compact
      ? 'Not checked out'
      : 'Enter your end time below'
    : 'Check in first';

  const showIdentity = !hideTitleRow && (title || subTitle);
  const showOvertime = entry?.overtimeMinutes > 0;
  const showDiscrepancy = entry?.discrepancyMinutes >= 30;
  const showLocked = inAppr || outAppr;
  const showBadges = showOvertime || showDiscrepancy;
  const showMetaSection = showIdentity || showBadges || showLocked;

  return (
    <div className={wrapperClass}>
      {showMetaSection && (
        <div className="space-y-2">
          {(showIdentity || showLocked) && (
            <div className="relative flex items-start gap-3 min-w-0">
              {showIdentity && (
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  {subTitle && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      {subTitle}
                    </p>
                  )}
                  {title && (
                    <p className="text-2xl font-black leading-tight">{title}</p>
                  )}
                </div>
              )}
              
            </div>
          )}
          {showBadges && (
            <div className="flex flex-wrap items-center gap-2">
              {showOvertime && (
                <span className="shrink-0 px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 border border-violet-500/20 text-xs font-bold">
                  OT: {Math.round(entry.overtimeMinutes / 60 * 10) / 10}h
                </span>
              )}
              {showDiscrepancy && (
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
          )}
        </div>
      )}

      {isSelfMode ? (
        <>
          <div className={panelGridClass}>
            {panelVisibility.showInPanel && (
            <section className="flex flex-col rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] border-l-[3px] border-l-emerald-500/80 overflow-hidden min-w-0">
              <div className={`${panelHeaderClass} border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 flex items-center gap-1.5 min-w-0`}>
                <LogIn size={compact ? 12 : 14} className="text-emerald-500 shrink-0" />
                <p className="tm-widget-label mb-0 normal-case tracking-[0.08em] text-emerald-600 dark:text-emerald-400 truncate">Time In</p>
                {hasIn && (
                  <Badge variant="success" className="ml-auto shrink-0 !text-[9px] !py-0.5 !px-1.5 normal-case tracking-normal font-semibold">
                    {inAppr ? 'Locked' : 'Marked in'}
                  </Badge>
                )}
              </div>
              <div className={panelBodyClass}>
                <div className={markActionClass}>
                  <SelfMarkTimeControl
                    time={inDisplayTime}
                    mode={entry?.inTimeRecord?.workMode}
                    marked={hasIn}
                    approved={inAppr}
                    emptyHint={inEmptyHint}
                    value={form?.inTime}
                    onChange={(e) => setForm && setForm((f) => ({ ...f, inTime: e.target.value }))}
                    inputAriaLabel="Declare in-time"
                    undoAriaLabel="Undo check-in"
                    canUndo={hasIn && !inAppr}
                    onUndo={() => onUndo && onUndo('in')}
                  />
                 
                  <Button
                    variant={hasIn || inAppr ? 'secondary' : 'primary'}
                    size={compact ? 'sm' : 'md'}
                    className={`${actionBtnClass} ${markInDisabled ? 'opacity-50 cursor-not-allowed hover:opacity-50 active:scale-100' : ''}`}
                    disabled={markInDisabled}
                    title={markInTitle}
                    aria-label={hasIn ? 'Check-in already recorded' : 'Mark in'}
                    onClick={() => {
                      if (markInDisabled) return;
                      onCheckIn && onCheckIn(form?.inTime);
                    }}
                  >
                    {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" /> : hasIn ? <Check size={compact ? 14 : 16} className={compact ? 'mr-1.5' : 'mr-2'} /> : <LogIn size={compact ? 14 : 16} className={compact ? 'mr-1.5' : 'mr-2'} />}
                    {isLoading ? 'Processing...' : hasIn ? (inAppr ? 'Check-in locked' : 'Marked in') : 'Mark In'}
                  </Button>
                </div>
                {afterMarkOutCutoff && !hasIn && showMarkInExpanded && (
                  <button
                    type="button"
                    onClick={() => setShowMarkInExpanded(false)}
                    className="text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-colors self-start"
                  >
                    Mark out instead
                  </button>
                )}
              </div>
            </section>
            )}

            {panelVisibility.showOutPanel && (
            <section className="flex flex-col rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] border-l-[3px] border-l-[var(--color-action-primary)]/80 overflow-hidden min-w-0">
              <div className={`${panelHeaderClass} border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 flex items-center gap-1.5 min-w-0`}>
                <LogOut size={compact ? 12 : 14} className="text-[var(--color-action-primary)] shrink-0" />
                <p className="tm-widget-label mb-0 normal-case tracking-[0.08em] text-[var(--color-action-primary)] truncate">Time Out</p>
                {hasOut && (
                  <Badge variant="success" className="ml-auto shrink-0 !text-[9px] !py-0.5 !px-1.5 normal-case tracking-normal font-semibold">
                    {outAppr ? 'Locked' : 'Marked out'}
                  </Badge>
                )}
              </div>
              <div className={panelBodyClass}>
                <div className={markActionClass}>
                  <SelfMarkTimeControl
                    time={outDisplayTime}
                    mode={entry?.outTimeRecord?.workMode}
                    marked={hasOut}
                    approved={outAppr}
                    emptyHint={outEmptyHint}
                    value={form?.outTime}
                    onChange={(e) => setForm && setForm((f) => ({ ...f, outTime: e.target.value }))}
                    inputAriaLabel="Declare out-time"
                    undoAriaLabel="Undo check-out"
                    canUndo={hasOut && !outAppr}
                    onUndo={() => onUndo && onUndo('out')}
                  />
                  {hasOut && !outAppr && (
                    <p className="text-[10px] font-medium text-[var(--color-text-muted)] leading-snug">
                      Already recorded{outDisplayTime ? ` at ${outDisplayTime}` : ''}. Undo to change.
                    </p>
                  )}
                  <Button
                    variant={hasOut || outAppr ? 'secondary' : 'primary'}
                    size={compact ? 'sm' : 'md'}
                    className={`${actionBtnClass} ${markOutDisabled ? 'opacity-50 cursor-not-allowed hover:opacity-50 active:scale-100' : ''}`}
                    disabled={markOutDisabled}
                    title={markOutTitle}
                    aria-label={hasOut ? 'Check-out already recorded' : 'Mark out'}
                    onClick={() => {
                      if (markOutDisabled) return;
                      onCheckOut && onCheckOut(form?.outTime);
                    }}
                  >
                    {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" /> : hasOut ? <Check size={compact ? 14 : 16} className={compact ? 'mr-1.5' : 'mr-2'} /> : <LogOut size={compact ? 14 : 16} className={compact ? 'mr-1.5' : 'mr-2'} />}
                    {isLoading ? 'Processing...' : hasOut ? (outAppr ? 'Check-out locked' : 'Marked out') : 'Mark Out'}
                  </Button>
                </div>
                {panelVisibility.showMarkInToggle && (
                  <button
                    type="button"
                    onClick={() => setShowMarkInExpanded(true)}
                    className="text-[11px] font-medium text-[var(--color-action-primary)] hover:underline transition-colors self-start"
                  >
                    Need to mark in?
                  </button>
                )}
              </div>
            </section>
            )}
          </div>
          {compact && hasIn && hasOut && (
            <div className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30 px-2 py-1.5">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
                {inDisplayTime || '--:--'}
                {' → '}
                {outDisplayTime || '--:--'}
              </span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                <div className="min-w-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">System Logged</label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                    <span className="text-sm font-bold block">{entry?.inTimeRecord?.systemTimestamp ? new Date(entry.inTimeRecord.systemTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{entry?.inTimeRecord?.workMode || 'NONE'} - {entry?.inTimeRecord?.verificationMethod || 'NONE'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">User Declared</label>
                  <AttendanceTimeInput
                    disabled={inFieldLocked}
                    value={form?.inTime}
                    onChange={(e) => !inFieldLocked && setForm && setForm((f) => ({ ...f, inTime: e.target.value }))}
                    className={`w-full mt-1 px-3 py-[9px] rounded-lg border border-[var(--color-bg-border)] font-bold text-sm ${inFieldLocked ? `bg-[var(--color-bg-secondary)] ${LOCKED_FIELD_CLASS}` : 'bg-[var(--color-bg-primary)]'}`}
                  />
                </div>
                <div className={`min-w-0 overflow-hidden ${inFieldLocked ? 'opacity-60' : ''}`}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Mode Override</label>
                  <div className="mt-1 min-w-0">
                    <NexusDropdown
                      matchTriggerWidth
                      disabled={inFieldLocked}
                      options={[{ value: 'wfh', label: 'WFH' }, { value: 'office', label: 'Office' }]}
                      value={form?.inMode || 'office'}
                      onChange={(v) => !inFieldLocked && setForm && setForm((f) => ({ ...f, inMode: v }))}
                    />
                  </div>
                </div>
              </div>
              {!inFieldLocked && form?.inTime && (
                <Button
                  size="sm"
                  variant="primary"
                  className={`w-full mt-2 ${isLoading ? 'opacity-50 cursor-not-allowed hover:opacity-50 active:scale-100' : ''}`}
                  disabled={isLoading}
                  onClick={handleApproveIn}
                >
                  {isLoading && <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" />}
                  {isLoading ? 'Approving...' : '⚡ APPROVE IN-TIME ONLY'}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                <div className="min-w-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">System Logged</label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                    <span className="text-sm font-bold block">{entry?.outTimeRecord?.systemTimestamp ? new Date(entry.outTimeRecord.systemTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{entry?.outTimeRecord?.workMode || 'NONE'} - {entry?.outTimeRecord?.verificationMethod || 'NONE'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">User Declared</label>
                  <AttendanceTimeInput
                    disabled={outFieldLocked}
                    value={form?.outTime}
                    onChange={(e) => !outFieldLocked && setForm && setForm((f) => ({ ...f, outTime: e.target.value }))}
                    className={`w-full mt-1 px-3 py-[9px] rounded-lg border border-[var(--color-bg-border)] font-bold text-sm ${outFieldLocked ? `bg-[var(--color-bg-secondary)] ${LOCKED_FIELD_CLASS}` : 'bg-[var(--color-bg-primary)]'}`}
                  />
                </div>
                <div className={`min-w-0 overflow-hidden ${outFieldLocked ? 'opacity-60' : ''}`}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Mode Override</label>
                  <div className="mt-1 min-w-0">
                    <NexusDropdown
                      matchTriggerWidth
                      disabled={outFieldLocked}
                      options={[{ value: 'wfh', label: 'WFH' }, { value: 'office', label: 'Office' }]}
                      value={form?.outMode || 'office'}
                      onChange={(v) => !outFieldLocked && setForm && setForm((f) => ({ ...f, outMode: v }))}
                    />
                  </div>
                </div>
              </div>
              {!outFieldLocked && form?.outTime && (
                <Button
                  size="sm"
                  variant="primary"
                  className={`w-full mt-2 ${isLoading ? 'opacity-50 cursor-not-allowed hover:opacity-50 active:scale-100' : ''}`}
                  disabled={isLoading}
                  onClick={handleApproveOut}
                >
                  {isLoading && <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2" />}
                  {isLoading ? 'Approving...' : '⚡ APPROVE OUT-TIME ONLY'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedTimeCard;
