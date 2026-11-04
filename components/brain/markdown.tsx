"use client";
import { Children, isValidElement, memo, useMemo } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Diagram, Figure } from "./visual";
import { ComparisonVisual } from "./comparison-visual";
import { GlossaryTerm, rehypeGlossary, useGlossary } from "./glossary-context";
import { isPrivateImage } from "@/lib/brain/media";
import { GLOSSARY_TAG } from "@/lib/brain/glossary";
import { rehypeTranslations, TRANSLATION_LINK, TRANSLATION_TAG } from "@/lib/brain/translations";
import { TranslationProvider, TranslationTerm } from "./translation-term";

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

const glossaryComponents = { [GLOSSARY_TAG]: GlossaryTerm, [TRANSLATION_TAG]: TranslationTerm } as Components;

/** With `linkTerms`, concepts from note titles open a short preview. `skipTermNoteId` keeps one concept unlinked, e.g. the answer of an unrevealed card. */
export const Markdown = memo(function Markdown({ content, headingPrefix, linkTerms = false, skipTermNoteId = null, translations = true }: { content: string; headingPrefix?: string; linkTerms?: boolean; skipTermNoteId?: string | null; translations?: boolean }) {
  const glossary = useGlossary()?.glossary;
  const rehypePlugins = useMemo<Options["rehypePlugins"]>(() => {
    const plugins: NonNullable<Options["rehypePlugins"]> = [];
    if (translations) plugins.push(rehypeTranslations);
    if (linkTerms && glossary) plugins.push([rehypeGlossary, { glossary, skipNoteId: skipTermNoteId }]);
    return plugins;
  }, [linkTerms, glossary, skipTermNoteId, translations]);
  return <TranslationProvider><div className="prose-brain"><ReactMarkdown remarkPlugins={[remarkGfm, [remarkHeadingIds, { prefix: headingPrefix }]]} rehypePlugins={rehypePlugins} skipHtml
    urlTransform={(url, key) => key === "src" ? (isPrivateImage(url) ? url : "") : url === TRANSLATION_LINK || /^https?:\/\//i.test(url) ? url : ""}
    components={{
      ...glossaryComponents,
      img: ({ src, alt, title }) => <Figure src={typeof src === "string" ? src : ""} alt={alt || "Abbildung"} caption={title ?? ""} />,
      a: ({ href, title, children }) => href === TRANSLATION_LINK
        ? translations && title?.trim() ? <TranslationTerm translation={title}>{children}</TranslationTerm> : <span>{children}</span>
        : href ? <a href={href} title={title} target="_blank" rel="noreferrer noopener">{children}</a> : <span>{children}</span>,
      p: ({ node, children }) => node?.children.some(child => child.type === "element" && child.tagName === "img") ? <div className="figure-paragraph">{children}</div> : <p>{children}</p>,
      pre: ({ children }) => {
        const child = Children.toArray(children)[0];
        if (isValidElement<{ className?: string; children?: unknown }>(child) && child.props.className === "language-mermaid") return <Diagram source={String(child.props.children ?? "").trim()} />;
        return <pre>{children}</pre>;
      },
      table: ({ children }) => <ComparisonVisual>{children}</ComparisonVisual>,
    }}>{content}</ReactMarkdown></div></TranslationProvider>;
});
