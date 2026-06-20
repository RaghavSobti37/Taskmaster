/** Pure round-robin helpers (no DB) — safe to test without mongoose. */

function pickNextRepFromList(reps, lastAssignedId) {
  if (!reps?.length) return null;
  if (reps.length === 1) return reps[0]._id;

  const ids = reps.map((r) => String(r._id));
  if (!lastAssignedId) return reps[0]._id;

  const lastIdx = ids.indexOf(String(lastAssignedId));
  const nextIdx = lastIdx >= 0 ? (lastIdx + 1) % reps.length : 0;
  return reps[nextIdx]._id;
}

function createBookedCallRepAssigner(repIds) {
  let index = 0;
  const pool = (repIds || []).map(String);
  return () => {
    if (!pool.length) return null;
    const id = pool[index % pool.length];
    index += 1;
    return id;
  };
}

module.exports = {
  pickNextRepFromList,
  createBookedCallRepAssigner,
};
