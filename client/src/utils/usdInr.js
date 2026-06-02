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
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};
