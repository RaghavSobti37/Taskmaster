import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessOrgAccounts } from '../utils/pagePermissions';

const ArtistOrAdminRoute = () => {
  const { user } = useAuth();
  const allowed = canAccessOrgAccounts(user);
  return allowed ? <Outlet /> : <Navigate to="/assets" replace />;
};

export default ArtistOrAdminRoute;
