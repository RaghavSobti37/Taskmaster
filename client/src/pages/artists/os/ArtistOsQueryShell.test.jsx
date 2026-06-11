import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ArtistOsQueryShell from './ArtistOsQueryShell.jsx';

vi.mock('../../../components/ui', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading</div>,
}));

describe('ArtistOsQueryShell', () => {
  it('shows skeleton when loading and not preview', () => {
    render(
      <ArtistOsQueryShell isLoading isError={false} isPreview={false}>
        <div>child content</div>
      </ArtistOsQueryShell>,
    );

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('child content')).not.toBeInTheDocument();
  });

  it('shows error banner when isError and not preview', () => {
    const refetch = vi.fn();
    render(
      <ArtistOsQueryShell
        isLoading={false}
        isError
        error={{ message: 'Load failed' }}
        refetch={refetch}
        isPreview={false}
      >
        <div>child content</div>
      </ArtistOsQueryShell>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Load failed')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
