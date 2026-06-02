import React, { useMemo } from 'react';
import { getMonthRangeBounds } from '../../../utils/monthlyReportRange';

const PRESETS = ['1d', '7d', '30d'];

const dateInputClass =
  'px-2 py-1 text-xs font-medium rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]';

const segmentClass = (active) =>
  `px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
    active
      ? 'border-[var(--color-action-primary)] text-[var(--color-action-primary)]'
      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
  }`;

export default function ReportRangeControls({
  month,
  rangeMode,
  onRangeModeChange,
  timeframe,
  onTimeframeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}) {
  const bounds = useMemo(() => getMonthRangeBounds(month), [month]);

  const selectPreset = (preset) => {
    onRangeModeChange('preset');
    onTimeframeChange(preset);
  };

  const selectCustom = () => {
    onRangeModeChange('custom');
    onCustomStartChange((prev) => prev || bounds.defaultStart);
    onCustomEndChange((prev) => prev || bounds.defaultEnd);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 border-b border-[var(--color-bg-border)]">
        {PRESETS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => selectPreset(opt)}
            className={segmentClass(rangeMode === 'preset' && timeframe === opt)}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={selectCustom}
          className={segmentClass(rangeMode === 'custom')}
        >
          Range
        </button>
      </div>

      {rangeMode === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customStart}
            min={bounds.minStart}
            max={customEnd || bounds.maxEnd}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className={dateInputClass}
          />
          <span className="text-[10px] text-[var(--color-text-muted)]">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || bounds.minStart}
            max={bounds.maxEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className={dateInputClass}
          />
        </div>
      )}
    </div>
  );
}
