import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProfileCompletionIssues } from '../utils/profileCompleteness';

const alertClassName =
  'mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 text-sm rounded-xl font-medium flex gap-3';

export default function ProfileCompletionAlerts() {
  const { user } = useAuth();

  const issues = useMemo(() => {
    const all = getProfileCompletionIssues(user);
    return all.filter((issue) => issue.id !== 'password');
  }, [user]);

  const passwordIssue = useMemo(() => {
    if (!user?.mustChangePassword) return null;
    return getProfileCompletionIssues(user).find((i) => i.id === 'password');
  }, [user]);

  if (!user) return null;
  if (!passwordIssue && issues.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {passwordIssue && (
        <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-100 text-sm rounded-xl font-medium flex gap-3">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <p className="leading-relaxed">
            {passwordIssue.message}{' '}
            <Link
              to="/settings?tab=profile"
              className="font-bold text-rose-800 dark:text-rose-200 underline underline-offset-2 hover:opacity-80"
            >
              Change password
            </Link>
          </p>
        </div>
      )}
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
