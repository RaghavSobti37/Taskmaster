import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEscapeBack } from './useEscapeBack';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../contexts/SidebarContext', () => ({
  useSidebar: () => ({ isMobileOpen: false }),
}));

function wrapper({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useEscapeBack', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('navigates back on Escape when no overlay blocks', () => {
    renderHook(() => useEscapeBack(), { wrapper });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('does not navigate when blocked callback returns true', () => {
    renderHook(() => useEscapeBack({ blocked: () => true }), { wrapper });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when data-escape-overlay is open', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-escape-overlay', 'true');
    document.body.appendChild(overlay);

    renderHook(() => useEscapeBack(), { wrapper });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(navigate).not.toHaveBeenCalled();
  });
});
