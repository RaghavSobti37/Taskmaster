import { useLocation } from 'react-router-dom';
import ExternalRedirect from './ExternalRedirect';
import { externalAuthRedirectTarget } from '../config/siteUrls';

/** App host → auth.tsccoreknot.com for marketing auth slugs. */
export default function ExternalAuthRedirect() {
  const { pathname, search } = useLocation();
  const target = externalAuthRedirectTarget(pathname, search);
  if (!target) return null;
  return <ExternalRedirect to={target} />;
}
