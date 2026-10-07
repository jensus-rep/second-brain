"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Expand, ImageOff, Network } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isPrivateImage } from "@/lib/brain/media";
import { isAllowedDiagram } from "@/lib/brain/diagram";
import { DiagramViewer } from "./diagram-viewer";

function useLightboxEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, close]);
}

export function Figure({ src, alt = "Abbildung", caption = "" }: { src: string; alt?: string; caption?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const zoomRef = useRef<HTMLButtonElement>(null);
  useLightboxEscape(open, () => setOpen(false));
  useEffect(() => { setFailed(false); setOpen(false); }, [src]);
  if (!isPrivateImage(src)) return <span className="figure-unavailable"><ImageOff size={16} />Abbildung bitte über „Bild einfügen“ hochladen.</span>;
  return <figure className="knowledge-figure">
    {failed ? <div className="figure-unavailable"><ImageOff />Diese Abbildung ist nicht verfügbar.</div> : <button ref={zoomRef} type="button" className="figure-zoom" onClick={() => setOpen(true)} aria-label={alt + " vergrößern"}><img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} /><span><Expand size={16} /></span></button>}
    {caption && <figcaption>{caption}</figcaption>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="lightbox zoom-lightbox" onCloseAutoFocus={e => { e.preventDefault(); zoomRef.current?.focus(); }}><DialogTitle className="zoom-lightbox-title">{alt}</DialogTitle><DialogDescription className="sr-only">Mit zwei Fingern oder den Zoomtasten vergrößern und durch Ziehen verschieben. Mit Escape schließen.</DialogDescription><DiagramViewer key={src} src={src} alt={alt} />{caption && <p className="zoom-lightbox-caption">{caption}</p>}</DialogContent></Dialog>
  </figure>;
}

let renderQueue: Promise<unknown> = Promise.resolve();
export function Diagram({ source }: { source: string }) {
  const elementId = "diagram-" + useId().replace(/[^a-z0-9]/gi, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const zoomRef = useRef<HTMLButtonElement>(null);
  useLightboxEscape(open, () => setOpen(false));
  useEffect(() => {
    let cancelled = false;
    setSvg(""); setError("");
    const job = async () => {
      try {
        if (!isAllowedDiagram(source)) throw new Error("Bitte ein eigenständiges Ablaufdiagramm, Sequenzdiagramm oder eine Mindmap verwenden.");
        const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([import("mermaid"), import("dompurify")]);
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false, suppressErrorRendering: true, theme: "base", fontFamily: "Segoe UI, sans-serif", themeVariables: { primaryColor: "#eef3ff", primaryTextColor: "#344761", primaryBorderColor: "#9fb6e4", lineColor: "#8c9db5", tertiaryColor: "#f6f8fc", background: "#ffffff" }, flowchart: { htmlLabels: false, useMaxWidth: true }, maxTextSize: 12000, maxEdges: 150 });
        const { svg: raw } = await mermaid.render(elementId, source);
        const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["foreignObject", "script", "a", "image"], FORBID_ATTR: ["href", "xlink:href"] });
        // Mermaid uses percentage dimensions for inline SVG. An SVG loaded as an
        // image needs intrinsic dimensions, especially in mobile WebKit.
        const document = new DOMParser().parseFromString(clean, "image/svg+xml");
        const root = document.documentElement;
        const bounds = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
        if (root.localName !== "svg" || !bounds || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) throw new Error("Invalid diagram dimensions");
        root.setAttribute("width", String(bounds[2]));
        root.setAttribute("height", String(bounds[3]));
        root.setAttribute("preserveAspectRatio", "xMidYMid meet");
        root.removeAttribute("style");
        if (!cancelled) setSvg(new XMLSerializer().serializeToString(root));
      } catch { if (!cancelled) setError("Das Diagramm konnte nicht dargestellt werden. Prüfe die Schreibweise in der Bearbeitung."); }
    };
    renderQueue = renderQueue.then(job, job);
    return () => { cancelled = true; };
  }, [source, elementId]);
  return <figure className="diagram-figure">
    {error ? <div className="diagram-error"><Network size={20} /><p>{error}</p><details><summary>Diagrammtext anzeigen</summary><pre>{source}</pre></details></div> : svg ? <button ref={zoomRef} type="button" className="diagram-zoom" aria-label="Diagramm vergrößern" onClick={() => setOpen(true)}><img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} alt="Diagramm" /><span className="expand-label"><Expand size={16} /></span></button> : <div className="diagram-loading" role="status">Diagramm wird aufgebaut …</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="lightbox diagram-lightbox zoom-lightbox" onCloseAutoFocus={e => { e.preventDefault(); zoomRef.current?.focus(); }}><DialogTitle className="zoom-lightbox-title">Diagramm</DialogTitle><DialogDescription className="sr-only">Mit zwei Fingern oder den Zoomtasten vergrößern und durch Ziehen verschieben. Mit Escape schließen.</DialogDescription><DiagramViewer key={svg} src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} /></DialogContent></Dialog>
  </figure>;
}
