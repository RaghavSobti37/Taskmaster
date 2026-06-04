import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import AppBootFallback from '../../components/AppBootFallback';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';

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
      navigate('/settings?tab=profile', { replace: true });
      return;
    }

    const finishLogin = async (user) => {
      await login(user);
      navigate('/dashboard', { replace: true });
    };

    if (ticket) {
      processedKeyRef.current = authKey;
      (async () => {
        try {
          const res = await axios.post('/api/auth/oauth-establish', { ticket }, AXIOS_SKIP_TOAST);
          await finishLogin(res.data);
        } catch (error) {
          console.error('OAuth session establish failed:', error);
          navigate('/login?error=auth_failed', { replace: true });
        }
      })();
      return;
    }

    if (userStr) {
      processedKeyRef.current = authKey;
      (async () => {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          await finishLogin(user);
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
            navigate('/dashboard', { replace: true });
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

  return <AppBootFallback />;
};

export default GoogleSuccessPage;
