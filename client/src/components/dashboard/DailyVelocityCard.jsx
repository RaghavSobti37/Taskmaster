import React from 'react';
import { Card, Badge, VelocitySparkline } from '../ui';

const DailyVelocityCard = ({ velocity = 'Stable', sparklineData = [] }) => {
  return (
    <Card className="p-5 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] overflow-hidden relative shadow-md">
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Daily Progress Speed
          </h4>
          <Badge variant={velocity === 'Optimal' ? 'success' : 'warning'}>
            {velocity}
          </Badge>
        </div>
        <VelocitySparkline data={sparklineData.map(d => d.count)} />
      </div>
    </Card>
  );
};

export default DailyVelocityCard;
