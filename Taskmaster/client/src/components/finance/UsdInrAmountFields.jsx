import React, { useId, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '../ui';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { usdToInr, inrToUsd, formatRateTime } from '../../utils/usdInr';

const compactInputClass =
  'w-full pl-7 pr-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 tabular-nums';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const parseInrInput = (raw) => String(raw || '').replace(/,/g, '').trim();

const formatInrDisplay = (raw) => {
  const cleaned = parseInrInput(raw);
  if (cleaned === '' || cleaned === '.') return cleaned;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return raw;
  return inrFormatter.format(num);
};

const isRateWarning = (rateData) =>
  rateData?.source === 'override' || rateData?.stale === true;

/**
 * INR-primary amount field with live USD conversion subline.
 */
export default function UsdInrAmountFields({
  inrValue = '',
  usdValue = '',
  onInrChange,
  onUsdChange,
  enabled = true,
  inrLabel = 'Amount (INR)',
  usdLabel = 'Amount (USD)',
  inrRequired = false,
  compact = false,
  className = '',
  layout = 'grid',
  showRateInfo = true,
  fetchRateOnDemand = false,
  inrInputProps = {},
  usdInputProps = {},
  rateHintClassName = 'mt-1 text-[10px] text-[var(--color-text-muted)]',
}) {
  const sublineId = useId();
  const [rateRequested, setRateRequested] = useState(false);
  const rateEnabled = fetchRateOnDemand ? rateRequested : enabled;
  const { data: rateData, isLoading: rateLoading, isError: rateError } = useUsdInrRate({ enabled: rateEnabled });
  const rate = rateData?.rate;
  const hasRate = Number.isFinite(rate) && rate > 0;
  const rateWarning = isRateWarning(rateData);

  const displayInr = useMemo(() => formatInrDisplay(inrValue), [inrValue]);

  const usdEquivalent = useMemo(() => {
    const cleaned = parseInrInput(inrValue);
    if (!cleaned || !hasRate) return null;
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) return null;
    return inrToUsd(num, rate);
  }, [inrValue, hasRate, rate]);

  const handleInrChange = (raw) => {
    const cleaned = parseInrInput(raw);
    onInrChange(cleaned);
    if (cleaned === '' || cleaned === '.') {
      onUsdChange('');
      return;
    }
    if (hasRate) {
      onUsdChange(String(inrToUsd(cleaned, rate)));
    }
  };

  const conversionSubline = showRateInfo && fetchRateOnDemand && !rateRequested && (
    <button
      type="button"
      onClick={() => setRateRequested(true)}
      className={`${rateHintClassName} text-left text-[var(--color-action-primary)] hover:underline`}
    >
      Show USD conversion
    </button>
  );

  const conversionDetails = showRateInfo && (!fetchRateOnDemand || rateRequested) && (
    <>
      {rateLoading && (
        <p className={`${rateHintClassName} flex items-center gap-1`} id={sublineId}>
          <Loader2 size={10} className="animate-spin" />
          Fetching exchange rate...
        </p>
      )}
      {!rateLoading && rateError && (
        <p className={`${rateHintClassName} text-red-500`} id={sublineId}>
          Could not load exchange rate. Enter INR amount directly.
        </p>
      )}
      {!rateLoading && !rateError && hasRate && (
        <p
          id={sublineId}
          className={`${rateHintClassName} ${rateWarning ? 'text-amber-600 dark:text-amber-400' : ''}`}
          title={rateWarning ? 'Rate is from override or cached fallback — USD estimate may be offline.' : undefined}
        >
          {usdEquivalent != null ? (
            <>
              ≈ {usdFormatter.format(usdEquivalent)} USD
              {' '}(Rate: ₹{inrFormatter.format(rate)})
            </>
          ) : (
            <>1 USD = ₹{inrFormatter.format(rate)}</>
          )}
          {rateData?.asOf && (
            <>
              {' '}
              · {formatRateTime(rateData.asOf)}
              {rateData.stale ? ' (cached)' : ''}
              {rateData.source === 'override' ? ' (override)' : ''}
            </>
          )}
        </p>
      )}
    </>
  );

  const inrField = (
    <div>
      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
        {inrLabel}
        {inrRequired && ' *'}
      </label>
      <div className="relative">
        <span
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)] leading-none pointer-events-none"
          aria-hidden
        >
          ₹
        </span>
        {compact ? (
          <input
            type="text"
            inputMode="decimal"
            value={displayInr}
            onChange={(e) => handleInrChange(e.target.value)}
            required={inrRequired}
            aria-describedby={sublineId}
            className={compactInputClass}
            {...inrInputProps}
          />
        ) : (
          <input
            type="text"
            inputMode="decimal"
            value={displayInr}
            onChange={(e) => handleInrChange(e.target.value)}
            required={inrRequired}
            aria-describedby={sublineId}
            className="w-full pl-7 pr-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50 tabular-nums"
            {...inrInputProps}
          />
        )}
      </div>
      {conversionSubline}
      {conversionDetails}
    </div>
  );

  if (compact || layout === 'stack') {
    return (
      <div className={`${layout === 'stack' ? 'flex flex-col gap-3' : ''} ${className}`}>
        {inrField}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      {inrField}
      <Input
        label={usdLabel}
        type="number"
        min="0"
        step="0.01"
        value={usdValue}
        onChange={(e) => {
          const raw = e.target.value;
          onUsdChange(raw);
          if (raw === '' || raw === '.') {
            onInrChange('');
            return;
          }
          if (hasRate) {
            onInrChange(String(usdToInr(raw, rate)));
          }
        }}
        placeholder="Optional"
        disabled={rateLoading}
        {...usdInputProps}
      />
    </div>
  );
}
