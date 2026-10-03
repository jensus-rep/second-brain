// Keep diagrams declarative and self-contained. Mermaid can load image shapes
// while rendering, before sanitization; reject those features at the boundary.
export function isAllowedDiagram(source: string): boolean {
  return source.length <= 12000
    && /^(?:flowchart|graph|sequenceDiagram|mindmap)\b/.test(source.trim())
    && !/(?:%%\{|@\s*\{|https?:|data:|javascript:|file:|ftp:|url\s*\(|<\s*\/?[a-z]|(?:img|image|icon)\s*:)/i.test(source);
}
