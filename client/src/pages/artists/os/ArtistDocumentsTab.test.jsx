import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ArtistDocumentsTab from './ArtistDocumentsTab.jsx';

vi.mock('../../../hooks/queries/artistOs', () => ({
  useArtistOsDocuments: () => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function renderTab(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ArtistDocumentsTab artistId="artist-1" artistName="Jane Doe" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ArtistDocumentsTab UI', () => {
  it('renders artist name in description', () => {
    renderTab();

    expect(screen.getByText(/Central document vault for Jane Doe/)).toBeInTheDocument();
  });

  it('renders contracts action when artistId is set', () => {
    renderTab();

    expect(screen.getByRole('button', { name: 'View contracts' })).toBeInTheDocument();
  });
});
