import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { StepIndicator } from '../components/StepIndicator';
import { ImageUploader } from '../components/ImageUploader';
import { OCRProcessor } from '../components/OCRProcessor';
import { ImageCleaner } from '../components/ImageCleaner';
import { TranslationPanel } from '../components/TranslationPanel';
import { TextEditor } from '../components/TextEditor';
import { UploadCloud, Scan, Paintbrush, Languages, Type, Save, NotebookPen, Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { detectText, type OcrLanguage, type TextBlock } from '../utils/ocr';
import { translateBatch, type TranslateLanguage } from '../utils/translate';
import { generateMaskFromBoxes, inpaintCanvas } from '../utils/inpaint';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { label: 'อัปโหลดภาพ', icon: <UploadCloud size={18} /> },
  { label: 'ดึงข้อความ (OCR)', icon: <Scan size={18} /> },
  { label: 'คลีนภาพ', icon: <Paintbrush size={18} /> },
  { label: 'แปลภาษา', icon: <Languages size={18} /> },
  { label: 'จัดวาง & โหลด', icon: <Type size={18} /> },
];

const DRAFT_STORAGE_KEY = 'manga_translate_draft';

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

export function WorktablePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [ocrLang, setOcrLang] = useState<OcrLanguage>('jpn');
  const [textBlocks, setTextBlocks] = useState<TextBlock[][]>([]);
  const [cleanedCanvases, setCleanedCanvases] = useState<(HTMLCanvasElement | null)[]>([]);
  const [targetLang, setTargetLang] = useState<TranslateLanguage>('th');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) {
          setIsDraftLoaded(true);
          return;
        }

        const draft = JSON.parse(raw) as {
          currentStep?: number;
          ocrLang?: OcrLanguage;
          targetLang?: TranslateLanguage;
          activePageIndex?: number;
          textBlocks?: TextBlock[][];
          images?: Array<{ name: string; type: string; size: number; dataUrl: string }>;
          cleanedCanvases?: Array<string | null>;
        };

        if (draft.images?.length) {
          const restoredImages = await Promise.all(
            draft.images.map(async (item) => {
              const blob = await fetch(item.dataUrl).then((res) => res.blob());
              const file = new File([blob], item.name, { type: item.type });
              return { file, url: item.dataUrl };
            })
          );
          setImages(restoredImages);
        }

        setCurrentStep(Math.min(draft.currentStep || 0, STEPS.length - 1));
        setOcrLang(draft.ocrLang || 'jpn');
        setTargetLang(draft.targetLang || 'th');
        setActivePageIndex(Math.max(draft.activePageIndex || 0, 0));
        setTextBlocks(draft.textBlocks || []);

        if (draft.cleanedCanvases?.length) {
          const restoredCanvases = await Promise.all(
            draft.cleanedCanvases.map(async (item) => (item ? dataUrlToCanvas(item) : null))
          );
          setCleanedCanvases(restoredCanvases);
        }
      } catch (error) {
        console.error('Failed to load draft', error);
      } finally {
        setIsDraftLoaded(true);
      }
    };

    void loadDraft();
  }, []);

  useEffect(() => {
    setTextBlocks((prev) => {
      const next = [...prev];
      next.length = images.length;
      for (let i = 0; i < images.length; i++) {
        if (!next[i]) next[i] = [];
      }
      return next;
    });

    setCleanedCanvases((prev) => {
      const next = [...prev];
      next.length = images.length;
      for (let i = 0; i < images.length; i++) {
        if (next[i] === undefined) next[i] = null;
      }
      return next;
    });
  }, [images.length]);

  useEffect(() => {
    if (!isDraftLoaded) return;

    const persistDraft = async () => {
      if (!images.length && currentStep === 0 && textBlocks.length === 0) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      const payload = {
        currentStep,
        ocrLang,
        targetLang,
        activePageIndex,
        textBlocks,
        images: await Promise.all(
          images.map(async (image) => ({
            name: image.file.name,
            type: image.file.type,
            size: image.file.size,
            dataUrl: await fileToDataUrl(image.file),
          }))
        ),
        cleanedCanvases: await Promise.all(
          cleanedCanvases.map(async (canvas) => (canvas ? canvas.toDataURL('image/png') : null))
        ),
      };

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    };

    void persistDraft();
  }, [isDraftLoaded, images, currentStep, ocrLang, targetLang, activePageIndex, textBlocks, cleanedCanvases]);

  const nextStep = () => {
    if (currentStep === 0 && images.length === 0) {
      toast.error('กรุณาอัปโหลดรูปภาพก่อน');
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const saveToHistory = () => {
    try {
      const historyStr = localStorage.getItem('translation_history') || '[]';
      const history = JSON.parse(historyStr);

      const newEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        pagesCount: images.length,
        sourceLang: ocrLang,
        targetLang,
        previewText: textBlocks[0]?.[0]?.translatedText || textBlocks[0]?.[0]?.text || 'ยังไม่ได้ดึงข้อความ',
      };

      history.unshift(newEntry);
      localStorage.setItem('translation_history', JSON.stringify(history.slice(0, 10)));
      toast.success('บันทึกความคืบหน้าลงประวัติแล้ว', { icon: <Save size={16} className="text-primary" /> });
    } catch (error) {
      console.error(error);
    }
  };

  const runAutoPilot = async () => {
    if (!images.length) {
      toast.error('กรุณาอัปโหลดภาพก่อนใช้งาน AI');
      return;
    }

    setIsAutoRunning(true);
    setAutoProgress(0);
    const toastId = toast.loading('AI กำลังประมวลผลภาพให้คุณ...');
    const nextTextBlocks: TextBlock[][] = [];
    const nextCleanedCanvases: (HTMLCanvasElement | null)[] = [];

    for (let pageIdx = 0; pageIdx < images.length; pageIdx++) {
      const image = images[pageIdx];
      setActivePageIndex(pageIdx);

      const blocks = await detectText(image.url, ocrLang, () => undefined);
      nextTextBlocks[pageIdx] = blocks;

      if (blocks.length > 0) {
        const sourceCanvas = document.createElement('canvas');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            sourceCanvas.width = img.width;
            sourceCanvas.height = img.height;
            const ctx = sourceCanvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context unavailable'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
          img.src = image.url;
        });

        const mask = generateMaskFromBoxes(sourceCanvas, blocks.map((block) => block.bbox), 6);
        const cleaned = inpaintCanvas(sourceCanvas, mask);
        nextCleanedCanvases[pageIdx] = cleaned;

        const translated = await translateBatch(
          blocks.map((block) => block.text),
          ocrLang,
          targetLang
        );

        nextTextBlocks[pageIdx] = blocks.map((block, blockIdx) => ({
          ...block,
          translatedText: translated[blockIdx] || block.text,
        }));
      } else {
        nextCleanedCanvases[pageIdx] = null;
      }

      setAutoProgress(Math.round(((pageIdx + 1) / images.length) * 100));
    }

    setTextBlocks(nextTextBlocks);
    setCleanedCanvases(nextCleanedCanvases);
    setActivePageIndex(0);
    setCurrentStep(4);
    setIsAutoRunning(false);
    toast.success('AI ทำงานเสร็จแล้ว คุณสามารถจัดวางข้อความได้เลย', { id: toastId });
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <Toaster position="bottom-right" toastOptions={{ className: 'glass text-foreground', style: { background: '#1c1c22', color: '#fff', border: '1px solid #27272a' } }} />
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              โต๊ะทำงานแปล
              <span className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                ขั้นตอนที่ {currentStep + 1}/{STEPS.length}
              </span>
            </h1>
            <p className="text-sm text-muted mt-1">{STEPS[currentStep].label}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary flex items-center gap-2">
              <NotebookPen size={14} />
              บันทึกอัตโนมัติ
            </div>
            <button
              onClick={saveToHistory}
              className="px-4 py-2 rounded-xl bg-surface border border-border text-foreground text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Save size={16} className="text-primary" /> บันทึกงาน
            </button>
          </div>
        </div>

        <div className="mb-8 p-5 glass-card rounded-2xl hidden md:block">
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={(s) => setCurrentStep(s)}
          />
        </div>

        <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8 min-h-[60vh] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {currentStep === 0 && (
                <div className="max-w-4xl mx-auto">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold mb-2">อัปโหลดภาพที่ต้องการแปล</h2>
                    <p className="text-sm text-muted">รองรับไฟล์ PNG, JPG, WEBP แนะนำให้อัปทีละตอน</p>
                  </div>
                  <ImageUploader
                    images={images}
                    onImagesChange={setImages}
                    maxFiles={50}
                  />

                  {images.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent-purple/5 to-accent-cyan/5 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                            <Sparkles size={18} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">✨ ให้ AI ทำงานให้เลย</p>
                            <p className="text-xs text-muted mt-0.5">OCR → คลีนภาพ → แปลภาษา → จัดวาง ในขั้นตอนเดียว</p>
                          </div>
                        </div>
                        <button
                          onClick={runAutoPilot}
                          disabled={isAutoRunning}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent-purple px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {isAutoRunning ? (
                            <><Loader2 size={16} className="animate-spin" /> กำลังดำเนินการ...</>
                          ) : (
                            <><Sparkles size={16} /> เริ่ม AI Flow</>
                          )}
                        </button>
                      </div>

                      {isAutoRunning && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>กำลังดำเนินงานสำหรับภาพทั้งหมด ({images.length} หน้า)</span>
                            <span className="text-primary font-semibold">{autoProgress}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-primary via-accent-purple to-accent-cyan"
                              initial={{ width: 0 }}
                              animate={{ width: `${autoProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {currentStep === 1 && (
                <OCRProcessor
                  images={images}
                  ocrLang={ocrLang}
                  onLangChange={setOcrLang}
                  textBlocks={textBlocks}
                  onTextBlocksChange={setTextBlocks}
                  activePageIndex={activePageIndex}
                  onActivePageChange={setActivePageIndex}
                />
              )}

              {currentStep === 2 && (
                <ImageCleaner
                  images={images}
                  textBlocks={textBlocks}
                  cleanedCanvases={cleanedCanvases}
                  onCleanedCanvasesChange={setCleanedCanvases}
                  activePageIndex={activePageIndex}
                  onActivePageChange={setActivePageIndex}
                />
              )}

              {currentStep === 3 && (
                <TranslationPanel
                  textBlocks={textBlocks}
                  onTextBlocksChange={setTextBlocks}
                  ocrLang={ocrLang}
                  targetLang={targetLang}
                  onTargetLangChange={setTargetLang}
                  activePageIndex={activePageIndex}
                />
              )}

              {currentStep === 4 && (
                <TextEditor
                  images={images}
                  cleanedCanvases={cleanedCanvases}
                  textBlocks={textBlocks}
                  activePageIndex={activePageIndex}
                  onActivePageChange={setActivePageIndex}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setCurrentStep((prev) => Math.max(prev - 1, 0));
            }}
            disabled={currentStep === 0}
            className="px-5 py-3 rounded-xl font-medium transition-all disabled:opacity-0 bg-surface border border-border text-foreground hover:bg-white/5 flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            ย้อนกลับ
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="btn-gradient px-6 py-3 rounded-xl text-white font-bold shadow-lg shadow-primary/20 flex items-center gap-2 hover:gap-3 transition-all"
            >
              ถัดไป: {STEPS[currentStep + 1].label}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => window.scrollTo(0, 0)}
              className="btn-gradient px-8 py-3 rounded-xl text-white font-bold shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              ✅ เสร็จสิ้น
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
