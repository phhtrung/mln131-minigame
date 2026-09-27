import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { DISPLAY_REFERENCE_WIDTH, DRAWING_HEIGHT, DRAWING_WIDTH, MAX_POINTS_PER_STROKE } from '../shared/drawing';
import type { Point, Stroke, StrokeChunk } from '../shared/types';

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
  { value: '#b5179e', label: 'Tím hồng' },
];

const BRUSH_MIN = 2;
const BRUSH_MAX = 16;
const ERASER_MIN = 10;
const ERASER_MAX = 64;
const FILL_TOLERANCE = 36;

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
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevStrokesRef = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const sentCountRef = useRef(0);
  const lastEmitRef = useRef(0);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  const [color, setColor] = useState(PALETTE[0].value);
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(28);
  const erasing = tool === 'eraser';

  const drawingContext = () => {
    const canvas = drawingCanvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const presentDrawing = () => {
    const canvas = canvasRef.current;
    const source = drawingCanvasRef.current;
    if (!canvas || !source) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(rect.width * ratio));
    const nextHeight = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.drawImage(source, 0, 0, rect.width, rect.height);
  };

  const drawSegment = (context: CanvasRenderingContext2D, stroke: { points: Point[]; color: string; width: number; tool?: Stroke['tool'] }, fromIndex: number, shouldPresent = true) => {
    const points = stroke.points;
    if (!points.length) return;
    if ('tool' in stroke && stroke.tool === 'fill') {
      fillRegion(context, points[0], stroke.color);
      if (shouldPresent) presentDrawing();
      return;
    }
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = stroke.tool === 'erase' ? '#ffffff' : stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width * DRAWING_WIDTH / DISPLAY_REFERENCE_WIDTH;
    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x * DRAWING_WIDTH, points[0].y * DRAWING_HEIGHT, context.lineWidth / 2, 0, Math.PI * 2);
      context.fillStyle = stroke.tool === 'erase' ? '#ffffff' : stroke.color;
      context.fill();
      if (shouldPresent) presentDrawing();
      return;
    }
    const start = Math.max(0, Math.min(fromIndex - 1, points.length - 2));
    context.beginPath();
    context.moveTo(points[start].x * DRAWING_WIDTH, points[start].y * DRAWING_HEIGHT);
    for (const point of points.slice(start + 1)) context.lineTo(point.x * DRAWING_WIDTH, point.y * DRAWING_HEIGHT);
    context.stroke();
    if (shouldPresent) presentDrawing();
  };

  const fillRegion = (context: CanvasRenderingContext2D, point: Point, color: string) => {
    const canvas = context.canvas;
    const width = DRAWING_WIDTH;
    const height = DRAWING_HEIGHT;
    const image = context.getImageData(0, 0, width, height);
    const pixels = image.data;
    const startX = Math.min(width - 1, Math.floor(point.x * width));
    const startY = Math.min(height - 1, Math.floor(point.y * height));
    const startIndex = (startY * width + startX) * 4;
    const targetR = pixels[startIndex];
    const targetG = pixels[startIndex + 1];
    const targetB = pixels[startIndex + 2];
    const match = (index: number) =>
      Math.abs(pixels[index] - targetR) <= FILL_TOLERANCE &&
      Math.abs(pixels[index + 1] - targetG) <= FILL_TOLERANCE &&
      Math.abs(pixels[index + 2] - targetB) <= FILL_TOLERANCE;
    const hex = color.slice(1);
    const fillR = Number.parseInt(hex.slice(0, 2), 16);
    const fillG = Number.parseInt(hex.slice(2, 4), 16);
    const fillB = Number.parseInt(hex.slice(4, 6), 16);
    if (targetR === fillR && targetG === fillG && targetB === fillB) return;
    const stack = new Int32Array(width * height);
    const visited = new Uint8Array(width * height);
    let stackSize = 1;
    stack[0] = startY * width + startX;
    visited[startY * width + startX] = 1;
    pixels[startIndex] = fillR;
    pixels[startIndex + 1] = fillG;
    pixels[startIndex + 2] = fillB;
    const addNeighbor = (neighbor: number) => {
      if (neighbor < 0 || visited[neighbor]) return;
      const index = neighbor * 4;
      if (!match(index)) return;
      visited[neighbor] = 1;
      pixels[index] = fillR;
      pixels[index + 1] = fillG;
      pixels[index + 2] = fillB;
      stack[stackSize++] = neighbor;
    };
    while (stackSize > 0) {
      const pixel = stack[--stackSize];
      addNeighbor(pixel % width > 0 ? pixel - 1 : -1);
      addNeighbor(pixel % width < width - 1 ? pixel + 1 : -1);
      addNeighbor(pixel >= width ? pixel - width : -1);
      addNeighbor(pixel < width * (height - 1) ? pixel + width : -1);
    }
    context.putImageData(image, 0, 0);
  };

  const redrawAll = (context: CanvasRenderingContext2D, list: Stroke[]) => {
    context.clearRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT);
    for (const stroke of list) drawSegment(context, stroke, 0, false);
    presentDrawing();
  };

  useEffect(() => {
    const context = drawingContext();
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
      const drawingCanvas = drawingCanvasRef.current;
      if (!drawingCanvas) return;
      if (drawingCanvas.width !== DRAWING_WIDTH || drawingCanvas.height !== DRAWING_HEIGHT) {
        drawingCanvas.width = DRAWING_WIDTH;
        drawingCanvas.height = DRAWING_HEIGHT;
        const context = drawingCanvas.getContext('2d');
        if (context) redrawAll(context, prevStrokesRef.current);
      } else {
        presentDrawing();
      }
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

  const beginStroke = (point: Point, strokeTool: 'brush' | 'erase') => {
    const stroke: Stroke = {
      id: uuid(),
      points: [point],
      color,
      width: strokeTool === 'erase' ? eraserSize : brushSize,
      ...(strokeTool === 'erase' ? { tool: 'erase' as const } : {}),
    };
    activeStroke.current = stroke;
    sentCountRef.current = 0;
    lastEmitRef.current = Date.now();
    onChunk?.(stroke);
    sentCountRef.current = 1;
    const context = drawingContext();
    if (context) drawSegment(context, stroke, 0);
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (tool === 'fill') {
      const fill: Stroke = { id: uuid(), points: [point], color, width: 1, tool: 'fill' };
      onChunk?.(fill);
      const context = drawingContext();
      if (context) fillRegion(context, point, color);
      presentDrawing();
      return;
    }
    if (erasing) {
      beginStroke(point, 'erase');
      return;
    }
    beginStroke(point, 'brush');
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const stroke = activeStroke.current;
    if (!stroke) return;
    const prevLength = stroke.points.length;
    const point = pointFromEvent(event);
    if (prevLength >= MAX_POINTS_PER_STROKE - 1) {
      const pending = stroke.points.slice(sentCountRef.current);
      if (pending.length) onChunk?.({ ...stroke, points: pending });
      const nextStroke: Stroke = {
        ...stroke,
        id: uuid(),
        points: [stroke.points[prevLength - 1], point],
      };
      activeStroke.current = nextStroke;
      sentCountRef.current = 0;
      onChunk?.(nextStroke);
      sentCountRef.current = nextStroke.points.length;
      const context = drawingContext();
      if (context) drawSegment(context, nextStroke, 0);
      return;
    }
    stroke.points.push(point);
    const context = drawingContext();
    if (context) drawSegment(context, stroke, prevLength);
    const now = Date.now();
    if (now - lastEmitRef.current >= 45) {
      const pending = stroke.points.slice(sentCountRef.current);
      if (pending.length) {
        onChunk?.({ ...stroke, points: pending });
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
      if (pending.length) onChunk?.({ ...stroke, points: pending });
    }
    activeStroke.current = null;
    sentCountRef.current = 0;
  };

  return (
    <div className="board-wrap">
      <canvas
        ref={canvasRef}
        className={interactive ? `drawing-canvas interactive${erasing ? ' erasing' : ''}${tool === 'fill' ? ' filling' : ''}` : 'drawing-canvas'}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        aria-label="Bảng vẽ trực tiếp"
      />
      <canvas ref={drawingCanvasRef} width={DRAWING_WIDTH} height={DRAWING_HEIGHT} hidden aria-hidden="true" />
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
            <label className="custom-color" title="Chọn màu riêng">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Chọn màu riêng" />
            </label>
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
            <button
              type="button"
              className={tool === 'fill' ? 'tool-button active' : 'tool-button'}
              aria-pressed={tool === 'fill'}
              aria-label="Tô vùng kín"
              title="Tô vùng kín"
              onClick={() => setTool('fill')}
            >
              ▧
            </button>
          </div>
          {tool !== 'fill' && (
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
          )}
          <div className="tool-group">
            <button type="button" className="tool-button undo-button" onClick={() => onUndo?.()} aria-label="Hoàn tác thao tác cuối" title="Hoàn tác thao tác cuối">↶</button>
            <button type="button" className="tool-button danger" onClick={() => onClear?.()} aria-label="Xóa bảng vẽ" title="Xóa bảng vẽ">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
