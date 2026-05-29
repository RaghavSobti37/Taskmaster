/** Resolve display city from MailEvent (track.js uses `location`; legacy routes use `metadata`). */
const resolveMailEventCity = (evt) => {
  const loc = evt?.location;
  if (loc && typeof loc === 'object') {
    const city = (loc.city || '').trim();
    if (city && city !== 'Unknown' && city !== 'Unknown City') return city;
    const region = (loc.region || '').trim();
    if (region && region !== 'Unknown' && region !== 'Unknown Region') return region;
    const country = (loc.country || '').trim();
    if (country && country !== 'Unknown' && country !== 'Unknown Country') return country;
  }

  const meta = evt?.metadata;
  if (meta) {
    if (meta.city && meta.city !== 'Unknown City') return String(meta.city).trim();
    if (meta.location) {
      if (typeof meta.location === 'string') {
        const first = meta.location.split(',')[0].trim();
        if (first && first !== 'Unknown City' && first !== 'Unknown Location') return first;
      } else if (meta.location.city) {
        return String(meta.location.city).trim();
      }
    }
  }

  return 'Unknown';
};

module.exports = { resolveMailEventCity };
