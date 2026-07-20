import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import FinanceDocumentPreview from './FinanceDocumentPreview';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('FinanceDocumentPreview', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/finance-preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.clearAllMocks();
  });

  it('sandboxes fetched PDF previews before embedding them', async () => {
    axios.get.mockResolvedValueOnce({
      data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    });

    render(
      <FinanceDocumentPreview
        doc={{ _id: 'doc_123', fileName: 'invoice.pdf', fileType: 'application/pdf' }}
        className="preview-frame"
      />,
    );

    const frame = await screen.findByTitle('invoice.pdf');

    await waitFor(() => {
      expect(frame.getAttribute('src')).toBe('blob:http://localhost/finance-preview');
    });
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(axios.get).toHaveBeenCalledWith('/api/finance/doc_123/file', {
      responseType: 'blob',
      withCredentials: true,
    });
  });
});
