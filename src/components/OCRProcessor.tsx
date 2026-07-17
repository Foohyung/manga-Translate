import { useState, useRef, useEffect } from 'react';
import { detectText, type TextBlock, type OcrLanguage, LANGUAGE_OPTIONS } from '../utils/ocr';
import { Scan, Loader2, Edit3, Check, RotateCcw } from 'lucide-react';

interface OCRProcessorProps {
  images: { file: File; url: string }[];
  ocrLang: OcrLanguage;
  onLangChange: (lang: OcrLanguage) => void;
  textBlocks: TextBlock[][];
  onTextBlocksChange: (blocks: TextBlock[][]) => void;
  activePageIndex: number;
  onActivePageChange: (index: number) => void;
}

export function OCRProcessor({
  images,
  ocrLang,
  onLangChange,
  textBlocks,
  onTextBlocksChange,
  activePageIndex,
  onActivePageChange,
}: OCRProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw image with bounding boxes
  useEffect(() => {
    if (!canvasRef.current || images.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      const blocks = textBlocks[activePageIndex] || [];
      blocks.forEach((block) => {
        const { x0, y0, x1, y1 } = block.bbox;
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

        // Label background
        ctx.fillStyle = 'rgba(236, 72, 153, 0.8)';
        const labelH = 18;
        ctx.fillRect(x0, y0 - labelH, x1 - x0, labelH);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(
          `${Math.round(block.confidence)}%`,
          x0 + 4,
          y0 - 5
        );
      });
    };
    img.src = images[activePageIndex].url;
  }, [images, activePageIndex, textBlocks]);

  const runOCR = async () => {
    setProcessing(true);
    const allBlocks: TextBlock[][] = [];

    for (let i = 0; i < images.length; i++) {
      setCurrentPage(i);
      setProgress(0);
      onActivePageChange(i);

      try {
        const blocks = await detectText(
          images[i].url,
          ocrLang,
          (p) => setProgress(p)
        );
        allBlocks.push(blocks);
      } catch (err) {
        console.error(`OCR error on page ${i + 1}:`, err);
        allBlocks.push([]);
      }
    }

    onTextBlocksChange(allBlocks);
    onActivePageChange(0);
    setProcessing(false);
  };

  const updateBlockText = (blockId: string, newText: string) => {
    const updated = [...textBlocks];
    const pageBlocks = [...(updated[activePageIndex] || [])];
    const blockIdx = pageBlocks.findIndex((b) => b.id === blockId);
    if (blockIdx >= 0) {
      pageBlocks[blockIdx] = { ...pageBlocks[blockIdx], text: newText };
      updated[activePageIndex] = pageBlocks;
      onTextBlocksChange(updated);
    }
  };

  const blocks = textBlocks[activePageIndex] || [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-muted mb-1.5 font-medium">
            ภาษาต้นฉบับ
          </label>
          <select
            value={ocrLang}
            onChange={(e) => onLangChange(e.target.value as OcrLanguage)}
            disabled={processing}
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.flag} {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-5">
          <button
            onClick={runOCR}
            disabled={processing || images.length === 0}
            className="btn-gradient px-6 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังประมวลผล... ({currentPage + 1}/{images.length})
              </>
            ) : (
              <>
                <Scan size={16} />
                เริ่มดึงข้อความ
              </>
            )}
          </button>
          {textBlocks.length > 0 && (
            <button
              onClick={() => onTextBlocksChange([])}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-foreground hover:bg-white/5 text-sm transition-colors"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {processing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>กำลังประมวลผลหน้า {currentPage + 1} / {images.length}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full step-line transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canvas preview */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">ตัวอย่างภาพ</h3>
          <div className="rounded-xl border border-border overflow-hidden bg-surface">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
            />
          </div>
          {/* Page selector */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => onActivePageChange(idx)}
                  className={`shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activePageIndex
                      ? 'border-primary shadow-lg shadow-primary/20'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`P${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text blocks list */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">
            ข้อความที่พบ ({blocks.length} บล็อก)
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {blocks.length === 0 ? (
              <div className="text-center py-12 text-muted">
                <Scan size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {textBlocks.length > 0
                    ? 'ไม่พบข้อความในหน้านี้'
                    : 'กดปุ่ม "เริ่มดึงข้อความ" เพื่อเริ่ม OCR'}
                </p>
              </div>
            ) : (
              blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className="glass-card rounded-xl p-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-primary font-bold shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1">
                      {editingBlockId === block.id ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={block.text}
                            onChange={(e) =>
                              updateBlockText(block.id, e.target.value)
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && setEditingBlockId(null)
                            }
                            className="flex-1 px-2 py-1 bg-background border border-primary/30 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <button
                            onClick={() => setEditingBlockId(null)}
                            className="p-1 text-primary"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">
                          {block.text}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted">
                        {Math.round(block.confidence)}%
                      </span>
                      <button
                        onClick={() => setEditingBlockId(block.id)}
                        className="p-1 text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
