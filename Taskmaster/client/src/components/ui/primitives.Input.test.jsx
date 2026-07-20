import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './primitives.jsx';

describe('Input accessibility wiring', () => {
  it('associates label and helper text with the generated control id', () => {
    render(<Input label="Project name" hint="Use client-facing name." />);

    const input = screen.getByLabelText('Project name');
    const hint = screen.getByText('Use client-facing name.');

    expect(input).toHaveAttribute('id');
    expect(hint).toHaveAttribute('id');
    expect(input).toHaveAccessibleDescription('Use client-facing name.');
  });

  it('preserves caller id and describes validation errors', () => {
    render(<Input id="budget" label="Budget" error="Budget is required." />);

    const input = screen.getByLabelText('Budget');
    const error = screen.getByText('Budget is required.');

    expect(input).toHaveAttribute('id', 'budget');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(error).toHaveAttribute('id');
    expect(input).toHaveAccessibleDescription('Budget is required.');
  });
});
