"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };

export function DiagramViewer({ src }: { src: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pendingScroll = useRef<Point | null>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = () => {
    const viewport = viewportRef.current, image = imageRef.current;
    if (!viewport || !image?.naturalWidth || !image.naturalHeight) return;
    const fit = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight, 1);
    setSize({ width: image.naturalWidth * fit, height: image.naturalHeight * fit });
  };

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current, scroll = pendingScroll.current;
    if (viewport && scroll) {
      viewport.scrollLeft = scroll.x;
      viewport.scrollTop = scroll.y;
      pendingScroll.current = null;
    }
  }, [zoom]);

  const changeZoom = (value: number, anchor?: Point, previousAnchor = anchor) => {
    const viewport = viewportRef.current;
    if (!viewport || !size.width) return;
    const next = Math.max(1, Math.min(6, value)), previous = zoomRef.current;
    const target = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const origin = previousAnchor ?? target;
    // Account for centering while the image is smaller than the viewport.
    const oldOffset = { x: Math.max(0, (viewport.clientWidth - size.width * previous) / 2), y: Math.max(0, (viewport.clientHeight - size.height * previous) / 2) };
    const newOffset = { x: Math.max(0, (viewport.clientWidth - size.width * next) / 2), y: Math.max(0, (viewport.clientHeight - size.height * next) / 2) };
    const scroll = {
      x: (viewport.scrollLeft + origin.x - oldOffset.x) * next / previous + newOffset.x - target.x,
      y: (viewport.scrollTop + origin.y - oldOffset.y) * next / previous + newOffset.y - target.y,
    };
    if (next === previous) {
      viewport.scrollLeft = scroll.x;
      viewport.scrollTop = scroll.y;
    } else {
      pendingScroll.current = scroll;
      zoomRef.current = next;
      setZoom(next);
    }
  };

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
    <div className="diagram-viewer-controls" role="group" aria-label="Diagrammzoom">
      <Button variant="outline" size="icon" aria-label="Diagramm verkleinern" disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.5)}><Minus size={16} /></Button>
      <output aria-live="polite">{Math.round(zoom * 100)} %</output>
      <Button variant="outline" size="icon" aria-label="Diagramm weiter vergrößern" disabled={zoom >= 6} onClick={() => changeZoom(zoom * 1.5)}><Plus size={16} /></Button>
      <Button variant="outline" size="icon" aria-label="Diagramm einpassen" onClick={() => changeZoom(1)}><RotateCcw size={16} /></Button>
    </div>
    <div ref={viewportRef} className="diagram-viewport" tabIndex={0} role="region" aria-label="Vergrößertes Diagramm, mit zwei Fingern zoomen und durch Ziehen verschieben"
      onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.button !== 0 || event.clientX - rect.left >= event.currentTarget.clientWidth || event.clientY - rect.top >= event.currentTarget.clientHeight) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={pointerMove} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}>
      <div className="diagram-canvas" style={{ width: size.width * zoom, height: size.height * zoom }}>
        <img ref={imageRef} src={src} alt="Diagramm" draggable={false} onLoad={measure} style={{ width: size.width ? size.width * zoom : undefined, height: size.height ? size.height * zoom : undefined }} />
      </div>
    </div>
  </div>;
}
