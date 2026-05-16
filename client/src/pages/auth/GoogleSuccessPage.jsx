import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../contexts/AuthContext";
import { DashboardSkeleton } from "../../components/ui";

const GoogleSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const processed = React.useRef(false);

  useEffect(() => {
    if (processed.current) return;
    
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userStr = params.get('user');

    if (token && userStr) {
      processed.current = true;
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        login(token, user);
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error parsing user data:', error);
        navigate('/login?error=auth_failed', { replace: true });
      }
    } else if (location.search) {
      processed.current = true;
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [location.search, login, navigate]);

  return <DashboardSkeleton />;
};

export default GoogleSuccessPage;
