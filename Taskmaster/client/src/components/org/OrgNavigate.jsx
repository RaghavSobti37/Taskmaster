import React from 'react';
import { Navigate } from 'react-router-dom';
import { useOrgPath } from '../../hooks/useOrgPath';

export default function OrgNavigate({ to, ...rest }) {
  const resolve = useOrgPath();
  return <Navigate to={resolve(to)} {...rest} />;
}
