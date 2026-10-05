"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";

type Cell = { text: string; content: ReactNode };
type NodeProps = { children?: ReactNode; alt?: string; node?: { tagName?: string } };

function plainText(content: ReactNode): string {
  return Children.toArray(content).map(child => {
    if (!isValidElement<NodeProps>(child)) return String(child);
    if (child.type === "br") return "\n";
    return child.props.alt ?? plainText(child.props.children);
  }).join("");
}

function tableRows(children: ReactNode): Cell[][] {
  const rows: Cell[][] = [];
  Children.forEach(children, child => {
    if (!isValidElement<NodeProps>(child)) return;
    if (child.props.node?.tagName === "tr" || child.type === "tr") {
      const cells: Cell[] = [];
      Children.forEach(child.props.children, cell => {
        if (isValidElement<NodeProps>(cell)) cells.push({ text: plainText(cell.props.children), content: cell.props.children });
      });
      rows.push(cells);
    } else rows.push(...tableRows(child.props.children));
  });
  return rows;
}

// Measure the actual font, including long unbroken words. Never shrink text to
// fit a desktop-sized graphic into a phone viewport.
function wrap(text: string, width: number, measure: (text: string) => number): string[] {
  return text.split("\n").flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + " " + word : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && measure(line + character) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line || "—");
    return lines;
  });
}

function layoutFields(headers: Cell[], cells: Cell[], width: number, measure: (text: string, bold?: boolean) => number) {
  let y = 28;
  const fields = cells.map((cell, i) => {
    const label = headers[i]?.text || `Angabe ${i + 1}`;
    const labels = wrap(label, width - 40, text => measure(text, true));
    const values = wrap(cell.text, width - 40, text => measure(text));
    const top = y;
    y += (labels.length + values.length) * 24 + 22;
    return { label, labels, values, top };
  });
  return { fields, height: y };
}

function ComparisonCard({ headers, cells, index }: { headers: Cell[]; cells: Cell[]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ width, measure }, setMetrics] = useState({ width: 320, measure: (text: string, bold = false) => text.length * (bold ? 9 : 8) });
  useEffect(() => {
    const normal = document.createElement("canvas").getContext("2d");
    const bold = document.createElement("canvas").getContext("2d");
    if (normal) normal.font = '400 16px "Segoe UI", sans-serif';
    if (bold) bold.font = '600 16px "Segoe UI", sans-serif';
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setMetrics({
      width: Math.max(1, entry.contentRect.width),
      measure: (text, strong = false) => (strong ? bold : normal)?.measureText(text).width ?? text.length * 9,
    }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { fields, height: y } = layoutFields(headers, cells, width, measure);
  return <div ref={ref} className="comparison-card">
    <svg viewBox={`0 0 ${width} ${y}`} width={width} height={y} role="img" aria-label={fields.map((field, i) => `${field.label}: ${cells[i].text || "Keine Angabe"}`).join(". ")}>
      <rect x="0.5" y="0.5" width={width - 1} height={y - 1} rx="14" fill="#f7f9fd" stroke="#dce4f0" />
      <rect x="0" y="18" width="4" height="30" rx="2" fill={index % 2 ? "#a38ccb" : "#789bdb"} />
      {fields.map((field, i) => <g key={i} fontFamily="Segoe UI, sans-serif" fontSize="16">
        {field.labels.map((line, j) => <text key={`label-${j}`} x="20" y={field.top + j * 24} fontWeight="600" fill="#344761">{line}</text>)}
        {field.values.map((line, j) => <text key={`value-${j}`} x="20" y={field.top + (field.labels.length + j) * 24} fill="#4f5e75">{line}</text>)}
      </g>)}
    </svg>
  </div>;
}

export function ComparisonVisual({ children }: { children: ReactNode }) {
  const [headers = [], ...rows] = tableRows(children);
  // A header-only comparison still contains information worth displaying.
  const cards = rows.length ? rows : [headers.map(() => ({ text: "", content: "—" }))];
  return <figure className="comparison-visual" aria-label="Vergleich als Übersicht">
    <div className="comparison-cards">{cards.map((cells, index) => <ComparisonCard key={index} headers={headers} cells={cells} index={index} />)}</div>
    <details className="comparison-text"><summary>Text und Links anzeigen</summary>
      {cards.map((cells, index) => <dl key={index}>{cells.map((cell, i) => <div key={i}><dt>{headers[i]?.content || `Angabe ${i + 1}`}</dt><dd>{cell.content || "—"}</dd></div>)}</dl>)}
    </details>
  </figure>;
}
