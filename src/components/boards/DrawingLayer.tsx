import { useRef, useState, useEffect, useCallback } from "react";

interface DrawingLayerProps {
  isActive: boolean;
  offset: { x: number; y: number };
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export function DrawingLayer({ isActive, offset, onClose }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and resize
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });

    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, strokeColor, strokeWidth);
    }
  }, [strokes, currentStroke, strokeColor, strokeWidth]);

  const drawStroke = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    width: number
  ) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  };

  const getCanvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // Mouse handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsDrawing(true);
    const point = getCanvasPoint(e.clientX, e.clientY);
    setCurrentStroke([point]);
  }, [getCanvasPoint]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.stopPropagation();
    const point = getCanvasPoint(e.clientX, e.clientY);
    setCurrentStroke((prev) => [...prev, point]);
  }, [isDrawing, getCanvasPoint]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      setStrokes((prev) => [
        ...prev,
        { points: currentStroke, color: strokeColor, width: strokeWidth },
      ]);
    }
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokeColor, strokeWidth]);

  // Touch handlers for mobile drawing
  const handleCanvasTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const touch = e.touches[0];
    const point = getCanvasPoint(touch.clientX, touch.clientY);
    setCurrentStroke([point]);
  }, [getCanvasPoint]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDrawing || e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const point = getCanvasPoint(touch.clientX, touch.clientY);
    setCurrentStroke((prev) => [...prev, point]);
  }, [isDrawing, getCanvasPoint]);

  const handleCanvasTouchEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      setStrokes((prev) => [
        ...prev,
        { points: currentStroke, color: strokeColor, width: strokeWidth },
      ]);
    }
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokeColor, strokeWidth]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    setStrokeColor(color);
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStrokeWidth(Number(e.target.value));
  }, []);

  const handleDone = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0" style={{ zIndex: 100 }}>
      {/* Toolbar - positioned above canvas with proper z-index and touch support */}
      <div 
        className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#2a2a2a] rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-3 shadow-xl border border-white/10 max-w-[95vw]"
        style={{ zIndex: 110 }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="text-white/70 text-xs sm:text-sm hidden sm:inline">Draw</span>
        
        {/* Color picker */}
        <div className="flex gap-1">
          {["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b"].map((color) => (
            <button
              key={color}
              type="button"
              className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 transition-transform active:scale-95 ${
                strokeColor === color ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleColorSelect(color);
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleColorSelect(color);
              }}
            />
          ))}
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-white/50 text-xs hidden sm:inline">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={handleSliderChange}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-12 sm:w-16 accent-primary cursor-pointer"
          />
          <span className="text-white/50 text-xs w-4">{strokeWidth}</span>
        </div>

        <button
          type="button"
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClear();
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleClear();
          }}
          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-white/70 hover:text-white active:bg-white/20 hover:bg-white/10 rounded transition-colors min-h-[36px]"
        >
          Clear
        </button>

        <button
          type="button"
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDone();
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleDone();
          }}
          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-primary text-primary-foreground rounded active:bg-primary/80 hover:bg-primary/90 transition-colors min-h-[36px]"
        >
          Done
        </button>
      </div>

      {/* Canvas - for drawing only */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{ zIndex: 105, touchAction: 'none' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onTouchCancel={handleCanvasTouchEnd}
      />
    </div>
  );
}
