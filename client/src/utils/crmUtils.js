export const SALES_REPS = {
  'sr01': 'Rohit Sobti',
  'sr02': 'Deepank Soni',
  'sr03': 'Rinki Roy',
  'sr04': 'Redacted User',
  'sr05': 'Sonesh Jain',
  'sr06': 'Satyam Mishra',
  'sr07': 'Shivam Sahijwani',
  'sr08': 'Harshika Kasliwal',
  'sr09': 'Aryaman'
};

export const getRepName = (rep) => {
  if (!rep) return 'UNASSIGNED';
  if (typeof rep === 'object' && rep.name) return rep.name;
  return SALES_REPS[rep] || rep;
};
