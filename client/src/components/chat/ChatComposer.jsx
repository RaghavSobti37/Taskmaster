import React, { useRef, useState } from 'react';
import { Send, X, Loader2, Smile, Paperclip } from 'lucide-react';
import MentionTextarea from '../mentions/MentionTextarea';
import { uploadChatFiles } from '../../utils/chatUpload';
import { isImageAttachment } from '../../utils/chatDisplay';
import ChatEmojiPicker from './ChatEmojiPicker';

const ChatComposer = ({ onSend, disabled = false, sending = false, mentionUsers = null }) => {
  const [content, setContent] = useState('');
  const [staged, setStaged] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const uploaded = await uploadChatFiles(files, { onProgress: setUploadPct });
      setStaged((prev) => [...prev, ...uploaded]);
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const removeStaged = (index) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && staged.length === 0) return;
    await onSend({ content: trimmed, attachments: staged });
    setContent('');
    setStaged([]);
    setEmojiOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertEmoji = (emoji) => {
    setContent((prev) => `${prev}${emoji}`);
  };

  const canSend = !disabled && !sending && !uploading && (content.trim() || staged.length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 overflow-visible border-t border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-2 sm:px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {staged.map((f, i) => (
            <StagedPreview key={`${f.key || f.url}-${i}`} file={f} onRemove={() => removeStaged(i)} />
          ))}
        </div>
      )}
      {uploading && (
        <p className="text-[10px] text-[var(--color-text-muted)] mb-2">Uploading… {uploadPct}%</p>
      )}

      <div className="flex items-end gap-1 sm:gap-2">
        <div className="relative shrink-0">
          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] ${
              emojiOpen
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-action-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/60'
            }`}
            title="Emoji"
            aria-expanded={emojiOpen}
            aria-haspopup="listbox"
          >
            <Smile size={22} />
          </button>
          <ChatEmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={insertEmoji}
            anchorRef={emojiBtnRef}
          />
        </div>

        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/60 shrink-0 disabled:opacity-40"
          title="Attach file"
        >
          {uploading ? <Loader2 size={22} className="animate-spin" /> : <Paperclip size={22} />}
        </button>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div
          className="flex-1 min-w-0 rounded-[var(--radius-lg)] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--ring)]"
          onKeyDown={handleKeyDown}
        >
          <MentionTextarea
            value={content}
            onChange={setContent}
            disabled={disabled || sending}
            rows={1}
            forcePlain
            menuPlacement="above"
            mentionUsers={mentionUsers}
            placeholder={
              mentionUsers?.length
                ? 'Type a message · @ to mention someone in this chat'
                : 'Type a message'
            }
            className="!text-[15px] !border-0 !bg-transparent !shadow-none !p-0 !min-h-[22px] !max-h-28 !outline-none focus:!outline-none focus:!ring-0 w-full"
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          className={`shrink-0 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            canSend
              ? 'bg-[var(--color-action-primary)] text-white hover:opacity-90 active:scale-95'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
          title="Send"
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </form>
  );
};

function StagedPreview({ file, onRemove }) {
  if (isImageAttachment(file)) {
    return (
      <div className="relative rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-bg-border)] w-16 h-16 shrink-0">
        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-0.5 right-0.5 p-1 min-w-[28px] min-h-[28px] rounded-full bg-black/60 text-white flex items-center justify-center"
          aria-label="Remove attachment"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-primary)]">
      <span className="truncate max-w-[120px]">{file.name}</span>
      <button type="button" onClick={onRemove} className="p-1 text-[var(--color-text-muted)] hover:text-rose-500" aria-label="Remove">
        <X size={12} />
      </button>
    </span>
  );
}

export default ChatComposer;
