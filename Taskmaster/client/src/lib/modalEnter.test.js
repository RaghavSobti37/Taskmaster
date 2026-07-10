import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldSubmitModalOnEnter, triggerModalPrimarySubmit } from './modalEnter';

describe('modalEnter', () => {
  let panel;

  beforeEach(() => {
    panel = document.createElement('div');
    document.body.appendChild(panel);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('skips textarea targets', () => {
    const textarea = document.createElement('textarea');
    expect(shouldSubmitModalOnEnter(textarea)).toBe(false);
  });

  it('skips single-line inputs inside forms (native submit)', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    form.appendChild(input);
    expect(shouldSubmitModalOnEnter(input)).toBe(false);
  });

  it('allows enter on modal body', () => {
    const body = document.createElement('div');
    expect(shouldSubmitModalOnEnter(body)).toBe(true);
  });

  it('clicks primary submit button in form', () => {
    const form = document.createElement('form');
    const submit = document.createElement('button');
    submit.type = 'submit';
    let clicked = false;
    submit.addEventListener('click', () => { clicked = true; });
    form.appendChild(submit);
    panel.appendChild(form);

    expect(triggerModalPrimarySubmit(panel)).toBe(true);
    expect(clicked).toBe(true);
  });

  it('respects disabled submit buttons', () => {
    const form = document.createElement('form');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.disabled = true;
    form.appendChild(submit);
    panel.appendChild(form);

    const primary = document.createElement('button');
    primary.dataset.modalPrimary = '';
    let clicked = false;
    primary.addEventListener('click', () => { clicked = true; });
    panel.appendChild(primary);

    expect(triggerModalPrimarySubmit(panel)).toBe(true);
    expect(clicked).toBe(true);
  });

  it('does not click disabled primary action', () => {
    const primary = document.createElement('button');
    primary.dataset.modalPrimary = '';
    primary.disabled = true;
    panel.appendChild(primary);
    expect(triggerModalPrimarySubmit(panel)).toBe(false);
  });
});
