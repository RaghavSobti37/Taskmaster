import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, CheckCircle2, ListChecks } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProfileCompletionIssues } from '../utils/profileCompleteness';
import { hasCompletedOnboarding } from '../utils/onboardingStorage';

const alertClassName =
  'mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 text-sm rounded-xl font-medium';

export default function ProfileCompletionAlerts() {
  const { user } = useAuth();

  const checklist = useMemo(() => {
    if (!user) return [];

    const items = [];

    if (user.mustChangePassword) {
      items.push({
        id: 'password',
        label: 'Change your default password',
        done: false,
        href: '/settings?tab=profile',
        linkLabel: 'Change password',
      });
    }

    const profileIssues = getProfileCompletionIssues(user).filter((i) => i.id !== 'password');
    for (const issue of profileIssues) {
      items.push({
        id: issue.id,
        label: issue.message.replace(/\.$/, ''),
        done: false,
        href: '/settings?tab=profile',
        linkLabel: 'Update profile',
      });
    }

    const tourDone = hasCompletedOnboarding(user._id);
    items.push({
      id: 'tour',
      label: 'Complete the product tour',
      done: tourDone,
      action: tourDone ? null : 'replay-tour',
    });

    return items;
  }, [user]);

  const openTour = useCallback(() => {
    window.dispatchEvent(new CustomEvent('coreknot:replay-onboarding'));
  }, []);

  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener('coreknot:onboarding-complete', refresh);
    return () => window.removeEventListener('coreknot:onboarding-complete', refresh);
  }, []);

  const pending = checklist.filter((item) => !item.done);

  if (!user || pending.length === 0) return null;

  return (
    <div className="mb-4">
      <div role="status" className={alertClassName}>
        <div className="flex gap-3">
          <ListChecks size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-50">Onboarding checklist</p>
              <p className="text-xs mt-0.5 text-amber-800/80 dark:text-amber-200/80">
                {checklist.filter((i) => i.done).length} of {checklist.length} complete
              </p>
            </div>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  {item.done ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className={item.done ? 'line-through opacity-70' : ''}>
                    {item.label}
                    {!item.done && item.href && (
                      <>
                        {' '}
                        <Link
                          to={item.href}
                          className="font-bold text-amber-800 dark:text-amber-200 underline underline-offset-2 hover:opacity-80"
                        >
                          {item.linkLabel || 'Update'}
                        </Link>
                      </>
                    )}
                    {!item.done && item.action === 'replay-tour' && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={openTour}
                          className="font-bold text-amber-800 dark:text-amber-200 underline underline-offset-2 hover:opacity-80"
                        >
                          Start tour
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
