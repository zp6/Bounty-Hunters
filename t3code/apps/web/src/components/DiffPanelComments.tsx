import React, { useState, useCallback } from "react";

interface Comment {
  id: string;
  filePath: string;
  lineNumber: number;
  content: string;
  createdAt: number;
  collapsed: boolean;
}

interface DiffCommentsState {
  [key: string]: Comment[]; // key: "filePath:lineNumber"
}

// Session state store for comments
let commentStore: DiffCommentsState = {};

export const getCommentsForFile = (filePath: string): Comment[] => {
  return Object.values(commentStore).flat().filter(c => c.filePath === filePath);
};

export const getCommentCount = (filePath: string): number => {
  return getCommentsForFile(filePath).length;
};

interface DiffLineCommentProps {
  filePath: string;
  lineNumber: number;
  onAddComment: (lineNumber: number, content: string) => void;
}

export const DiffLineComment: React.FC<DiffLineCommentProps> = ({
  filePath,
  lineNumber,
  onAddComment,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");

  const key = `${filePath}:${lineNumber}`;
  const existing = commentStore[key] || [];

  return (
    <div className="diff-line-comment">
      {/* Line number click target */}
      <button
        className="line-number-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Add comment on line ${lineNumber}`}
        title="Click to add a comment"
      >
        {lineNumber}
        {existing.length > 0 && (
          <span className="comment-badge">{existing.length}</span>
        )}
      </button>

      {/* Comment input */}
      {isOpen && (
        <div className="comment-input-container">
          <textarea
            className="comment-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment... (Markdown supported)"
            autoFocus
          />
          <div className="comment-actions">
            <button
              className="comment-submit"
              onClick={() => {
                if (content.trim()) {
                  onAddComment(lineNumber, content.trim());
                  setContent("");
                  setIsOpen(false);
                }
              }}
            >
              Comment
            </button>
            <button
              className="comment-cancel"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing comments */}
      {existing.length > 0 && (
        <div className="comment-annotations">
          {existing.map((comment) => (
            <div key={comment.id} className="comment-annotation">
              <div className="comment-header">
                <span className="comment-time">
                  {new Date(comment.createdAt).toLocaleTimeString()}
                </span>
                <button
                  className="comment-collapse"
                  onClick={() => {
                    comment.collapsed = !comment.collapsed;
                  }}
                >
                  {comment.collapsed ? "▶" : "▼"}
                </button>
              </div>
              {!comment.collapsed && (
                <div className="comment-body markdown-body">
                  <MarkdownRenderer content={comment.content} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Simple markdown renderer placeholder
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return <div className="markdown-content">{content}</div>;
};

// Comment count badge component for tab
export const CommentCountBadge: React.FC<{ filePaths: string[] }> = ({ filePaths }) => {
  const total = filePaths.reduce(
    (sum, path) => sum + getCommentCount(path),
    0
  );

  if (total === 0) return null;

  return <span className="comment-count-badge">{total}</span>;
};

export const addComment = (filePath: string, lineNumber: number, content: string) => {
  const key = `${filePath}:${lineNumber}`;
  const comment: Comment = {
    id: `comment-${Date.now()}`,
    filePath,
    lineNumber,
    content,
    createdAt: Date.now(),
    collapsed: false,
  };

  if (!commentStore[key]) {
    commentStore[key] = [];
  }
  commentStore[key].push(comment);

  return comment;
};

export default DiffLineComment;
