/**
 * ChatComposer with per-thread draft persistence. Fixes #819.
 * Stores draft messages per thread ID. Drafts cleared on send.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';

interface DraftStore {
  [threadId: string]: string;
}

interface ChatComposerWithDraftsProps {
  currentThreadId: string;
  onSend: (message: string) => void;
  placeholder?: string;
}

const drafts: DraftStore = {};

export function ChatComposerWithDrafts({
  currentThreadId,
  onSend,
  placeholder = 'Type a message...',
}: ChatComposerWithDraftsProps) {
  const [text, setText] = useState(drafts[currentThreadId] || '');
  const prevThreadRef = useRef(currentThreadId);

  // Save draft on thread switch
  useEffect(() => {
    if (prevThreadRef.current !== currentThreadId) {
      const prevDraft = text.trim();
      if (prevDraft) {
        drafts[prevThreadRef.current] = prevDraft;
      }
      prevThreadRef.current = currentThreadId;
      setText(drafts[currentThreadId] || '');
    }
  }, [currentThreadId, text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    delete drafts[currentThreadId];
  }, [text, currentThreadId, onSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (val.trim()) {
      drafts[currentThreadId] = val.trim();
    } else {
      delete drafts[currentThreadId];
    }
  }, [currentThreadId]);

  return (
    <div className="chat-composer">
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <button onClick={handleSend} disabled={!text.trim()}>Send</button>
    </div>
  );
}

export { drafts };
