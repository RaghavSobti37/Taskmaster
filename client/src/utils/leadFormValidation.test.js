import { describe, it, expect } from 'vitest';
import { validateLeadFormFields } from './leadFormValidation';

describe('validateLeadFormFields', () => {
  it('rejects missing name', () => {
    const { valid, errors } = validateLeadFormFields({
      name: '',
      email: 'test@example.com',
      phone: '+919876543210',
      countryCode: '+91',
    });
    expect(valid).toBe(false);
    expect(errors.name).toBeTruthy();
  });

  it('accepts valid lead payload', () => {
    const { valid, sanitized } = validateLeadFormFields({
      name: 'Raghav Raj Sobti',
      email: 'redacted@example.com',
      phone: '+918591499393',
    });
    expect(valid).toBe(true);
    expect(sanitized.name).toBe('Raghav Raj Sobti');
  });
});
