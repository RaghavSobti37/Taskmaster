const mergeTagMetrics = (coreRows, mailRows) => {
  const tagMap = {};

  const addRow = (row) => {
    const tag = row._id || 'General';
    if (!tagMap[tag]) {
      tagMap[tag] = { eventTag: tag, totalSent: 0, totalOpens: 0, totalClicks: 0 };
    }
    tagMap[tag].totalSent += row.totalSent || 0;
    tagMap[tag].totalOpens += row.totalOpens || 0;
    tagMap[tag].totalClicks += row.totalClicks || 0;
  };

  coreRows.forEach(addRow);
  mailRows.forEach(addRow);

  return Object.values(tagMap)
    .map((item) => {
      const openRate = item.totalSent > 0
        ? Math.round((item.totalOpens / item.totalSent) * 100)
        : (item.totalOpens > 0 ? 100 : 0);
      const ctr = item.totalSent > 0
        ? Math.round((item.totalClicks / item.totalSent) * 100)
        : (item.totalClicks > 0 ? 100 : 0);
      return { ...item, openRate, ctr };
    })
    .sort((a, b) => b.totalSent - a.totalSent);
};

const syncMailRollupsForAllUsers = async () => {
  return { skipped: true, reason: 'Migrated to auto-mailer' };
};

const readLatestMailRollups = async () => {
  return null;
};

module.exports = {
  mergeTagMetrics,
  syncMailRollupsForAllUsers,
  readLatestMailRollups,
};
