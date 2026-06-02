import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProfileCompletionIssues } from '../utils/profileCompleteness';

const alertClassName =
  'mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 text-sm rounded-xl font-medium flex gap-3';

export default function ProfileCompletionAlerts() {
  const { user } = useAuth();

  const issues = useMemo(() => getProfileCompletionIssues(user), [user]);

  if (!user || issues.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {issues.map((issue) => (
        <div key={issue.id} role="status" className={alertClassName}>
          <Info size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            {issue.message}{' '}
            <Link
              to="/settings?tab=profile"
              className="font-bold text-amber-800 dark:text-amber-200 underline underline-offset-2 hover:opacity-80"
            >
              Update profile
            </Link>
          </p>
        </div>
      ))}
    </div>
  );
}
