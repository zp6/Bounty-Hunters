import React, { useState, useCallback, useEffect, useRef } from "react";

type SearchSource = "chat" | "files" | "git";

interface SearchResult {
  id: string;
  source: SearchSource;
  title: string;
  preview: string;
  matchStart: number;
  matchEnd: number;
  path?: string;
  timestamp?: number;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
  onSearch: (query: string, source: SearchSource, options: SearchOptions) => Promise<SearchResult[]>;
}

interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
}

const sourceIcons: Record<SearchSource, string> = {
  chat: "💬",
  files: "📄",
  git: "🔀",
};

const highlightMatch = (text: string, start: number, end: number): React.ReactNode => (
  <>
    {text.substring(0, start)}
    <mark className="search-highlight">{text.substring(start, end)}</mark>
    {text.substring(end)}
  </>
);

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  onResultClick,
  onSearch,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeSource, setActiveSource] = useState<SearchSource | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        if (isOpen) onClose();
        else inputRef.current?.focus();
      }
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const sources: SearchSource[] =
          activeSource === "all" ? ["chat", "files", "git"] : [activeSource];
        const allResults = await Promise.all(
          sources.map((s) =>
            onSearch(query, s, { regex, caseSensitive })
          )
        );
        setResults(allResults.flat());
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeSource, regex, caseSensitive, onSearch]);

  if (!isOpen) return null;

  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.source]) acc[r.source] = [];
      acc[r.source].push(r);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chat, files, git history..."
            autoFocus
          />
          <div className="search-toggles">
            <button
              className={`toggle-btn ${regex ? "active" : ""}`}
              onClick={() => setRegex(!regex)}
              title="Regex search"
            >
              .*
            </button>
            <button
              className={`toggle-btn ${caseSensitive ? "active" : ""}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Case sensitive"
            >
              Aa
            </button>
          </div>
        </div>

        <div className="search-filters">
          {(["all", "chat", "files", "git"] as const).map((s) => (
            <button
              key={s}
              className={`filter-btn ${activeSource === s ? "active" : ""}`}
              onClick={() => setActiveSource(s)}
            >
              {s === "all" ? "All" : `${sourceIcons[s]} ${s}`}
            </button>
          ))}
        </div>

        <div className="search-results">
          {loading && <div className="search-loading">Searching...</div>}
          {Object.entries(grouped).map(([source, items]) => (
            <div key={source} className="result-group">
              <div className="result-group-header">
                {sourceIcons[source as SearchSource]} {source} ({items.length})
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="result-item"
                  onClick={() => onResultClick(item)}
                >
                  <div className="result-title">{item.title}</div>
                  <div className="result-preview">
                    {highlightMatch(item.preview, item.matchStart, item.matchEnd)}
                  </div>
                  {item.path && <div className="result-path">{item.path}</div>}
                </div>
              ))}
            </div>
          ))}
          {!loading && query && results.length === 0 && (
            <div className="no-results">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
