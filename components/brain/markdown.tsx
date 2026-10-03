import { Fragment, type ReactNode } from "react";

// Content is rendered as React text nodes, never injected as HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^https?:\/\//i.test(link[2])) return <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export function Markdown({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return <div className="prose-brain">{blocks.map((block, i) => {
    if (block.startsWith("```")) return <pre key={i}><code>{block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "")}</code></pre>;
    const lines = block.split("\n");
    if (lines.every(l => /^[-*] /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
    if (lines.every(l => /^\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
    return <Fragment key={i}>{lines.map((line, j) => {
      if (line.startsWith("### ")) return <h3 key={j}>{inline(line.slice(4))}</h3>;
      if (line.startsWith("## ")) return <h2 key={j}>{inline(line.slice(3))}</h2>;
      if (line.startsWith("# ")) return <h2 key={j}>{inline(line.slice(2))}</h2>;
      if (line.startsWith("> ")) return <blockquote key={j}>{inline(line.slice(2))}</blockquote>;
      return <p key={j}>{inline(line)}</p>;
    })}</Fragment>;
  })}</div>;
}

