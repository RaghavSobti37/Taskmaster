import React from 'react';
import { getRollingRangeBounds } from '../../utils/projectReportRange';

const PRESETS = ['1d', '7d', '30d'];

const dateInputClass =
  'px-2 py-1 text-xs font-medium rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500';

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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-[var(--color-bg-secondary)] rounded-full p-1 border border-[var(--color-bg-border)] shadow-sm">
        {PRESETS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => selectPreset(opt)}
            className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${
              rangeMode === 'preset' && timeframe === opt
                ? 'bg-[var(--color-bg-primary)] text-blue-500 shadow-sm ring-1 ring-[var(--color-bg-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={selectCustom}
          className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${
            rangeMode === 'custom'
              ? 'bg-[var(--color-bg-primary)] text-blue-500 shadow-sm ring-1 ring-[var(--color-bg-border)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
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
