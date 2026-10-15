/**
 * Pinta una nota (markdown mínimo) como elementos de React: negrita, listas y
 * saltos de línea. Sin dangerouslySetInnerHTML: todo texto sale escapado.
 */
import { Fragment } from 'react';
import { parseNote, type NoteSpan } from '@/lib/school/tacticalMedia';

function Spans({ spans }: { spans: NoteSpan[] }) {
  return (
    <>
      {spans.map((s, i) => (s.bold ? <strong key={i} className="font-bold">{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}

export function NoteText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseNote(text);
  if (!blocks.length) return null;
  return (
    <div className={`space-y-2 break-words ${className}`} data-testid="note-text">
      {blocks.map((b, i) => (b.type === 'ul' ? (
        <ul key={i} className="list-disc pl-5 space-y-0.5">
          {b.items.map((it, j) => <li key={j}><Spans spans={it} /></li>)}
        </ul>
      ) : (
        <p key={i}>
          {b.lines.map((l, j) => (
            <Fragment key={j}>{j > 0 && <br />}<Spans spans={l} /></Fragment>
          ))}
        </p>
      )))}
    </div>
  );
}
