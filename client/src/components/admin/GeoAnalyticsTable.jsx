import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const GeoAnalyticsTable = () => {
  const { data: geoData, isLoading, isError } = useQuery({
    queryKey: ['geo-campaign'],
    queryFn: async () => {
      const res = await axios.get('/api/analytics/geo-campaign', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return res.data;
    }
  });

  if (isLoading) return <div className="p-4 text-slate-400">Loading location metrics...</div>;
  if (isError) return <div className="p-4 text-red-400">Error loading data.</div>;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">Global Audience Interaction</h3>
        <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md">Top 20 Regions</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/50 text-slate-400">
            <tr>
              <th className="py-2 px-4 font-medium">Location</th>
              <th className="py-2 px-4 font-medium text-right">Opens</th>
              <th className="py-2 px-4 font-medium text-right">Clicks</th>
              <th className="py-2 px-4 font-medium text-right">Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {geoData?.length > 0 ? (
              geoData.map((row, idx) => {
                const total = row.totalOpens + row.totalClicks;
                const cityStr = row._id.city || 'Unknown';
                const countryStr = row._id.country || 'Unknown';
                const locationName = `${cityStr}, ${countryStr}`;
                
                return (
                  <tr 
                    key={idx} 
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs border border-slate-700">
                          📍
                        </div>
                        <span className="text-slate-200 font-medium">{locationName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
                        {row.totalOpens}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#0F2916] text-[#81C995] border border-[#137333]/30">
                        {row.totalClicks}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${Math.min(100, (row.totalClicks / (total || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-xs w-8">
                          {total > 0 ? Math.round((row.totalClicks / total) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="py-8 text-center text-slate-500">
                  No geographic data tracked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GeoAnalyticsTable;
