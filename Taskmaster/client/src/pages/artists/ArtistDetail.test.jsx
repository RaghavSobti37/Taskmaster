import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ArtistDetail from './ArtistDetail.jsx';

const mockNavigate = vi.fn();
const mockConfirm = vi.fn();
const mockDelete = vi.fn();
let mockArtist = { _id: 'artist-1', name: 'Yugm', slug: 'yugm', team: [] };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'artist-1' }),
  };
});

vi.mock('../../hooks/useOrgPath', () => ({
  useOrgPath: () => (path) => `/tsc${path}`,
}));

vi.mock('../../contexts/confirmContext', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}));

vi.mock('../../hooks/useArtistDashboard', () => ({
  useArtistDashboard: () => ({
    artist: mockArtist,
    isArtistLoading: false,
    previewInvalid: false,
    shareToken: null,
    connections: [],
    normalized: {},
    connectedProviders: [],
    syncMutation: { mutateAsync: vi.fn() },
    updateMutation: { mutateAsync: vi.fn() },
    deleteMutation: { mutateAsync: mockDelete },
    addVideoMutation: { mutateAsync: vi.fn() },
    shareLinkMutation: { mutateAsync: vi.fn() },
    setPrimaryMutation: { mutateAsync: vi.fn() },
  }),
}));

vi.mock('./ArtistOSLayout', () => ({
  default: () => <div>Artist layout</div>,
}));

vi.mock('../../components/artists/ArtistShareModal', () => ({
  default: () => null,
}));

vi.mock('../../components/artists/ClaimWorkspaceBanner', () => ({
  default: () => null,
}));

vi.mock('../../components/artists/ArtistEditDrawer', () => ({
  default: ({ isOpen, onDelete }) => (
    isOpen ? <button type="button" onClick={onDelete}>Remove artist</button> : null
  ),
}));

describe('ArtistDetail org routing', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockConfirm.mockReset();
    mockDelete.mockReset();
    mockArtist = { _id: 'artist-1', name: 'Yugm', slug: 'yugm', team: [] };
  });

  it('keeps roster button navigation under active org slug', () => {
    render(<ArtistDetail />);

    fireEvent.click(screen.getByRole('button', { name: /roster/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/tsc/artists');
  });

  it('keeps delete redirect under active org slug', async () => {
    mockConfirm.mockResolvedValue(true);
    mockDelete.mockResolvedValue({});
    render(<ArtistDetail />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove artist/i }));

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tsc/artists');
    });
  });

  it('keeps not-found back navigation under active org slug', () => {
    mockArtist = null;
    render(<ArtistDetail />);

    fireEvent.click(screen.getByRole('button', { name: /back to roster/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/tsc/artists');
  });
});
