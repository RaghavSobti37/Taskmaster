import { useEffect, useState } from 'react';
import axios from 'axios';
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

    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.post('/api/mail/preview', {
          content,
          subject: template.subject || '',
          dummyValues,
          format,
          removeUnsubscribe: true,
          theme: 'light',
        });
        if (!cancelled) {
          setHtml(data.html || '');
          setSubject(data.subject || applyDummyValuesPlain(template.subject || '', dummyValues));
        }
      } catch {
        if (!cancelled) {
          setHtml('<p style="padding:16px;color:#dc2626;font-family:sans-serif">Preview failed</p>');
          setSubject(applyDummyValuesPlain(template.subject || '', dummyValues));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [template]);

  return { html, subject, loading };
}
