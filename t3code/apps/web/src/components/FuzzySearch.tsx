/**
 * Fuzzy search with match highlighting for CommandPalette. Fixes #830.
 * Character-by-character matching with scoring.
 */
import React, { useMemo } from 'react';

interface Command {
  id: string;
  name: string;
  category?: string;
}

interface MatchResult {
  command: Command;
  score: number;
  matchIndices: number[];
}

function fuzzyMatch(query: string, text: string): { score: number; indices: number[] } | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  const indices: number[] = [];
  let score = 0;
  let prevIndex = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      // Consecutive match bonus
      if (ti === prevIndex + 1) score += 5;
      // Word boundary bonus
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 3;
      score += 1;
      prevIndex = ti;
      qi++;
    }
  }

  if (qi !== q.length) return null; // Not all chars matched
  
  // Shorter commands score higher
  score += Math.max(0, 20 - text.length);
  
  return { score, indices };
}

function highlightMatches(text: string, indices: number[]): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const indexSet = new Set(indices);
  let inMatch = false;
  let matchStart = 0;

  for (let i = 0; i <= text.length; i++) {
    const isMatch = indexSet.has(i);
    if (isMatch && !inMatch) {
      if (i > lastIndex) parts.push(text.slice(lastIndex, i));
      inMatch = true;
      matchStart = i;
    } else if (!isMatch && inMatch) {
      parts.push(<mark key={i} className="fuzzy-highlight">{text.slice(matchStart, i)}</mark>);
      lastIndex = i;
      inMatch = false;
    }
  }
  if (inMatch) {
    parts.push(<mark key="end" className="fuzzy-highlight">{text.slice(matchStart)}</mark>);
  } else if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

interface FuzzyCommandPaletteProps {
  commands: Command[];
  query: string;
  onSelect: (command: Command) => void;
}

export function FuzzyCommandPalette({ commands, query, onSelect }: FuzzyCommandPaletteProps) {
  const results = useMemo(() => {
    if (!query.trim()) return commands.map(c => ({ command: c, score: 0, matchIndices: [] }));
    
    const matched: MatchResult[] = [];
    for (const cmd of commands) {
      const result = fuzzyMatch(query, cmd.name);
      if (result) {
        matched.push({ command: cmd, score: result.score, matchIndices: result.indices });
      }
    }
    return matched.sort((a, b) => b.score - a.score);
  }, [commands, query]);

  return (
    <ul className="fuzzy-command-palette">
      {results.map(({ command, matchIndices }) => (
        <li key={command.id} onClick={() => onSelect(command)} className="command-item">
          <span className="command-name">
            {query ? highlightMatches(command.name, matchIndices) : command.name}
          </span>
          {command.category && <span className="command-category">{command.category}</span>}
        </li>
      ))}
    </ul>
  );
}

export { fuzzyMatch, highlightMatches };
