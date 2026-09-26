import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Point, Stroke, StrokeChunk } from '../shared/types';

export const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#242323', label: 'Mực đen' },
  { value: '#ffffff', label: 'Tẩy' },
  { value: '#d90429', label: 'Đỏ' },
  { value: '#f08c00', label: 'Cam' },
  { value: '#f9d423', label: 'Vàng' },
  { value: '#2b9348', label: 'Xanh lá' },
  { value: '#0a9396', label: 'Xanh ngọc' },
  { value: '#1769e8', label: 'Xanh dương' },
  { value: '#6741d9', label: 'Tím' },
  { value: '#ec2ce2', label: 'Hồng' },
  { value: '#8d5524', label: 'Nâu' },
  { value: '#9aa0a6', label: 'Xám' },
];

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

type DrawingBoardProps = {
  strokes: Stroke[];
  interactive: boolean;
  showTools?: boolean;
  onChunk?: (chunk: StrokeChunk) => void;
  onUndo?: () => void;
  onClear?: () => void;
  overlay?: ReactNode;
};

export function DrawingBoard({ strokes, interactive, showTools = false, onChunk, onUndo, onClear, overlay }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevStrokesRef = useRef<Stroke[]>([]);
  const activeStroke = useRef<{ id: string; points: Point[]; color: string; width: number } | null>(null);
  const sentCountRef = useRef(0);
  const lastEmitRef = useRef(0);
  const [color, setColor] = useState(PALETTE[0].value);
  const [width, setWidth] = useState(5);

  const context2d = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const drawSegment = (context: CanvasRenderingContext2D, stroke: { points: Point[]; color: string; width: number }, fromIndex: number) => {
    if (!stroke.points.length) return;
    const rect = context.canvas.getBoundingClientRect();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    if (stroke.points.length === 1 || fromIndex >= stroke.points.length - 1) {
      const point = stroke.points[stroke.points.length - 1];
      context.beginPath();
      context.arc(point.x * rect.width, point.y * rect.height, stroke.width / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const start = Math.max(0, Math.min(fromIndex, stroke.points.length - 2));
    context.beginPath();
    context.moveTo(stroke.points[start].x * rect.width, stroke.points[start].y * rect.height);
    for (const point of stroke.points.slice(start + 1)) context.lineTo(point.x * rect.width, point.y * rect.height);
    context.stroke();
  };

  const redrawAll = (context: CanvasRenderingContext2D, list: Stroke[]) => {
    const rect = context.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    for (const stroke of list) drawSegment(context, stroke, 0);
  };

  useEffect(() => {
    const context = context2d();
    if (!context) return;
    const prev = prevStrokesRef.current;
    const next = strokes;
    prevStrokesRef.current = next;
    if (prev === next) return;
    if (next.length === prev.length && next.length > 0) {
      const prevLast = prev[prev.length - 1];
      const nextLast = next[next.length - 1];
      if (prevLast.id === nextLast.id && prevLast !== nextLast && nextLast.points.length >= prevLast.points.length) {
        drawSegment(context, nextLast, prevLast.points.length);
        return;
      }
    }
    if (next.length === prev.length + 1 && (prev.length === 0 || next.slice(0, prev.length).every((stroke, index) => stroke === prev[index]))) {
      drawSegment(context, next[next.length - 1], 0);
      return;
    }
    redrawAll(context, next);
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext('2d');
      if (context) redrawAll(context, prevStrokesRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    const stroke = { id: uuid(), points: [point], color, width };
    activeStroke.current = stroke;
    sentCountRef.current = 0;
    lastEmitRef.current = Date.now();
    onChunk?.({ id: stroke.id, points: [point], color, width });
    sentCountRef.current = 1;
    const context = context2d();
    if (context) drawSegment(context, stroke, 0);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !activeStroke.current) return;
    const stroke = activeStroke.current;
    const prevLength = stroke.points.length;
    stroke.points.push(pointFromEvent(event));
    const context = context2d();
    if (context) drawSegment(context, stroke, prevLength);
    const now = Date.now();
    if (now - lastEmitRef.current >= 45) {
      const pending = stroke.points.slice(sentCountRef.current);
      if (pending.length) {
        onChunk?.({ id: stroke.id, points: pending, color: stroke.color, width: stroke.width });
        sentCountRef.current = stroke.points.length;
      }
      lastEmitRef.current = now;
    }
  };

  const pointerUp = () => {
    const stroke = activeStroke.current;
    if (!stroke) return;
    if (sentCountRef.current < stroke.points.length) {
      const pending = stroke.points.slice(sentCountRef.current);
      if (pending.length) onChunk?.({ id: stroke.id, points: pending, color: stroke.color, width: stroke.width });
    }
    activeStroke.current = null;
    sentCountRef.current = 0;
  };

  return (
    <div className="board-wrap">
      <canvas
        ref={canvasRef}
        className={interactive ? 'drawing-canvas interactive' : 'drawing-canvas'}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        aria-label="Bảng vẽ trực tiếp"
      />
      {overlay}
      {showTools && (
        <div className="board-tools">
          <div className="swatches">
            {PALETTE.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${color === item.value ? 'swatch active' : 'swatch'}${item.value === '#ffffff' ? ' eraser' : ''}`}
                style={{ background: item.value }}
                aria-label={item.label}
                title={item.label}
                onClick={() => setColor(item.value)}
              />
            ))}
          </div>
          <label className="brush-label">
            Nét
            <input type="range" min="2" max="16" value={width} onChange={(event) => setWidth(Number(event.target.value))} aria-label="Độ dày nét vẽ" />
          </label>
          <div className="tool-group">
            <button type="button" className="tool-button" onClick={() => onUndo?.()} aria-label="Hoàn tác nét vẽ cuối" title="Hoàn tác">↶</button>
            <button type="button" className="tool-button danger" onClick={() => onClear?.()} aria-label="Xóa bảng vẽ" title="Xóa bảng vẽ">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
