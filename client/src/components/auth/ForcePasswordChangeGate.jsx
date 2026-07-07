import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import { Button } from '../ui';

const PROFILE_SETTINGS_PATH = '/settings';
const PROFILE_TAB = 'profile';

function isProfileSettingsPath(pathname, search) {
  if (pathname !== PROFILE_SETTINGS_PATH && !pathname.endsWith(PROFILE_SETTINGS_PATH)) return false;
  const tab = new URLSearchParams(search).get('tab');
  return !tab || tab === PROFILE_TAB;
}

export default function ForcePasswordChangeGate() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user?.mustChangePassword || user?.clerkId) return null;
  if (isProfileSettingsPath(location.pathname, location.search)) return null;

  return (
    <ModalShell isOpen onClose={() => {}} size="sm" closeOnBackdrop={false} closeOnEscape={false}>
      <ModalHeader
        title="Password change required"
        icon={ShieldAlert}
        showClose={false}
      />
      <ModalBody>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Your account must set a new password before you can use the app. Open profile settings to continue.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button onClick={() => navigate(`${PROFILE_SETTINGS_PATH}?tab=${PROFILE_TAB}`)}>
          Change password
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}
