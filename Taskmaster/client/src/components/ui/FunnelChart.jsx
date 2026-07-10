import React, { useMemo } from 'react';

export const FUNNEL_CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

function normalizeStages(data) {
  return (Array.isArray(data) ? data : [])
    .filter((row) => row && row.label != null)
    .map((row, index) => ({
      label: String(row.label),
      value: Math.max(0, Number(row.value) || 0),
      color: row.color || FUNNEL_CHART_COLORS[index % FUNNEL_CHART_COLORS.length],
    }));
}

function stageWidthPct(value, topValue) {
  if (!topValue) return 14;
  return Math.max(14, Math.round((value / topValue) * 100));
}

function stepRetentionPct(value, prevValue) {
  if (!prevValue) return null;
  return Math.round((value / prevValue) * 100);
}

function dropPct(value, prevValue) {
  if (!prevValue) return null;
  return Math.round(((prevValue - value) / prevValue) * 100);
}

/**
 * Layered funnel — each stage narrows from the first stage's volume.
 * @param {{ label: string, value: number, color?: string }[]} data
 * @param {number} [layers=3] depth layers behind each segment
 */
export default function FunnelChart({
  data = [],
  layers = 3,
  className = '',
  minHeight = 220,
  showRates = true,
}) {
  const stages = useMemo(() => normalizeStages(data), [data]);
  const topValue = stages[0]?.value ?? 0;
  const hasData = stages.some((s) => s.value > 0);
  const layerCount = Math.max(1, Math.min(4, Number(layers) || 1));

  if (!stages.length || !hasData) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-[var(--color-text-muted)] italic text-center px-3 ${className}`}
        style={{ minHeight }}
      >
        No funnel data for this period
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`} style={{ minHeight }}>
      {stages.map((stage, idx) => {
        const prevValue = idx === 0 ? stage.value : stages[idx - 1].value;
        const widthPct = stageWidthPct(stage.value, topValue);
        const retained = idx > 0 ? stepRetentionPct(stage.value, prevValue) : null;
        const dropped = idx > 0 ? dropPct(stage.value, prevValue) : null;
        const shareOfTop = topValue > 0 ? Math.round((stage.value / topValue) * 100) : 0;

        return (
          <div key={`${stage.label}-${idx}`}>
            {showRates && idx > 0 && prevValue > 0 && dropped != null && (
              <p className="text-[9px] text-[var(--color-text-muted)] mb-1 pl-1">
                {dropped}% drop · {retained}% retained
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 flex justify-center">
                <div
                  className="relative"
                  style={{
                    width: `${widthPct}%`,
                    minWidth: '3.5rem',
                    paddingTop: layerCount > 1 ? (layerCount - 1) * 3 : 0,
                  }}
                >
                  {layerCount > 1 &&
                    Array.from({ length: layerCount - 1 }, (_, layerIdx) => (
                      <div
                        key={layerIdx}
                        className="absolute left-1/2 -translate-x-1/2 rounded-md h-8"
                        style={{
                          top: layerIdx * 3,
                          width: `calc(100% - ${layerIdx * 4}px)`,
                          backgroundColor: 'color-mix(in srgb, var(--color-bg-border) 70%, transparent)',
                          opacity: 0.65 - layerIdx * 0.15,
                        }}
                      />
                    ))}
                  <div
                    className="relative h-8 rounded-md flex items-center justify-between px-2.5 text-white"
                    style={{ backgroundColor: stage.color }}
                  >
                    <span className="text-[10px] font-bold truncate">{stage.label}</span>
                    <span className="text-xs font-black font-mono tabular-nums shrink-0 ml-2">
                      {stage.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
              {topValue > 0 && (
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums w-10 text-right shrink-0">
                  {shareOfTop}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
