import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui';

export const ADMIN_CONSOLE_PATH = '/admin/console';

export default function AdminConsoleBackButton({ to = ADMIN_CONSOLE_PATH, className = '' }) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => navigate(to)}
      className={`!p-2 shrink-0 ${className}`.trim()}
      aria-label="Back to Admin Console"
    >
      <ArrowLeft size={14} />
    </Button>
  );
}
