import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../contexts/AuthContext";
import { DashboardSkeleton } from "../../components/ui";

const GoogleSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, refreshUser } = useAuth();

  const processed = React.useRef(false);

  useEffect(() => {
    if (processed.current) return;

    const params = new URLSearchParams(location.search);
    const userStr = params.get('user');
    const linkSuccess = params.get('link') === 'success';

    if (linkSuccess) {
      processed.current = true;
      navigate('/settings?tab=profile', { replace: true });
      return;
    }

    if (userStr) {
      processed.current = true;
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        login(user);
        refreshUser();
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error parsing user data:', error);
        navigate('/login?error=auth_failed', { replace: true });
      }
    } else if (location.search) {
      processed.current = true;
      refreshUser().then((user) => {
        navigate(user ? '/' : '/login?error=auth_failed', { replace: true });
      });
    }
  }, [location.search, login, navigate, refreshUser]);

  return <DashboardSkeleton />;
};

export default GoogleSuccessPage;
