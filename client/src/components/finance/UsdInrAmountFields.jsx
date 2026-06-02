import React from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '../ui';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { usdToInr, inrToUsd, formatRateTime } from '../../utils/usdInr';

const compactInputClass =
  'w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50';

/**
 * USD + INR amount inputs with live conversion. INR is always editable — never locked after convert.
 *
 * @param {string} inrValue - controlled INR string
 * @param {string} usdValue - controlled USD string (UI helper; not persisted unless caller saves it)
 * @param {(value: string) => void} onInrChange
 * @param {(value: string) => void} onUsdChange
 * @param {boolean} [enabled=true] - fetch live rate when true
 * @param {boolean} [compact=false] - finance-style compact inputs
 * @param {'grid'|'stack'} [layout='grid']
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
  inrInputProps = {},
  usdInputProps = {},
  rateHintClassName = 'mt-1 text-[10px] text-[var(--color-text-muted)]',
}) {
  const { data: rateData, isLoading: rateLoading, isError: rateError } = useUsdInrRate({ enabled });
  const rate = rateData?.rate;
  const hasRate = Number.isFinite(rate) && rate > 0;

  const handleUsdChange = (raw) => {
    onUsdChange(raw);
    if (raw === '' || raw === '.') {
      onInrChange('');
      return;
    }
    if (hasRate) {
      onInrChange(String(usdToInr(raw, rate)));
    }
  };

  const handleInrChange = (raw) => {
    onInrChange(raw);
    if (raw === '' || raw === '.') {
      onUsdChange('');
      return;
    }
    if (hasRate) {
      onUsdChange(String(inrToUsd(raw, rate)));
    }
  };

  const rateHint = showRateInfo && (
    <>
      {rateLoading && (
        <p className={`${rateHintClassName} flex items-center gap-1`}>
          <Loader2 size={10} className="animate-spin" />
          Fetching exchange rate...
        </p>
      )}
      {!rateLoading && rateError && (
        <p className={`${rateHintClassName} text-red-500`}>
          Could not load exchange rate. Enter INR amount directly.
        </p>
      )}
      {!rateLoading && !rateError && hasRate && (
        <p className={rateHintClassName}>
          1 USD = ₹{rate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          {rateData?.asOf && (
            <>
              {' '}
              · Rate as of {formatRateTime(rateData.asOf)}
              {rateData.stale ? ' (cached)' : ''}
            </>
          )}
        </p>
      )}
    </>
  );

  const layoutClass =
    layout === 'stack' ? 'flex flex-col gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3';

  if (compact) {
    return (
      <div className={`${layoutClass} ${className}`}>
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
            {usdLabel}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={usdValue}
            onChange={(e) => handleUsdChange(e.target.value)}
            placeholder="Optional"
            disabled={rateLoading}
            className={compactInputClass}
            {...usdInputProps}
          />
          {rateHint}
        </div>
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
            {inrLabel}
            {inrRequired && ' *'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={inrValue}
            onChange={(e) => handleInrChange(e.target.value)}
            required={inrRequired}
            className={compactInputClass}
            {...inrInputProps}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${layoutClass} ${className}`}>
      <div>
        <Input
          label={usdLabel}
          type="number"
          min="0"
          step="0.01"
          value={usdValue}
          onChange={(e) => handleUsdChange(e.target.value)}
          placeholder="Optional"
          disabled={rateLoading}
          {...usdInputProps}
        />
        {rateHint}
      </div>
      <Input
        label={inrLabel}
        type="number"
        min="0"
        step="0.01"
        value={inrValue}
        onChange={(e) => handleInrChange(e.target.value)}
        required={inrRequired}
        {...inrInputProps}
      />
    </div>
  );
}
