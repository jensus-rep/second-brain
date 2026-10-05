"use client";
import { Children, isValidElement, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Diagram, Figure } from "./visual";
import { ComparisonVisual } from "./comparison-visual";
import { isPrivateImage } from "@/lib/brain/media";

type MarkdownNode = { type: string; children?: MarkdownNode[]; data?: { hProperties?: Record<string, unknown> } };
function remarkHeadingIds({ prefix }: { prefix?: string }) {
  return (tree: unknown) => {
    if (!prefix) return;
    let index = 0;
    const visit = (node: MarkdownNode) => {
      if (node.type === "heading") node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: `${prefix}-${index++}` } };
      node.children?.forEach(visit);
    };
    visit(tree as MarkdownNode);
  };
}

export const Markdown = memo(function Markdown({ content, headingPrefix }: { content: string; headingPrefix?: string }) {
  return <div className="prose-brain"><ReactMarkdown remarkPlugins={[remarkGfm, [remarkHeadingIds, { prefix: headingPrefix }]]} skipHtml
    urlTransform={(url, key) => key === "src" ? (isPrivateImage(url) ? url : "") : /^https?:\/\//i.test(url) ? url : ""}
    components={{
      img: ({ src, alt, title }) => <Figure src={typeof src === "string" ? src : ""} alt={alt || "Abbildung"} caption={title ?? ""} />,
      a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noreferrer noopener">{children}</a> : <span>{children}</span>,
      p: ({ node, children }) => node?.children.some(child => child.type === "element" && child.tagName === "img") ? <div className="figure-paragraph">{children}</div> : <p>{children}</p>,
      pre: ({ children }) => {
        const child = Children.toArray(children)[0];
        if (isValidElement<{ className?: string; children?: unknown }>(child) && child.props.className === "language-mermaid") return <Diagram source={String(child.props.children ?? "").trim()} />;
        return <pre>{children}</pre>;
      },
      table: ({ children }) => <ComparisonVisual>{children}</ComparisonVisual>,
    }}>{content}</ReactMarkdown></div>;
});
