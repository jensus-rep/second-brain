"use client";

import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };

// Vector diagrams have no meaningful pixel size, so opening them at their
// intrinsic size can mean 600 % and more on phones.
const SVG_OPEN_ZOOM = 1.5;

export function DiagramViewer({ src, alt = "Diagramm" }: { src: string; alt?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pendingScroll = useRef<Point | null>(null);
  const zoomRef = useRef(1);
  const sizeRef = useRef({ width: 0, height: 0, naturalWidth: 0 });
  const fitted = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0, naturalWidth: 0 });
  const naturalZoom = size.width ? size.naturalWidth / size.width : 1;
  const maxZoom = Math.max(6, naturalZoom * 4);
  const label = alt === "Diagramm" ? "Diagramm" : "Abbildung";

  const changeZoom = useCallback((value: number, anchor?: Point, previousAnchor = anchor, nextSize = sizeRef.current, preserveFit = false) => {
    const viewport = viewportRef.current;
    if (!viewport || !nextSize.width) return;
    const previousSize = sizeRef.current;
    const limit = Math.max(6, nextSize.naturalWidth / nextSize.width * 4);
    const next = Math.max(1, Math.min(limit, value)), previous = zoomRef.current;
    if (!preserveFit) fitted.current = next === 1;
    const target = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const origin = previousAnchor ?? target;
    // Account for centering while the image is smaller than the viewport.
    const oldOffset = { x: Math.max(0, (viewport.clientWidth - previousSize.width * previous) / 2), y: Math.max(0, (viewport.clientHeight - previousSize.height * previous) / 2) };
    const newOffset = { x: Math.max(0, (viewport.clientWidth - nextSize.width * next) / 2), y: Math.max(0, (viewport.clientHeight - nextSize.height * next) / 2) };
    const ratio = previousSize.width ? nextSize.width * next / (previousSize.width * previous) : 1;
    const scroll = {
      x: previousSize.width ? (viewport.scrollLeft + origin.x - oldOffset.x) * ratio + newOffset.x - target.x : 0,
      y: previousSize.width ? (viewport.scrollTop + origin.y - oldOffset.y) * ratio + newOffset.y - target.y : 0,
    };
    if (next === previous && nextSize === previousSize) {
      viewport.scrollLeft = scroll.x;
      viewport.scrollTop = scroll.y;
    } else {
      pendingScroll.current = scroll;
      zoomRef.current = next;
      sizeRef.current = nextSize;
      setZoom(next);
      setSize(nextSize);
    }
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current, image = imageRef.current;
    if (!viewport?.clientWidth || !viewport.clientHeight || !image?.naturalWidth || !image.naturalHeight) return;
    const fit = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight, 1);
    const nextSize = { width: image.naturalWidth * fit, height: image.naturalHeight * fit, naturalWidth: image.naturalWidth };
    if (nextSize.width === sizeRef.current.width && nextSize.height === sizeRef.current.height) return;
    // Original size can also equal 100% of the fitted view. Track the user's
    // fit choice separately so rotating back to portrait keeps labels readable.
    const openZoom = src.startsWith("data:image/svg+xml") ? Math.min(1 / fit, SVG_OPEN_ZOOM) : 1 / fit;
    const nextZoom = !sizeRef.current.width ? openZoom : fitted.current ? 1 : zoomRef.current * sizeRef.current.width / nextSize.width;
    changeZoom(nextZoom, undefined, undefined, nextSize, true);
  }, [changeZoom, src]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current, scroll = pendingScroll.current;
    if (viewport && scroll) {
      viewport.scrollLeft = scroll.x;
      viewport.scrollTop = scroll.y;
      pendingScroll.current = null;
    }
  }, [zoom, size]);

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current, previous = pointers.current.get(event.pointerId);
    if (!viewport || !previous) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    if (after.length === 1) {
      viewport.scrollLeft += previous.x - event.clientX;
      viewport.scrollTop += previous.y - event.clientY;
    } else if (after.length === 2) {
      const distance = (points: Point[]) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const rect = viewport.getBoundingClientRect();
      const midpoint = (points: Point[]) => ({ x: (points[0].x + points[1].x) / 2 - rect.left - viewport.clientLeft, y: (points[0].y + points[1].y) / 2 - rect.top - viewport.clientTop });
      if (distance(before) > 0) changeZoom(zoomRef.current * distance(after) / distance(before), midpoint(after), midpoint(before));
    }
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  return <div className="diagram-viewer">
    <div className="diagram-viewer-controls" role="group" aria-label={`${label} zoomen`}>
      <Button variant="outline" size="icon" aria-label={`${label} verkleinern`} disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.5)}><Minus size={16} /></Button>
      <output aria-live="polite" aria-label="Zoom relativ zur eingepassten Ansicht">{Math.round(zoom * 100)} %</output>
      <Button variant="outline" size="icon" aria-label={`${label} weiter vergrößern`} disabled={!size.width || zoom >= maxZoom} onClick={() => changeZoom(zoom * 1.5)}><Plus size={16} /></Button>
      <Button variant="outline" size="icon" aria-label={`${label} einpassen`} onClick={() => changeZoom(1)}><RotateCcw size={16} /></Button>
      <Button variant="outline" size="icon" aria-label="Originalgröße anzeigen" onClick={() => { changeZoom(naturalZoom); fitted.current = false; }}><Scan size={16} /></Button>
    </div>
    <p className="diagram-viewer-hint">Mit zwei Fingern zoomen · Zum Verschieben ziehen</p>
    <div ref={viewportRef} className="diagram-viewport" tabIndex={0} role="region" aria-label={`${alt}, mit zwei Fingern zoomen und durch Ziehen verschieben`}
      onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.button !== 0 || event.clientX - rect.left >= event.currentTarget.clientWidth || event.clientY - rect.top >= event.currentTarget.clientHeight) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={pointerMove} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}>
      <div className="diagram-canvas" style={{ width: size.width * zoom, height: size.height * zoom }}>
        <img ref={imageRef} src={src} alt={alt} draggable={false} onLoad={measure} style={{ width: size.width ? size.width * zoom : undefined, height: size.height ? size.height * zoom : undefined }} />
      </div>
    </div>
  </div>;
}
