import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import BootScreen from '../../components/BootScreen';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';
import { apiPath } from '../../utils/apiBase';
import { isClerkConfigured } from '../../config/clerk';

const GoogleSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, refreshUser } = useAuth();

  const processedKeyRef = React.useRef('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authKey = location.search || location.key || 'empty';
    if (processedKeyRef.current === authKey) return;
    const ticket = params.get('ticket');
    const userStr = params.get('user');
    const linkSuccess = params.get('link') === 'success';

    if (linkSuccess) {
      processedKeyRef.current = authKey;
      navigateAfterAuth(navigate, '/settings?tab=profile');
      return;
    }

    const finishLogin = async () => {
      await login();
      navigateAfterAuth(navigate, '/dashboard');
    };

    if (ticket) {
      if (isClerkConfigured()) {
        processedKeyRef.current = authKey;
        navigate('/login', { replace: true });
        return;
      }
      processedKeyRef.current = authKey;
      (async () => {
        try {
          const res = await axios.post(apiPath('/api/auth/oauth-establish'), { ticket }, AXIOS_SKIP_TOAST);
          await finishLogin();
        } catch (error) {
          console.error('OAuth session establish failed:', error);
          navigate('/login?error=auth_failed', { replace: true });
        }
      })();
      return;
    }

    if (userStr) {
      if (isClerkConfigured()) {
        processedKeyRef.current = authKey;
        navigate('/login', { replace: true });
        return;
      }
      processedKeyRef.current = authKey;
      (async () => {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          await finishLogin();
        } catch (error) {
          console.error('Error parsing user data:', error);
          navigate('/login?error=auth_failed', { replace: true });
        }
      })();
      return;
    }

    if (location.search) {
      processedKeyRef.current = authKey;
      (async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
          const sessionUser = await refreshUser({ clearOn401: false });
          if (sessionUser) {
            navigateAfterAuth(navigate, '/dashboard');
            return;
          }
        }
        navigate('/login?error=auth_failed', { replace: true });
      })();
    }
  }, [location.search, location.key, login, navigate, refreshUser]);

  React.useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) processedKeyRef.current = '';
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return <BootScreen />;
};

export default GoogleSuccessPage;
