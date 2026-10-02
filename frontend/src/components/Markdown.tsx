import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny, safe Markdown renderer for assistant answers.
 * Supports: ### / #### headings, paragraphs, "- " and "1. " lists, **bold**, *italic*,
 * `code`, and simple | tables |. Builds React elements only — never injects HTML,
 * so model output can't run scripts or add markup.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="px-1 py-0.5 rounded bg-background/70 font-mono text-[0.92em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // headings
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      blocks.push(level <= 3
        ? <h3 key={k++} className="text-[13px] font-bold text-foreground mt-1 mb-1.5">{inline(h[2], `h${k}`)}</h3>
        : <h4 key={k++} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">{inline(h[2], `h${k}`)}</h4>);
      i++;
      continue;
    }

    // tables
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k++} className="my-2 overflow-x-auto rounded-md border border-border/70">
          <table className="w-full text-[11px]">
            <thead className="bg-background/60">
              <tr>{head.map((c, j) => <th key={j} className="px-2 py-1 text-left font-semibold whitespace-nowrap">{inline(c, `th${k}${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-border/60">
                  {r.map((c, j) => <td key={j} className="px-2 py-1 align-top">{inline(c, `td${k}${ri}${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // lists
    const bullet = /^(\s*)[-*•]\s+(.*)$/;
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const pattern = ordered ? numbered : bullet;
      const items: { text: string; nested: boolean }[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        const m = pattern.exec(lines[i])!;
        items.push({ text: m[2], nested: m[1].length >= 2 });
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} className={cn("my-1 space-y-0.5 pl-4", ordered ? "list-decimal" : "list-disc", "marker:text-muted-foreground")}>
          {items.map((it, j) => <li key={j} className={it.nested ? "ml-3" : ""}>{inline(it.text, `li${k}${j}`)}</li>)}
        </Tag>
      );
      continue;
    }

    // paragraph: this line plus the consecutive plain lines after it
    // (always consume the first line, so a stray "| x |" row can't stall the loop)
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i].trim())
           && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={k++} className="my-1">
        {para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p, `p${k}${j}`)}</Fragment>)}
      </p>
    );
  }

  return <div className={cn("break-words leading-relaxed", className)}>{blocks}</div>;
}
