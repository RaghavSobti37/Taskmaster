/** Case-insensitive asset search across common fields. */
export function assetMatchesSearch(asset, searchTerm, { includeProjectNames = false } = {}) {
  const q = String(searchTerm || '').trim().toLowerCase();
  if (!q) return true;
  if (!asset) return false;

  const parts = [
    asset.name,
    asset.link,
    asset.notes,
    asset.type,
  ];

  if (includeProjectNames && Array.isArray(asset.projectIds)) {
    asset.projectIds.forEach((p) => {
      if (typeof p === 'object' && p?.name) parts.push(p.name);
    });
  }

  return parts.some((v) => String(v || '').toLowerCase().includes(q));
}
