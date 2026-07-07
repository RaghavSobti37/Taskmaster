import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

function normalizeHtml(html = '') {
  return html === '<p><br></p>' ? '' : html;
}

const QuillEditor = forwardRef(function QuillEditor({
  value = '',
  onChange,
  modules,
  formats,
  placeholder,
  readOnly = false,
  theme = 'snow',
  className = '',
}, ref) {
  const hostRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value || '');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    getEditor: () => quillRef.current,
  }), []);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    hostRef.current.innerHTML = '';
    const editorNode = document.createElement('div');
    hostRef.current.appendChild(editorNode);

    const quill = new Quill(editorNode, {
      theme,
      modules,
      formats,
      placeholder,
      readOnly,
    });
    quillRef.current = quill;
    if (valueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(valueRef.current, 'silent');
    }

    const handleTextChange = (delta, oldDelta, source) => {
      const html = normalizeHtml(quill.root.innerHTML);
      valueRef.current = html;
      onChangeRef.current?.(html, delta, source, quill);
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
      quillRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [formats, modules, placeholder, readOnly, theme]);

  useEffect(() => {
    const quill = quillRef.current;
    const next = value || '';
    if (!quill || next === valueRef.current) return;
    const range = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(next, 'silent');
    valueRef.current = next;
    if (range) {
      const length = quill.getLength();
      quill.setSelection(Math.min(range.index, length - 1), range.length, 'silent');
    }
  }, [value]);

  return <div className={className} ref={hostRef} />;
});

export default QuillEditor;
