import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, RefreshCw, ChevronLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { Header } from '../components/Header';
import { ImageUploader } from '../components/ImageUploader';
import { TextEditor } from '../components/TextEditor';
import { detectText, type TextBlock } from '../utils/ocr';
import { translateBatch } from '../utils/translate';
import { generateMaskFromBoxes, inpaintCanvas } from '../utils/inpaint';

const DRAFT_STORAGE_KEY = 'manga_translate_express_draft';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function FastTranslatePage() {
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [textBlocks, setTextBlocks] = useState<TextBlock[][]>([]);
  const [cleanedCanvases, setCleanedCanvases] = useState<(HTMLCanvasElement | null)[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [mode, setMode] = useState<'upload' | 'editor'>('upload');

  // Load draft if exists
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;

        const draft = JSON.parse(raw);
        if (draft.images?.length) {
          const restoredImages = await Promise.all(
            draft.images.map(async (item: any) => {
              const blob = await fetch(item.dataUrl).then((res) => res.blob());
              const file = new File([blob], item.name, { type: item.type });
              return { file, url: item.dataUrl };
            })
          );
          setImages(restoredImages);
          if (draft.textBlocks?.length && draft.mode === 'editor') {
             setTextBlocks(draft.textBlocks);
             setMode('editor');
             if (draft.cleanedCanvases?.length) {
               const restoredCanvases = await Promise.all(
                 draft.cleanedCanvases.map(async (item: any) => (item ? dataUrlToCanvas(item) : null))
               );
               setCleanedCanvases(restoredCanvases);
             }
          }
        }
      } catch (error) {
        console.error('Failed to load draft', error);
      }
    };
    void loadDraft();
  }, []);

  // Save draft
  useEffect(() => {
    const saveDraft = async () => {
      if (!images.length && mode === 'upload') {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      const payload = {
        mode,
        textBlocks,
        images: await Promise.all(
          images.map(async (img) => ({
            name: img.file.name,
            type: img.file.type,
            size: img.file.size,
            dataUrl: await fileToDataUrl(img.file),
          }))
        ),
        cleanedCanvases: await Promise.all(
          cleanedCanvases.map(async (c) => (c ? c.toDataURL('image/png') : null))
        ),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    };
    void saveDraft();
  }, [images, textBlocks, cleanedCanvases, mode]);

  const handleTranslate = async () => {
    if (!images.length) {
      toast.error('กรุณาอัปโหลดภาพก่อน');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressText('กำลังเตรียมระบบ...');
    const toastId = toast.loading('AI กำลังแปลภาษาให้คุณ...');
    const nextTextBlocks: TextBlock[][] = [];
    const nextCleanedCanvases: (HTMLCanvasElement | null)[] = [];

    try {
      for (let pageIdx = 0; pageIdx < images.length; pageIdx++) {
        const image = images[pageIdx];
        const pageLabel = `หน้า ${pageIdx + 1}/${images.length}`;
        
        // 1. OCR
        setProgressText(`${pageLabel}: กำลังดึงข้อความ (OCR)...`);
        const blocks = await detectText(image.url, 'auto', () => undefined);
        
        if (blocks.length > 0) {
          // 2. Clean Image (Inpaint)
          setProgressText(`${pageLabel}: กำลังลบข้อความเดิม...`);
          const sourceCanvas = document.createElement('canvas');
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              sourceCanvas.width = img.width;
              sourceCanvas.height = img.height;
              const ctx = sourceCanvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas context unavailable'));
              ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image for cleaning'));
            img.src = image.url;
          });

          const mask = generateMaskFromBoxes(sourceCanvas, blocks.map((b) => b.bbox), 6);
          const cleaned = inpaintCanvas(sourceCanvas, mask);
          nextCleanedCanvases[pageIdx] = cleaned;

          // 3. Translate
          setProgressText(`${pageLabel}: กำลังแปลภาษา...`);
          const translated = await translateBatch(
            blocks.map((b) => b.text),
            'auto',
            'th' // Target Thai
          );

          nextTextBlocks[pageIdx] = blocks.map((block, idx) => ({
            ...block,
            translatedText: translated[idx] || block.text,
          }));
        } else {
          // No text found on this page — keep the original image as-is
          console.warn(`Page ${pageIdx + 1}: no text blocks detected, skipping`);
          nextTextBlocks[pageIdx] = [];
          nextCleanedCanvases[pageIdx] = null;
        }

        setProgress(Math.round(((pageIdx + 1) / images.length) * 100));
      }

      setTextBlocks(nextTextBlocks);
      setCleanedCanvases(nextCleanedCanvases);
      setMode('editor');
      toast.success('แปลเสร็จสิ้น! คุณสามารถปรับแต่งข้อความได้เลย', { id: toastId });
    } catch (err: any) {
      console.error('Translation error:', err);
      toast.error('เกิดข้อผิดพลาดในการแปล: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImages([]);
    setTextBlocks([]);
    setCleanedCanvases([]);
    setMode('upload');
    setActivePageIndex(0);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20 selection:bg-primary/30 selection:text-white">
      <Toaster position="bottom-right" toastOptions={{ className: 'glass text-foreground', style: { background: '#1c1c22', color: '#fff', border: '1px solid #27272a' } }} />
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {mode === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                  โยนไฟล์ภาพ <span className="gradient-text">แปลทันที</span>
                </h1>
                <p className="text-lg text-muted">
                  ระบบ AI จะตรวจจับภาษาต้นฉบับ คลีนภาพ และแปลให้คุณอัตโนมัติในคลิกเดียว
                </p>
              </div>

              <div className="glass-card rounded-3xl p-6 sm:p-10 shadow-2xl shadow-primary/5">
                <ImageUploader
                  images={images}
                  onImagesChange={setImages}
                  maxFiles={50}
                />

                {images.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 pt-8 border-t border-border flex flex-col items-center"
                  >
                    <button
                      onClick={handleTranslate}
                      disabled={isProcessing}
                      className="group relative inline-flex items-center justify-center gap-3 w-full sm:w-auto px-12 py-5 rounded-full bg-gradient-to-r from-primary via-accent-purple to-accent-cyan text-white font-bold text-xl shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      {isProcessing ? (
                        <>
                          <Loader2 size={24} className="animate-spin" />
                          กำลังแปลภาษา... {progress}%
                        </>
                      ) : (
                        <>
                          <Sparkles size={24} />
                          แปลเลย! (1-Click Translate)
                        </>
                      )}
                    </button>
                    
                    {isProcessing && (
                      <div className="w-full max-w-md mt-6 space-y-2">
                         <div className="h-3 overflow-hidden rounded-full bg-surface/50 border border-border">
                           <motion.div
                             className="h-full rounded-full bg-gradient-to-r from-primary via-accent-purple to-accent-cyan"
                             initial={{ width: 0 }}
                             animate={{ width: `${progress}%` }}
                             transition={{ duration: 0.3 }}
                           />
                         </div>
                         <p className="text-center text-xs text-muted">{progressText || 'ระบบกำลังทำงาน กรุณารอสักครู่...'}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setMode('upload')}
                    className="p-2 rounded-xl bg-surface border border-border hover:bg-white/5 transition-colors text-muted hover:text-foreground"
                    title="กลับไปหน้าอัปโหลด"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                      <Sparkles size={20} className="text-primary" />
                      ตกแต่งข้อความ
                    </h1>
                    <p className="text-sm text-muted">คลิกที่ข้อความเพื่อแก้ไข ปรับขนาด หรือเปลี่ยนฟอนต์</p>
                  </div>
                </div>
                
                <button
                  onClick={handleReset}
                  className="mt-4 sm:mt-0 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <RefreshCw size={14} /> เริ่มใหม่ทั้งหมด
                </button>
              </div>

              <TextEditor
                images={images}
                cleanedCanvases={cleanedCanvases}
                textBlocks={textBlocks}
                activePageIndex={activePageIndex}
                onActivePageChange={setActivePageIndex}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
