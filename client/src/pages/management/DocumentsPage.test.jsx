import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentsPage from './DocumentsPage.jsx';

const mockConfirm = vi.fn().mockResolvedValue(false);

vi.mock('../../contexts/confirmContext', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}));

vi.mock('../../hooks/useTaskmasterQueries', () => ({
  useOrgDocuments: () => ({
    data: {
      data: [
        {
          _id: 'doc-1',
          title: 'Company Handbook',
          description: 'Internal policies',
          category: 'Policies',
          sourceType: 'link',
          externalUrl: 'https://example.com/handbook',
          tags: ['hr'],
          uploadedBy: { name: 'Ops Lead' },
          createdAt: '2026-01-15T10:00:00.000Z',
        },
      ],
      categories: ['Policies', 'Legal'],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateOrgDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateOrgDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrgDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    mockConfirm.mockClear();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('renders document list and add action', () => {
    renderPage();

    expect(screen.getAllByText('Company Handbook').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /add document/i })).toBeInTheDocument();
    expect(screen.getAllByText('Policies').length).toBeGreaterThan(0);
  });

  it('shows overview stats', () => {
    renderPage();

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
  });
});
