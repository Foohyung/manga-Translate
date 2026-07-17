import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Type, Bold, Italic, Type as TypeIcon, Image as ImageIcon, Trash2, Settings2, Check } from 'lucide-react';
import { exportCanvasAsPng, exportAsZip, renderTextOverlays, type TextOverlay } from '../utils/export';
import type { TextBlock } from '../utils/ocr';
import toast from 'react-hot-toast';

interface TextEditorProps {
  images: { file: File; url: string }[];
  cleanedCanvases: (HTMLCanvasElement | null)[];
  textBlocks: TextBlock[][];
  activePageIndex: number;
  onActivePageChange: (index: number) => void;
}

export function TextEditor({
  images,
  cleanedCanvases,
  textBlocks,
  activePageIndex,
  onActivePageChange,
}: TextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<Record<number, TextOverlay[]>>({});
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  const buildOverlayFromBlock = (
    block: TextBlock,
    index: number,
    pageBlocks: TextBlock[],
    pageWidth: number,
    pageHeight: number
  ): TextOverlay => {
    const boxWidth = Math.max(24, block.bbox.x1 - block.bbox.x0);
    const boxHeight = Math.max(16, block.bbox.y1 - block.bbox.y0);
    const x = Math.max(4, block.bbox.x0 + (boxWidth * 0.05)); // Slight padding
    const y = Math.max(4, block.bbox.y0 + (boxHeight * 0.1)); // Slight padding
    
    // Auto scale font size based on box height, but keep it within reasonable bounds
    // For manga, text is usually around 14-22px
    const fontSize = Math.max(12, Math.min(24, Math.round(boxHeight * 0.2)));
    const maxWidth = Math.max(80, Math.min(boxWidth * 0.9, pageWidth - x - 8));

    return {
      id: block.id,
      text: block.translatedText || block.text,
      x,
      y,
      fontSize,
      fontFamily: 'Noto Sans Thai',
      color: '#111111',
      bold: false,
      italic: false,
      strokeColor: '#ffffff',
      strokeWidth: 3,
      maxWidth,
      lineHeight: Math.round(fontSize * 1.2),
      rotation: block.rotation || 0,
    } as TextOverlay;
  };

  // Initialize overlays from text blocks when page changes (if not already set)
  useEffect(() => {
    if (!overlays[activePageIndex] && textBlocks[activePageIndex]) {
      const pageBlocks = textBlocks[activePageIndex];
      const initialOverlays: TextOverlay[] = pageBlocks
        .filter((b) => b.translatedText || b.text)
        .map((b, idx) => buildOverlayFromBlock(b, idx, pageBlocks, imgDimensions.w || 1200, imgDimensions.h || 1600));
      setOverlays((prev) => ({ ...prev, [activePageIndex]: initialOverlays }));
    }
  }, [activePageIndex, textBlocks, overlays, imgDimensions.w, imgDimensions.h]);

  // Load image dimensions
  useEffect(() => {
    if (!images[activePageIndex]) return;
    const img = new Image();
    img.onload = () => {
      setImgDimensions({ w: img.width, h: img.height });
    };
    img.src = images[activePageIndex].url;
  }, [images, activePageIndex]);

  const currentOverlays = overlays[activePageIndex] || [];
  const selectedOverlay = currentOverlays.find((o) => o.id === selectedOverlayId);

  const autoPlaceText = () => {
    if (!textBlocks[activePageIndex]?.length) return;

    setIsAutoPlacing(true);
    const pageBlocks = textBlocks[activePageIndex];
    const generated = pageBlocks
      .filter((block) => block.translatedText || block.text)
      .map((block, idx) => buildOverlayFromBlock(block, idx, pageBlocks, imgDimensions.w || 1200, imgDimensions.h || 1600));

    setOverlays((prev) => ({
      ...prev,
      [activePageIndex]: generated,
    }));

    setSelectedOverlayId(generated[0]?.id ?? null);
    setIsAutoPlacing(false);
  };

  const addText = () => {
    const newOverlay: TextOverlay = {
      id: `custom-${Date.now()}`,
      text: 'ข้อความใหม่',
      x: imgDimensions.w / 2 - 50 || 100,
      y: imgDimensions.h / 2 - 20 || 100,
      fontSize: 20,
      fontFamily: 'Noto Sans Thai',
      color: '#000000',
      bold: false,
      italic: false,
      strokeColor: '#ffffff',
      strokeWidth: 3,
    };
    setOverlays((prev) => ({
      ...prev,
      [activePageIndex]: [...(prev[activePageIndex] || []), newOverlay],
    }));
    setSelectedOverlayId(newOverlay.id);
  };

  const updateOverlay = (id: string, changes: Partial<TextOverlay>) => {
    setOverlays((prev) => ({
      ...prev,
      [activePageIndex]: (prev[activePageIndex] || []).map((o) =>
        o.id === id ? { ...o, ...changes } : o
      ),
    }));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => ({
      ...prev,
      [activePageIndex]: (prev[activePageIndex] || []).filter((o) => o.id !== id),
    }));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  const getBaseCanvas = async (pageIdx: number): Promise<HTMLCanvasElement> => {
    if (cleanedCanvases[pageIdx]) return cleanedCanvases[pageIdx]!;
    
    // Fallback to original image if not cleaned
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = images[pageIdx].url;
    });
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas;
  };

  const handleExportPage = async () => {
    setIsExporting(true);
    try {
      const baseCanvas = await getBaseCanvas(activePageIndex);
      const resultCanvas = renderTextOverlays(baseCanvas, currentOverlays);
      exportCanvasAsPng(resultCanvas, `page_${activePageIndex + 1}.png`);
      toast.success('ดาวน์โหลดหน้านี้สำเร็จ');
    } catch (e) {
      toast.error('ดาวน์โหลดล้มเหลว');
    }
    setIsExporting(false);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    const toastId = toast.loading('กำลังเตรียมไฟล์ ZIP...');
    try {
      const resultCanvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < images.length; i++) {
        const baseCanvas = await getBaseCanvas(i);
        const resultCanvas = renderTextOverlays(baseCanvas, overlays[i] || []);
        resultCanvases.push(resultCanvas);
      }
      await exportAsZip(resultCanvases, 'MangaTranslate_Export');
      toast.success('ดาวน์โหลด ZIP สำเร็จ', { id: toastId });
    } catch (e) {
      toast.error('ดาวน์โหลดล้มเหลว', { id: toastId });
    }
    setIsExporting(false);
  };

  // Calculate scaling between original image and displayed image
  const getScale = () => {
    if (!containerRef.current || !imgDimensions.w) return 1;
    return containerRef.current.clientWidth / imgDimensions.w;
  };

  const scale = getScale();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Editor Area (Left 3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TypeIcon size={16} className="text-primary" />
            จัดเรียงและปรับแต่งข้อความ
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={autoPlaceText}
              disabled={isAutoPlacing || !textBlocks[activePageIndex]?.length}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent-purple text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
            >
              <Type size={14} />
              {isAutoPlacing ? 'กำลังวาง...' : 'วางคำให้เลย'}
            </button>
            <button
              onClick={addText}
              className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
            >
              <Type size={14} />
              เพิ่มข้อความ
            </button>
          </div>
        </div>

        {/* Canvas / Image Container */}
        <div className="rounded-xl border border-border overflow-hidden bg-surface relative">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden"
            style={{ 
              aspectRatio: imgDimensions.w && imgDimensions.h ? `${imgDimensions.w}/${imgDimensions.h}` : 'auto' 
            }}
            onClick={() => setSelectedOverlayId(null)}
          >
            {/* Base Image (Cleaned or Original) */}
            {cleanedCanvases[activePageIndex] ? (
              <img
                src={cleanedCanvases[activePageIndex]!.toDataURL()}
                alt="Cleaned"
                className="w-full h-auto block select-none pointer-events-none"
              />
            ) : (
              <img
                src={images[activePageIndex]?.url}
                alt="Original"
                className="w-full h-auto block select-none pointer-events-none"
              />
            )}

            {/* Draggable Overlays */}
            {currentOverlays.map((overlay) => (
              <motion.div
                key={overlay.id}
                drag
                dragMomentum={false}
                initial={false}
                animate={{
                  x: overlay.x * scale,
                  y: overlay.y * scale,
                  rotate: overlay.rotation || 0,
                }}
                onDragEnd={(e, info) => {
                  updateOverlay(overlay.id, {
                    x: Math.round(overlay.x + info.offset.x / scale),
                    y: Math.round(overlay.y + info.offset.y / scale),
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOverlayId(overlay.id);
                }}
                className={`absolute top-0 left-0 cursor-move origin-top-left ${
                  selectedOverlayId === overlay.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-black rounded-sm z-10' : ''
                }`}
                style={{
                  color: overlay.color,
                  fontSize: `${overlay.fontSize * scale}px`,
                  fontFamily: overlay.fontFamily,
                  fontWeight: overlay.bold ? 'bold' : 'normal',
                  fontStyle: overlay.italic ? 'italic' : 'normal',
                  WebkitTextStroke: overlay.strokeWidth ? `${overlay.strokeWidth * scale}px ${overlay.strokeColor}` : 'none',
                  paintOrder: 'stroke fill',
                  lineHeight: 1.3,
                  whiteSpace: 'pre-wrap',
                  maxWidth: overlay.maxWidth ? `${overlay.maxWidth * scale}px` : 'none',
                }}
              >
                {/* We render the text twice: once for stroke (using WebkitTextStroke on parent), once for fill (inner span) to avoid stroke overlapping fill heavily in some browsers. But paintOrder stroke fill is better if supported. */}
                <span className="relative z-[1]">{overlay.text}</span>
              </motion.div>
            ))}
          </div>
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

      {/* Tools & Export Area (Right col) */}
      <div className="space-y-6">
        {/* Text Tools */}
        <div className="glass-card rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
            <Settings2 size={16} className="text-accent-cyan" />
            เครื่องมือปรับแต่ง
          </h3>

          {!selectedOverlay ? (
            <div className="text-center py-8 text-muted border border-dashed border-border rounded-lg">
              <p className="text-xs">คลิกที่ข้อความบนรูปเพื่อปรับแต่ง</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1 font-medium">ข้อความ</label>
                <textarea
                  value={selectedOverlay.text}
                  onChange={(e) => updateOverlay(selectedOverlay.id, { text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">ขนาดฟอนต์ ({selectedOverlay.fontSize}px)</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={selectedOverlay.fontSize}
                    onChange={(e) => updateOverlay(selectedOverlay.id, { fontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">แบบอักษร</label>
                  <select
                    value={selectedOverlay.fontFamily}
                    onChange={(e) => updateOverlay(selectedOverlay.id, { fontFamily: e.target.value })}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none"
                  >
                    <option value="Noto Sans Thai">Noto Sans (มาตรฐาน)</option>
                    <option value="Kanit">Kanit (ทันสมัย)</option>
                    <option value="Prompt">Prompt (เรียบหรู)</option>
                    <option value="Mitr">Mitr (อ่านง่าย/พาดหัว)</option>
                    <option value="Chakra Petch">Chakra Petch (ไซไฟ/แอคชั่น)</option>
                    <option value="Itim">Itim (ลายมือ/กวนๆ)</option>
                    <option value="Mali">Mali (น่ารัก/ความคิด)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">สีข้อความ</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selectedOverlay.color}
                      onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })}
                      className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={selectedOverlay.color}
                      onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1 bg-background border border-border rounded text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1 font-medium">สีขอบ (Stroke)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selectedOverlay.strokeColor}
                      onChange={(e) => updateOverlay(selectedOverlay.id, { strokeColor: e.target.value })}
                      className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                    />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={selectedOverlay.strokeWidth}
                      onChange={(e) => updateOverlay(selectedOverlay.id, { strokeWidth: Number(e.target.value) })}
                      className="flex-1 min-w-0 px-2 py-1 bg-background border border-border rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex gap-2">
                  <button
                    onClick={() => updateOverlay(selectedOverlay.id, { bold: !selectedOverlay.bold })}
                    className={`p-1.5 rounded ${selectedOverlay.bold ? 'bg-primary/20 text-primary' : 'bg-surface text-muted hover:text-foreground'}`}
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={() => updateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })}
                    className={`p-1.5 rounded ${selectedOverlay.italic ? 'bg-primary/20 text-primary' : 'bg-surface text-muted hover:text-foreground'}`}
                  >
                    <Italic size={14} />
                  </button>
                </div>
                <button
                  onClick={() => removeOverlay(selectedOverlay.id)}
                  className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleExportPage}
            disabled={isExporting}
            className="w-full px-5 py-3 rounded-xl border border-primary/50 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <ImageIcon size={18} />
            ดาวน์โหลดหน้านี้ (PNG)
          </button>
          
          <button
            onClick={handleExportAll}
            disabled={isExporting || images.length === 0}
            className="w-full btn-gradient px-5 py-4 rounded-xl text-white font-bold text-base shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={20} />
            ดาวน์โหลดทั้งหมด (ZIP)
          </button>
        </div>
      </div>
    </div>
  );
}
