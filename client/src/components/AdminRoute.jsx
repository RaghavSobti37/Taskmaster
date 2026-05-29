import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../utils/departmentPermissions';

const AdminRoute = () => {
  const { user } = useAuth();
  return isAdminUser(user) ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default AdminRoute;
