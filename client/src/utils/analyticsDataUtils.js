export const formatChartData = (history, platform) => {
  if (!history || !Array.isArray(history)) return [];
  
  return history.map(item => {
    const dateStr = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let value = 0;
    
    if (platform === 'spotify') {
      value = item.followers || 0;
    } else if (platform === 'youtube') {
      value = item.subscribers || item.views || 0;
    } else if (platform === 'meta') {
      value = item.followers || item.likes || 0;
    } else {
      value = item.value || item.followers || item.subscribers || 0;
    }
    
    return {
      name: dateStr,
      value: value
    };
  });
};
