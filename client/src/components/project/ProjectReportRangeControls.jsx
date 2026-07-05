import React from 'react';
import { getRollingRangeBounds } from '../../utils/projectReportRange';

const PRESETS = ['all', '1d', '7d', '30d'];

const PRESET_LABELS = {
  all: 'All time',
  '1d': '1d',
  '7d': '7d',
  '30d': '30d',
};

const dateInputClass =
  'px-2 py-1 text-xs font-medium rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500';

const segmentClass = (active) =>
  `px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
    active
      ? 'border-[var(--color-action-primary)] text-[var(--color-action-primary)]'
      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
  }`;

export default function ProjectReportRangeControls({
  rangeMode,
  onRangeModeChange,
  timeframe,
  onTimeframeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}) {
  const bounds = getRollingRangeBounds();

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
            {PRESET_LABELS[opt] || opt}
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
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            className={dateInputClass}
            min={bounds.min}
            max={bounds.max}
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            aria-label="Range start date"
          />
          <span className="text-[10px] font-bold text-[var(--color-text-muted)]">to</span>
          <input
            type="date"
            className={dateInputClass}
            min={customStart || bounds.min}
            max={bounds.max}
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            aria-label="Range end date"
          />
        </div>
      )}
    </div>
  );
}
