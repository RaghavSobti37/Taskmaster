import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceSelect from './WorkspaceSelect';

vi.mock('../../hooks/useTaskmasterQueries', () => ({
  useWorkspaces: () => ({ data: [] }),
}));

vi.mock('../ui/NexusDropdown', () => ({
  default: ({ options }) => (
    <div>
      {options.map((option) => (
        <span key={option.value}>{option.label}</span>
      ))}
    </div>
  ),
}));

describe('WorkspaceSelect', () => {
  it('falls back to project-derived workspaces when workspace API has no rows', () => {
    render(
      <WorkspaceSelect
        value="Marketing"
        onChange={() => {}}
        fallbackWorkspaces={[{ name: 'Marketing' }, { name: 'Ops' }]}
      />,
    );

    expect(screen.getByText('Marketing')).toBeTruthy();
    expect(screen.getByText('Ops')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
  });
});
