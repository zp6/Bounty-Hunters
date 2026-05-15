import React, { useCallback, useRef, useState } from "react";

// Accessible ChatView with ARIA attributes and keyboard navigation
export const AccessibleChatView: React.FC = () => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const messages = [
    { id: "1", role: "user", content: "Hello" },
    { id: "2", role: "assistant", content: "Hi there!" },
  ];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : messages.length - 1
          );
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < messages.length - 1 ? prev + 1 : 0
          );
          break;
        case "Enter":
          if (focusedIndex >= 0) {
            // Expand message details
            const el = document.querySelector(
              `[data-message-index="${focusedIndex}"]`
            );
            el?.querySelector("[data-details]")?.classList.toggle("expanded");
          }
          break;
        case "Escape":
          composerRef.current?.focus();
          setFocusedIndex(-1);
          break;
      }
    },
    [focusedIndex, messages.length]
  );

  return (
    <div className="chat-view" role="region" aria-label="Chat">
      {/* Skip links */}
      <a href="#sidebar" className="skip-link">
        Skip to sidebar
      </a>
      <a href="#chat-messages" className="skip-link">
        Skip to messages
      </a>
      <a href="#chat-composer" className="skip-link">
        Skip to composer
      </a>

      {/* Messages container */}
      <div
        id="chat-messages"
        ref={messagesRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="messages-container"
      >
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            role="listitem"
            data-message-index={index}
            className={`message ${focusedIndex === index ? "focused" : ""}`}
            aria-label={`${msg.role} message: ${msg.content}`}
          >
            <div className="message-role">{msg.role}</div>
            <div className="message-content">{msg.content}</div>
            <div data-details className="message-details" hidden>
              Details for message {msg.id}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="chat-composer" role="form" aria-label="Chat input">
        <textarea
          id="chat-composer"
          ref={composerRef}
          aria-label="Type your message"
          placeholder="Type a message..."
        />
        <button aria-label="Send message" data-testid="send-btn">
          Send
        </button>
        <button aria-label="Attach file" data-testid="attach-btn">
          Attach
        </button>
        <button aria-label="Clear chat" data-testid="clear-btn">
          Clear
        </button>
      </div>
    </div>
  );
};

export default AccessibleChatView;
