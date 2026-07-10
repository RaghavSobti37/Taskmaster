import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPageAccess, hasAnyPageAccess } from '../utils/pagePermissions';
import { useOrgPath } from '../hooks/useOrgPath';

const PageRoute = ({ page, pages, requireAll = false }) => {
  const { user } = useAuth();
  const resolve = useOrgPath();
  let allowed = true;

  if (page) {
    allowed = hasPageAccess(user, page);
  } else if (pages?.length) {
    allowed = requireAll
      ? pages.every((p) => hasPageAccess(user, p))
      : hasAnyPageAccess(user, pages);
  }

  return allowed ? <Outlet /> : <Navigate to={resolve('/dashboard')} replace />;
};

export default PageRoute;
