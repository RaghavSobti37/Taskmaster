import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackPageView } from '../lib/pageAnalytics';

/** Tracks route changes for global ops page analytics. */
const PageAnalyticsTracker = () => {
  const { pathname, search } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    trackPageView(pathname, search);
  }, [pathname, search, user]);

  return null;
};

export default PageAnalyticsTracker;
