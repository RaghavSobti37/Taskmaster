import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isOpsUser } from '../utils/departmentPermissions';

const OpsRoute = () => {
  const { user } = useAuth();
  const hasAccess = isOpsUser(user);
  return hasAccess ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default OpsRoute;
