import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BootScreen from '../../components/BootScreen';
import { navigateAfterAuth } from '../../utils/authNavigation';

/** Google account link success only — Clerk handles sign-in. */
const GoogleSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('link') === 'success') {
      navigateAfterAuth(navigate, '/settings?tab=profile');
      return;
    }
    navigate('/login', { replace: true });
  }, [location.search, navigate]);

  return <BootScreen />;
};

export default GoogleSuccessPage;
