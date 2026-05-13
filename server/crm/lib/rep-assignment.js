const { getLeads } = require('./csv-store');

// In a real app, this would come from the database.
// For now, we use the CRM users if they exist, or just the Taskmaster users.
// Actually, the CRM architecture might have a specific set of reps.
// Let's assume we fetch users with 'sales' or 'admin' role from Taskmaster DB later.
// For now, we'll keep the logic of finding the least loaded rep.

function getLeastLoadedRep(reps) {
  if (!reps || reps.length === 0) return null;
  
  const leads = getLeads();
  const counts = {};
  
  reps.forEach(r => counts[r.id] = 0);
  
  leads.forEach(l => {
    if (l.assigned_to && counts[l.assigned_to] !== undefined) {
      counts[l.assigned_to]++;
    }
  });
  
  let minCount = Infinity;
  let leastLoaded = reps[0].id;
  
  reps.forEach(r => {
    if (counts[r.id] < minCount) {
      minCount = counts[r.id];
      leastLoaded = r.id;
    }
  });
  
  return leastLoaded;
}

module.exports = { getLeastLoadedRep };
