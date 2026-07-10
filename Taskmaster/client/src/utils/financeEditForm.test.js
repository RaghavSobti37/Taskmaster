import { describe, it, expect } from 'vitest';
import { buildFinanceEditForm, financeEditPayload } from './financeEditForm';

describe('financeEditForm', () => {
  const projects = [
    { _id: 'p1', name: 'Alpha', workspace: 'Studio' },
  ];

  const baseDoc = {
    _id: 'd1',
    title: 'Invoice',
    description: 'Test',
    referenceNumber: 'REF-1',
    project: 'p1',
    category: 'invoice',
    metadata: {
      vendor: 'Acme',
      amount: 1000,
      currency: 'INR',
      tax: 180,
      date: '2025-06-15T00:00:00.000Z',
      submissionType: 'upload',
      attachments: [{ url: 'https://example.com/a.pdf' }],
      detectedCategory: 'invoice',
    },
  };

  it('builds edit form with payment date as YYYY-MM-DD', () => {
    const form = buildFinanceEditForm(baseDoc, projects);
    expect(form.workspace).toBe('Studio');
    expect(form.metadata.date).toBe('2025-06-15');
  });

  it('financeEditPayload preserves server-only metadata and parses numbers', () => {
    const form = buildFinanceEditForm(baseDoc, projects);
    form.title = 'Updated';
    form.metadata.amount = '2500.5';
    form.metadata.tax = '0';
    form.metadata.date = '2025-07-01';

    const payload = financeEditPayload(form, baseDoc);
    expect(payload.title).toBe('Updated');
    expect(payload.metadata.amount).toBe(2500.5);
    expect(payload.metadata.tax).toBe(0);
    expect(payload.metadata.submissionType).toBe('upload');
    expect(payload.metadata.attachments).toHaveLength(1);
    expect(payload.metadata.detectedCategory).toBe('invoice');
    expect(payload.metadata.date).toEqual(new Date('2025-07-01'));
  });
});
