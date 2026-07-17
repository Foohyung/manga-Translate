import { useState, useRef, useEffect, useCallback } from 'react';
import { Eraser, Undo2, Paintbrush, Wand2, ZoomIn, SquareDashed, PipetteIcon } from 'lucide-react';
import { inpaintCanvas, generateMaskFromBoxes } from '../utils/inpaint';
import type { TextBlock } from '../utils/ocr';

interface ImageCleanerProps {
  images: { file: File; url: string }[];
  textBlocks: TextBlock[][];
  cleanedCanvases: (HTMLCanvasElement | null)[];
  onCleanedCanvasesChange: (canvases: (HTMLCanvasElement | null)[]) => void;
  activePageIndex: number;
  onActivePageChange: (index: number) => void;
}

export function ImageCleaner({
  images,
  textBlocks,
  cleanedCanvases,
  onCleanedCanvasesChange,
  activePageIndex,
  onActivePageChange,
}: ImageCleanerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<'brush' | 'fill' | 'picker'>('brush');
  const [fillMode, setFillMode] = useState<'mask' | 'color'>('mask');
  const [paintColor, setPaintColor] = useState('#22d3ee');

  const loadImage = useCallback(() => {
    if (!canvasRef.current || !images[activePageIndex]) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setImgDimensions({ w: img.width, h: img.height });

      // If already cleaned, show cleaned version
      if (cleanedCanvases[activePageIndex]) {
        ctx.drawImage(cleanedCanvases[activePageIndex]!, 0, 0);
      } else {
        ctx.drawImage(img, 0, 0);
      }

      // Initialize mask canvas
      const mask = document.createElement('canvas');
      mask.width = img.width;
      mask.height = img.height;
      const maskCtx = mask.getContext('2d')!;
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, mask.width, mask.height);
      maskCanvasRef.current = mask;
    };
    img.src = images[activePageIndex].url;
  }, [images, activePageIndex, cleanedCanvases]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawOnMask = (x: number, y: number) => {
    if (!maskCanvasRef.current || !canvasRef.current) return;
    const maskCtx = maskCanvasRef.current.getContext('2d')!;
    const ctx = canvasRef.current.getContext('2d')!;

    const rect = canvasRef.current.getBoundingClientRect();
    const scale = canvasRef.current.width / rect.width;
    const radius = Math.max(1, Math.round(brushSize * scale));

    maskCtx.save();
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = fillMode === 'color' ? 'white' : 'white';
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();

    ctx.fillStyle = fillMode === 'color' ? paintColor : 'rgba(236, 72, 153, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, Math.round(brushSize * scale)), 0, Math.PI * 2);
    ctx.fill();
  };

  const pickColor = (x: number, y: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = `#${[imageData[0], imageData[1], imageData[2]]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')}`;
    setPaintColor(hex);
    setTool('brush');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'picker') {
      const { x, y } = getCanvasCoords(e);
      pickColor(x, y);
      return;
    }

    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    drawOnMask(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    drawOnMask(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const autoClean = async () => {
    if (!canvasRef.current || !images[activePageIndex]) return;
    setProcessing(true);

    const sourceCanvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve) => {
      img.onload = () => {
        sourceCanvas.width = img.width;
        sourceCanvas.height = img.height;
        const ctx = sourceCanvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.src = images[activePageIndex].url;
    });

    const boxes = (textBlocks[activePageIndex] || []).map((b) => b.bbox);
    const mask = generateMaskFromBoxes(sourceCanvas, boxes, 8);
    maskCanvasRef.current = mask;

    const cleaned = inpaintCanvas(sourceCanvas, mask);
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.drawImage(cleaned, 0, 0);

    const updated = [...cleanedCanvases];
    updated[activePageIndex] = cleaned;
    onCleanedCanvasesChange(updated);

    setProcessing(false);
  };

  const applyBrushClean = () => {
    if (!canvasRef.current || !maskCanvasRef.current) return;
    setProcessing(true);

    const sourceCanvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const ctx = sourceCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const combinedMask = document.createElement('canvas');
      combinedMask.width = sourceCanvas.width;
      combinedMask.height = sourceCanvas.height;
      const combinedCtx = combinedMask.getContext('2d')!;

      combinedCtx.fillStyle = 'black';
      combinedCtx.fillRect(0, 0, combinedMask.width, combinedMask.height);

      try {
        combinedCtx.drawImage(maskCanvasRef.current!, 0, 0, combinedMask.width, combinedMask.height);
      } catch {
        const m = maskCanvasRef.current!;
        combinedCtx.drawImage(m, 0, 0, m.width, m.height, 0, 0, combinedMask.width, combinedMask.height);
      }

      const boxes = (textBlocks[activePageIndex] || []).map((b) => b.bbox);
      if (boxes.length) {
        const ocrMask = generateMaskFromBoxes(sourceCanvas, boxes, 8);
        combinedCtx.drawImage(ocrMask, 0, 0);
      }

      const cleaned = inpaintCanvas(sourceCanvas, combinedMask);
      const mainCtx = canvasRef.current!.getContext('2d')!;
      mainCtx.drawImage(cleaned, 0, 0);

      const updated = [...cleanedCanvases];
      updated[activePageIndex] = cleaned;
      onCleanedCanvasesChange(updated);
      setProcessing(false);
    };
    img.src = images[activePageIndex].url;
  };

  const resetPage = () => {
    const updated = [...cleanedCanvases];
    updated[activePageIndex] = null;
    onCleanedCanvasesChange(updated);
    loadImage();
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={autoClean}
          disabled={processing || !textBlocks[activePageIndex]?.length}
          className="btn-gradient px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Wand2 size={16} />
          )}
          คลีนอัตโนมัติ (จาก OCR)
        </button>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2">
          <Paintbrush size={14} className="text-muted" />
          <span className="text-xs text-muted">แปรง:</span>
          <input
            type="range"
            min="5"
            max="60"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-foreground w-6">{brushSize}</span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-2 py-2">
          <button
            onClick={() => setTool('brush')}
            className={`rounded-lg p-2 ${tool === 'brush' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}
          >
            <Paintbrush size={14} />
          </button>
          <button
            onClick={() => setTool('picker')}
            className={`rounded-lg p-2 ${tool === 'picker' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}
          >
            <PipetteIcon size={14} />
          </button>
          <button
            onClick={() => setTool('fill')}
            className={`rounded-lg p-2 ${tool === 'fill' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}
          >
            <SquareDashed size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-2 py-2">
          <input
            type="color"
            value={paintColor}
            onChange={(e) => setPaintColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
          />
          <span className="text-xs text-muted">สีที่ใช้</span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-2 py-2">
          <button
            onClick={() => setFillMode('mask')}
            className={`rounded-lg px-2 py-1 text-xs ${fillMode === 'mask' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}
          >
            ปิดบังข้อความ
          </button>
          <button
            onClick={() => setFillMode('color')}
            className={`rounded-lg px-2 py-1 text-xs ${fillMode === 'color' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}
          >
            ทาสีทับ
          </button>
        </div>

        <button
          onClick={applyBrushClean}
          disabled={processing}
          className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
        >
          <Eraser size={14} />
          ใช้กับบริเวณที่ทา
        </button>

        <button
          onClick={resetPage}
          className="px-4 py-2 rounded-xl border border-border text-muted text-sm hover:text-foreground hover:bg-white/5 transition-colors flex items-center gap-1.5"
        >
          <Undo2 size={14} />
          รีเซ็ต
        </button>

        <button
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          className="px-4 py-2 rounded-xl border border-border text-muted text-sm hover:text-foreground hover:bg-white/5 transition-colors flex items-center gap-1.5"
        >
          <ZoomIn size={14} />
          ดูภาพเดิม
        </button>

        <button
          onClick={() => {
            if (!canvasRef.current || !images[activePageIndex]) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }}
          className="px-4 py-2 rounded-xl border border-border text-muted text-sm hover:text-foreground hover:bg-white/5 transition-colors flex items-center gap-1.5"
        >
          <SquareDashed size={14} />
          ปิดบังทั้งหมด
        </button>
      </div>

      {/* Canvas area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-foreground">
            {showBefore ? '📷 ภาพต้นฉบับ' : '🧹 ทาบริเวณที่ต้องการลบ'}
          </h3>
          <div className="rounded-xl border border-border overflow-hidden bg-surface relative">
            {showBefore ? (
              <img
                src={images[activePageIndex]?.url}
                alt="Original"
                className="w-full h-auto"
              />
            ) : (
              <canvas
                ref={canvasRef}
                className={`w-full h-auto ${tool === 'brush' ? 'brush-cursor' : 'cursor-cell'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            )}
            {processing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm text-white font-medium">
                    กำลังคลีนภาพ...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page list */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">เลือกหน้า</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => onActivePageChange(idx)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                  idx === activePageIndex
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 border border-border">
                  <img
                    src={img.url}
                    alt={`P${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">
                    หน้า {idx + 1}
                  </p>
                  <p className="text-[10px] text-muted">
                    {cleanedCanvases[idx] ? '✅ คลีนแล้ว' : '⬜ ยังไม่คลีน'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
