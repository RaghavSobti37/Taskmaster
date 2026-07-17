import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../../config/clerk', () => ({
  isClerkConfigured: () => true,
}));

function LocationProbe() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}

describe('password reset redirects', () => {
  it('routes forgot password to Clerk reset-password path routing', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login/reset-password" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('/login/reset-password')).toBeTruthy();
  });

  it('preserves legacy reset token while routing to Clerk reset-password path', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login/reset-password" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('/login/reset-password?token=abc123')).toBeTruthy();
  });
});
