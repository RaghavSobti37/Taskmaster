import React from 'react';
import { Lock } from 'lucide-react';
import { EmptyState } from '../ui';

export default function FeatureLockedState({ title, message }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <EmptyState
        icon={Lock}
        title={title || 'Feature not enabled'}
        description={message || 'This feature is not enabled for your organization. Ask an admin to turn it on in organization settings.'}
        variant="dashed"
      />
    </div>
  );
}
