import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './primitives.jsx';

describe('Button loading state', () => {
  it('renders animated loading content and disables the button', () => {
    render(
      <Button loading loadingLabel="Saving...">
        Save
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
