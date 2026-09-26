import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { ErasePayload, Point, Stroke, StrokeChunk } from '../shared/types';

export const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#242323', label: 'Mực đen' },
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

const ERASE_EMIT_INTERVAL_MS = 40;
const BRUSH_MIN = 2;
const BRUSH_MAX = 16;
const ERASER_MIN = 10;
const ERASER_MAX = 64;

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

type DrawingBoardProps = {
  strokes: Stroke[];
  interactive: boolean;
  showTools?: boolean;
  onChunk?: (chunk: StrokeChunk) => void;
  onErase?: (payload: ErasePayload) => void;
  onUndo?: () => void;
  onClear?: () => void;
  overlay?: ReactNode;
};

export function DrawingBoard({ strokes, interactive, showTools = false, onChunk, onErase, onUndo, onClear, overlay }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevStrokesRef = useRef<Stroke[]>([]);
  const activeStroke = useRef<{ id: string; points: Point[]; color: string; width: number } | null>(null);
  const sentCountRef = useRef(0);
  const lastEmitRef = useRef(0);
  const lastEraseRef = useRef(0);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [color, setColor] = useState(PALETTE[0].value);
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(28);
  const erasing = tool === 'eraser';

  const context2d = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const applyScale = (context: CanvasRenderingContext2D) => {
    const rect = context.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return rect;
  };

  const drawSegment = (context: CanvasRenderingContext2D, stroke: { points: Point[]; color: string; width: number }, fromIndex: number) => {
    const points = stroke.points;
    if (!points.length) return;
    const rect = applyScale(context);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x * rect.width, points[0].y * rect.height, stroke.width / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const start = Math.max(0, Math.min(fromIndex, points.length - 2));
    context.beginPath();
    context.moveTo(points[start].x * rect.width, points[start].y * rect.height);
    for (const point of points.slice(start + 1)) context.lineTo(point.x * rect.width, point.y * rect.height);
    context.stroke();
  };

  const redrawAll = (context: CanvasRenderingContext2D, list: Stroke[]) => {
    const rect = applyScale(context);
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
      const nextWidth = Math.max(1, Math.round(rect.width * ratio));
      const nextHeight = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const context = canvas.getContext('2d');
      if (context) redrawAll(context, prevStrokesRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    return () => {
      window.removeEventListener('resize', resize);
      observer?.disconnect();
    };
  }, []);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const emitErase = (point: Point, immediate = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const now = Date.now();
    if (!immediate && now - lastEraseRef.current < ERASE_EMIT_INTERVAL_MS) return;
    lastEraseRef.current = now;
    onErase?.({ x: point.x, y: point.y, radius: eraserSize / rect.width, aspect: rect.height / rect.width });
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (erasing) {
      emitErase(point, true);
      return;
    }
    const stroke = { id: uuid(), points: [point], color, width: brushSize };
    activeStroke.current = stroke;
    sentCountRef.current = 0;
    lastEmitRef.current = Date.now();
    onChunk?.({ id: stroke.id, points: [point], color, width: brushSize });
    sentCountRef.current = 1;
    const context = context2d();
    if (context) drawSegment(context, stroke, 0);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    if (erasing) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) emitErase(pointFromEvent(event));
      return;
    }
    const stroke = activeStroke.current;
    if (!stroke) return;
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
        className={interactive ? `drawing-canvas interactive${erasing ? ' erasing' : ''}` : 'drawing-canvas'}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        aria-label="Bảng vẽ trực tiếp"
      />
      {overlay}
      {showTools && (
        <div className="board-tools">
          <div className={`swatches${erasing ? ' muted' : ''}`}>
            {PALETTE.map((item) => (
              <button
                key={item.value}
                type="button"
                className={!erasing && color === item.value ? 'swatch active' : 'swatch'}
                style={{ background: item.value }}
                aria-label={item.label}
                title={item.label}
                disabled={erasing}
                onClick={() => setColor(item.value)}
              />
            ))}
          </div>
          <div className="tool-group">
            <button
              type="button"
              className={erasing ? 'tool-button' : 'tool-button active'}
              aria-pressed={!erasing}
              aria-label="Bút vẽ"
              title="Bút vẽ"
              onClick={() => setTool('brush')}
            >
              ✎
            </button>
            <button
              type="button"
              className={erasing ? 'tool-button active' : 'tool-button'}
              aria-pressed={erasing}
              aria-label="Tẩy xóa"
              title="Tẩy xóa"
              onClick={() => setTool('eraser')}
            >
              ⌫
            </button>
          </div>
          <label className="brush-label">
            {erasing ? 'Tẩy' : 'Nét'}
            <input
              type="range"
              min={erasing ? ERASER_MIN : BRUSH_MIN}
              max={erasing ? ERASER_MAX : BRUSH_MAX}
              value={erasing ? eraserSize : brushSize}
              onChange={(event) => (erasing ? setEraserSize(Number(event.target.value)) : setBrushSize(Number(event.target.value)))}
              aria-label={erasing ? 'Độ rộng tẩy xóa' : 'Độ dày nét vẽ'}
            />
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
