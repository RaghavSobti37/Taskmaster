import React from 'react';
import { Card, Badge, ProgressBar } from '../ui';
import {
  BarChart3, PieChart, TrendingUp, Target, Layers,
  ShoppingBag, Phone, Activity,
} from 'lucide-react';

function BarList({ items = [], labelKey = '_id', countKey = 'count', suffixFormatter }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((i) => i[countKey] || 0), 1);
  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const label = item[labelKey] || item.label || item.artist || 'Unknown';
        const count = item[countKey] || 0;
        const suffix = suffixFormatter ? suffixFormatter(item) : null;
        return (
          <div key={idx}>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-0.5 gap-2">
              <span className="truncate">{label || 'Unknown'}</span>
              <span className="shrink-0">
                {count}
                {suffix != null ? ` · ${suffix}` : ''}
              </span>
            </div>
            <ProgressBar value={(count / max) * 100} />
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  if (!children) return null;
  return (
    <Card className="p-3 space-y-2">
      <h4 className="text-[9px] font-black uppercase flex items-center gap-1 text-[var(--color-text-muted)]">
        {Icon && <Icon size={10} />} {title}
      </h4>
      {children}
    </Card>
  );
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function DataHubAnalyticsPanel({ analytics, folder, showPanel, onClose }) {
  if (!showPanel || !analytics) return null;

  const isGlobal = folder === 'all';
  const isLoyal = folder === 'loyal';

  return (
    <div className="w-80 shrink-0 border-l border-[var(--color-bg-border)] pl-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between sticky top-0 bg-[var(--color-bg-primary)] pb-2 z-10">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1">
          <BarChart3 size={12} /> {analytics.label || folder} Insights
        </h3>
        <button type="button" onClick={onClose} className="text-xs text-[var(--color-text-muted)] hover:text-white">Hide</button>
      </div>

      {isGlobal && (
        <>
          <Section title="People by Inlet" icon={PieChart}>
            <BarList items={analytics.inletBreakdown} labelKey="label" countKey="count" />
          </Section>
          <Section title="Email Health" icon={Target}>
            <div className="flex flex-wrap gap-1">
              {analytics.emailHealth?.map((r) => (
                <Badge key={r.status} variant={r.status === 'Active' ? 'mint' : r.status === 'Unsubscribed' ? 'warning' : 'neutral'}>
                  {r.status}: {r.count}
                </Badge>
              ))}
            </div>
          </Section>
          <Section title="Cross-Inlet Overlap" icon={Layers}>
            {analytics.overlap?.slice(0, 8).map((pair) => (
              <div key={`${pair.a}-${pair.b}`} className="flex justify-between text-[10px] font-bold py-0.5">
                <span className="truncate">{pair.labelA} + {pair.labelB}</span>
                <Badge variant="warning">{pair.count}</Badge>
              </div>
            ))}
          </Section>
          <Section title="Weekly Growth" icon={TrendingUp}>
            <BarList items={analytics.growth?.map((g) => ({ label: g._id, count: g.count }))} labelKey="label" countKey="count" />
          </Section>
        </>
      )}

      {isLoyal && (
        <>
          <Section title="Inlets per Person" icon={PieChart}>
            <BarList items={analytics.inletDistribution} labelKey="label" countKey="count" />
          </Section>
          <Section title="Most Common Inlets" icon={Layers}>
            <BarList items={analytics.topInletsAmongLoyal} labelKey="label" countKey="count" />
          </Section>
          <Section title="Top Overlap Pairs" icon={Target}>
            {analytics.overlap?.slice(0, 10).map((pair) => (
              <div key={`${pair.a}-${pair.b}`} className="flex justify-between text-[10px] font-bold py-0.5">
                <span className="truncate">{pair.labelA} + {pair.labelB}</span>
                <Badge variant="warning">{pair.count}</Badge>
              </div>
            ))}
          </Section>
        </>
      )}

      {folder === 'leads' && (
        <>
          <Section title="Lead Status Funnel" icon={Target}>
            <BarList items={analytics.funnel} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Call Status" icon={PieChart}>
            <BarList items={analytics.callStatus} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Lead Quality (1–5)" icon={BarChart3}>
            <BarList items={analytics.quality} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Lead Sources" icon={TrendingUp}>
            <BarList items={analytics.sources} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Meaningful Connect">
            <div className="flex flex-wrap gap-1">
              {analytics.meaningfulConnect?.map((r) => (
                <Badge key={r._id} variant={r._id === 'YES' ? 'mint' : r._id === 'NO' ? 'rose' : 'neutral'}>
                  {r._id || 'Unknown'}: {r.count}
                </Badge>
              ))}
            </div>
          </Section>
        </>
      )}

      {folder === 'exly' && (
        <>
          <Section title="Top Offerings (Revenue)" icon={ShoppingBag}>
            <BarList
              items={analytics.topOfferings}
              labelKey="_id"
              countKey="count"
              suffixFormatter={(item) => formatCurrency(item.revenue)}
            />
          </Section>
          <Section title="Booking Trend (Weekly)" icon={TrendingUp}>
            <BarList
              items={analytics.bookingTrend?.map((g) => ({ label: g._id, count: g.count, revenue: g.revenue }))}
              labelKey="label"
              countKey="count"
              suffixFormatter={(item) => formatCurrency(item.revenue)}
            />
          </Section>
        </>
      )}

      {folder === 'tsc' && (
        <>
          <Section title="Top Campaigns" icon={PieChart}>
            <BarList items={analytics.topCampaigns} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Origin Sources" icon={TrendingUp}>
            <BarList items={analytics.topSources} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Roles" icon={BarChart3}>
            <BarList items={analytics.roles} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Email Status in TSC">
            <div className="flex flex-wrap gap-1">
              {analytics.emailBreakdown?.map((r) => (
                <Badge key={r._id} variant={r._id === 'Active' ? 'mint' : r._id === 'Unsubscribed' ? 'warning' : 'neutral'}>
                  {r._id || 'Unknown'}: {r.count}
                </Badge>
              ))}
            </div>
          </Section>
        </>
      )}

      {folder === 'booked_calls' && (
        <>
          <Section title="Lead Status" icon={Target}>
            <BarList items={analytics.funnel} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Call Status" icon={Phone}>
            <BarList items={analytics.callStatus} labelKey="_id" countKey="count" />
          </Section>
        </>
      )}

      {folder === 'enquiries' && (
        <>
          <Section title="By Artist" icon={PieChart}>
            <BarList items={analytics.byArtist} labelKey="artist" countKey="count" />
          </Section>
          <Section title="Collaboration Type" icon={BarChart3}>
            <BarList items={analytics.byCollab} labelKey="label" countKey="count" />
          </Section>
        </>
      )}

      {folder === 'unsubscribed' && (
        <>
          <Section title="Unsub Reasons" icon={Target}>
            <BarList items={analytics.byReason?.map((r) => ({ label: r._id || 'Not specified', count: r.count }))} labelKey="label" countKey="count" />
          </Section>
          <Section title="Original Inlet" icon={Layers}>
            <BarList items={analytics.byInlet} labelKey="label" countKey="count" />
          </Section>
        </>
      )}

      {folder === 'mail' && analytics.rates && (
        <>
          <Section title="Event Breakdown" icon={PieChart}>
            <BarList items={analytics.mailStats} labelKey="_id" countKey="count" />
          </Section>
          <Section title="Engagement Volume">
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                { label: 'Sends', value: analytics.rates.sends },
                { label: 'Opens', value: analytics.rates.opens },
                { label: 'Clicks', value: analytics.rates.clicks },
                { label: 'Bounces', value: analytics.rates.bounces },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-lg font-black">{value}</p>
                  <p className="text-[8px] uppercase text-[var(--color-text-muted)]">{label}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {folder === 'community' && (
        <Section title="Community Offerings" icon={PieChart}>
          <BarList
            items={analytics.topOfferings}
            labelKey="_id"
            countKey="count"
            suffixFormatter={(item) => formatCurrency(item.revenue)}
          />
        </Section>
      )}

      {folder === 'active' && (
        <Section title="Engagement Signals" icon={Activity}>
          <BarList items={analytics.engagementFlags} labelKey="label" countKey="count" />
        </Section>
      )}
    </div>
  );
}
