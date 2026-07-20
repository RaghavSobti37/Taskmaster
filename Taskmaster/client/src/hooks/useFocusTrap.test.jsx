import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function TrapFixture({ active = true, children }) {
  const ref = React.useRef(null);
  useFocusTrap(active, ref);
  return (
    <div ref={ref} tabIndex={-1} data-testid="trap">
      {children}
    </div>
  );
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses the explicit initial target when opened', () => {
    render(
      <TrapFixture>
        <button type="button">Cancel</button>
        <button type="button" data-autofocus>
          Save
        </button>
      </TrapFixture>,
    );

    vi.runOnlyPendingTimers();

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });
});
