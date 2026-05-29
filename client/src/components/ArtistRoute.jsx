import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isArtistManagerUser } from '../utils/departmentPermissions';

const ArtistRoute = () => {
  const { user } = useAuth();
  const hasAccess = isArtistManagerUser(user);
  return hasAccess ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default ArtistRoute;
