import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModalShell, ModalFooter } from './ModalShell';
import { NexusModal } from './NexusModal';
import { Button } from './primitives';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => {},
}));

vi.mock('../../hooks/transitions', () => ({
  useTransitionSurface: (isOpen) => ({
    mounted: isOpen,
    surfaceClass: '',
  }),
}));

function renderModal(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ModalShell keyboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onClose on Escape and stops propagation', () => {
    const onClose = vi.fn();
    const backListener = vi.fn();
    window.addEventListener('keydown', backListener);

    renderModal(
      <ModalShell isOpen onClose={onClose} ariaLabel="Test modal">
        <p>Content</p>
      </ModalShell>,
    );

    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', backListener);
  });

  it('submits form on Enter when focus is on modal body', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());

    renderModal(
      <ModalShell isOpen onClose={() => {}} ariaLabel="Save modal">
        <form onSubmit={onSubmit}>
          <ModalFooter>
            <Button type="submit">Save</Button>
          </ModalFooter>
        </form>
      </ModalShell>,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter', bubbles: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('NexusModal keyboard', () => {
  it('submits confirm on Enter via form', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    renderModal(
      <NexusModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        isConfirm
        title="Delete item"
        message="Sure?"
        type="danger"
        confirmLabel="Delete"
      />,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter', bubbles: true });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
