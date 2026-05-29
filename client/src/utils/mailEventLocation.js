export const eventCityLabel = (evt) => {
  if (evt?.displayCity) return evt.displayCity;
  if (evt?.eventType !== 'Click') return null;

  const city = evt?.location?.city || evt?.metadata?.city;
  if (!city || typeof city !== 'string') return null;
  const t = city.trim();
  if (!t || /^unknown/i.test(t) || /^[A-Z]{2}$/.test(t)) return null;
  return t;
};
