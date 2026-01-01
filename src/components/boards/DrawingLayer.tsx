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

  const getCanvasPoint = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentStroke([point]);
  }, [getCanvasPoint]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.stopPropagation();
    const point = getCanvasPoint(e);
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

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setStrokes([]);
    setCurrentStroke([]);
  }, []);

  const handleColorClick = useCallback((e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    e.preventDefault();
    setStrokeColor(color);
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setStrokeWidth(Number(e.target.value));
  }, []);

  const handleDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  }, [onClose]);

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50">
      {/* Toolbar - positioned above canvas */}
      <div 
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#2a2a2a] rounded-lg px-4 py-2 flex items-center gap-3 shadow-xl border border-white/10 z-[60]"
        onMouseDown={handleToolbarMouseDown}
      >
        <span className="text-white/70 text-sm">Drawing Mode</span>
        
        {/* Color picker */}
        <div className="flex gap-1">
          {["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b"].map((color) => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                strokeColor === color ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              onClick={(e) => handleColorClick(e, color)}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ))}
        </div>

        {/* Stroke width */}
        <div 
          className="flex items-center gap-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="text-white/50 text-xs">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={handleSliderChange}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-16 accent-primary cursor-pointer"
          />
          <span className="text-white/50 text-xs w-4">{strokeWidth}</span>
        </div>

        <button
          type="button"
          onClick={handleClear}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-3 py-1 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={handleDone}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>

      {/* Canvas - for drawing only */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        style={{ zIndex: 55 }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      />
    </div>
  );
}
