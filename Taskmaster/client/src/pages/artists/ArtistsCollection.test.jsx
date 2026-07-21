import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ArtistsCollection from './ArtistsCollection.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useOrgPath', () => ({
  useOrgPath: () => (path) => `/tsc${path}`,
}));

vi.mock('../../hooks/useTaskmasterQueries', () => ({
  useArtists: () => ({
    data: [{ _id: 'artist-1', name: 'Yugm', bio: 'Guitar duo', isSynced: true, analytics: {} }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateArtist: () => ({ mutateAsync: vi.fn() }),
  useSyncArtistStats: () => ({ mutateAsync: vi.fn() }),
}));

describe('ArtistsCollection org routing', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('keeps artist row navigation under active org slug', () => {
    render(<ArtistsCollection />);

    fireEvent.click(screen.getByRole('row', { name: /yugm/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/tsc/artists/artist-1');
  });

  it('keeps portfolio navigation under active org slug', () => {
    render(<ArtistsCollection />);

    fireEvent.click(screen.getByRole('button', { name: /portfolio/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/tsc/artists/portfolio');
  });
});
