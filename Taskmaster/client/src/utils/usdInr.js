import { formatDisplayDateTime } from './dateDisplay';

export const roundMoney = (value, decimals = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
};

export const usdToInr = (usd, rate) => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return roundMoney(Number(usd) * r);
};

export const inrToUsd = (inr, rate) => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return roundMoney(Number(inr) / r);
};

export const formatRateTime = (iso) => {
  try {
    return formatDisplayDateTime(iso);
  } catch {
    return iso;
  }
};
