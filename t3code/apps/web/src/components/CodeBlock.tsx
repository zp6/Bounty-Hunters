/**
 * Enhanced code block with syntax highlighting, copy button, and collapsible sections.
 * Part of issue #837 - Add syntax highlighting to ChatMarkdown.
 */
import React, { useState, useRef, useCallback } from 'react';

interface CodeBlockProps {
  children: string;
  language?: string;
  maxLines?: number;
  showLines?: number;
}

export function CodeBlock({
  children,
  language = '',
  maxLines = 20,
  showLines = 10,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  
  const lines = children.split('\n');
  const isLong = lines.length > maxLines;
  const displayLines = expanded || !isLong ? lines : lines.slice(0, showLines);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = children;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [children]);

  // Simple syntax class based on language
  const langClass = language ? `language-${language}` : '';
  
  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {language && <span className="code-language">{language}</span>}
        <button
          className="copy-button"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="code-block-body">
        <pre ref={codeRef} className={`code-content ${langClass}`}>
          <code>
            {displayLines.map((line, i) => (
              <div key={i} className="code-line">
                <span className="line-number">{i + 1}</span>
                <span className="line-content">{line}</span>
              </div>
            ))}
          </code>
        </pre>
        {isLong && !expanded && (
          <div className="collapse-overlay">
            <button className="expand-button" onClick={() => setExpanded(true)}>
              Show all {lines.length} lines
            </button>
          </div>
        )}
        {expanded && isLong && (
          <button className="collapse-button" onClick={() => setExpanded(false)}>
            Collapse
          </button>
        )}
      </div>
    </div>
  );
}

export default CodeBlock;
