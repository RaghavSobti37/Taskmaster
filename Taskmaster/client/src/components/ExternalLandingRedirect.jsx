import { useLocation } from 'react-router-dom';
import ExternalRedirect from './ExternalRedirect';
import { shouldRedirectMarketingRoute } from '../config/siteUrls';

/** App host `/` or `/landing` → landing.tsccoreknot.com when split deploy. */
export default function ExternalLandingRedirect() {
  const { pathname } = useLocation();
  const target = shouldRedirectMarketingRoute(pathname);
  if (!target) return null;
  return <ExternalRedirect to={target} />;
}
