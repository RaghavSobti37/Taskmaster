import React, { useMemo, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const DESKTOP_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
];

const MOBILE_TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'clean'],
];

export default function NoteRichEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  isMobile = false,
  readOnly = false,
}) {
  const quillRef = useRef(null);

  const modules = useMemo(
    () => ({
      toolbar: isMobile ? MOBILE_TOOLBAR : DESKTOP_TOOLBAR,
      history: { delay: 400, maxStack: 200, userOnly: true },
      clipboard: { matchVisual: false },
    }),
    [isMobile]
  );

  const formats = useMemo(
    () => [
      'header',
      'bold', 'italic', 'underline', 'strike',
      'list', 'bullet', 'indent', 'blockquote', 'code-block',
      'link',
    ],
    []
  );

  useEffect(() => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return undefined;

    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (['b', 'i', 'u', 'z', 'y'].includes(key)) return;
      if (key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('coreknot:note-save'));
      }
    };

    const root = editor.root;
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`note-rich-editor flex flex-col min-h-0 flex-1 ${isMobile ? 'note-rich-editor--mobile' : ''}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        className="note-rich-editor__quill flex flex-col min-h-0 flex-1"
      />
      {!isMobile && (
        <p className="shrink-0 px-1 pt-2 text-[10px] text-[var(--color-text-muted)]">
          Shortcuts: ⌘/Ctrl+B bold · ⌘/Ctrl+I italic · ⌘/Ctrl+U underline · ⌘/Ctrl+Z undo · ⌘/Ctrl+S save
        </p>
      )}
    </div>
  );
}
