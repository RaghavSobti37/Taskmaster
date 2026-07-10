import React from 'react';
import { COUNTRY_PHONE_RULES, getCountryPhoneRule } from '../../utils/leadPhoneCountries';

/**
 * Country code selector + national number input with digit-count validation display.
 */
export default function PhoneNumberFields({
  countryCode = '+91',
  nationalNumber = '',
  onCountryCodeChange,
  onNationalNumberChange,
  error,
  label = 'Phone Number',
  required = false,
}) {
  const rule = getCountryPhoneRule(countryCode);
  const nationalDigits = String(nationalNumber || '').replace(/\D/g, '');
  const digitHint = nationalDigits
    ? `${nationalDigits.length}/${rule.digits} digits`
    : `${rule.digits} digits required`;

  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <label className="block tm-section-label">{label}{required ? ' *' : ''}</label>
      <div className="flex gap-2 w-full min-w-0">
        <select
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          className="shrink-0 w-[140px] min-h-[2.5rem] px-2 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
          aria-label="Country code"
        >
          {COUNTRY_PHONE_RULES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(e.target.value.replace(/[^\d\s-]/g, ''))}
          placeholder={`${rule.digits}-digit mobile`}
          aria-invalid={error ? 'true' : undefined}
          className={`flex-1 min-w-0 min-h-[2.5rem] px-3 py-2 bg-[var(--color-bg-primary)] border rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm ${
            error ? 'border-rose-500 focus:border-rose-500' : 'border-[var(--color-bg-border)]'
          }`}
        />
      </div>
      {error ? (
        <p className="text-[10px] font-bold text-rose-400">{error}</p>
      ) : (
        <p className="text-[10px] font-bold text-[var(--color-text-muted)]">{digitHint} · {rule.name}</p>
      )}
    </div>
  );
}
