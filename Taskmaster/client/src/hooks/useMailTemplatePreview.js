import { useEffect, useState } from 'react';
import {
  getEffectiveTemplateContent,
  normalizeTemplateDummyValues,
  applyDummyValuesPlain,
} from '../utils/indexedTemplateVariables';

export function useMailTemplatePreview(template) {
  const [html, setHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!template) {
      setHtml('');
      setSubject('');
      return undefined;
    }

    const content = getEffectiveTemplateContent(template);
    if (!content?.trim()) {
      setHtml('');
      setSubject('');
      return undefined;
    }

    const dummyValues = normalizeTemplateDummyValues(template.dummyValues);
    const format = template.format === 'rawHtml' ? 'rawHtml' : 'visual';
    let cancelled = false;

    setLoading(false);
    if (!cancelled) {
      const previewSubject = applyDummyValuesPlain(template.subject || '', dummyValues);
      const previewHtml = applyDummyValuesPlain(content, dummyValues);
      setHtml(format === 'rawHtml' ? previewHtml : `<div>${previewHtml.replace(/\n/g, '<br />')}</div>`);
      setSubject(previewSubject);
    }

    return () => { cancelled = true; };
  }, [template]);

  return { html, subject, loading };
}
