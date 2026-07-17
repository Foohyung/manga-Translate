import { useState } from 'react';
import { Languages, Loader2, Edit3, Check, ArrowRight } from 'lucide-react';
import { translateBatch, TARGET_LANGUAGE_OPTIONS, type TranslateLanguage } from '../utils/translate';
import { ocrLangToTranslateLang } from '../utils/translate';
import type { TextBlock } from '../utils/ocr';

interface TranslationPanelProps {
  textBlocks: TextBlock[][];
  onTextBlocksChange: (blocks: TextBlock[][]) => void;
  ocrLang: string;
  targetLang: TranslateLanguage;
  onTargetLangChange: (lang: TranslateLanguage) => void;
  activePageIndex: number;
}

export function TranslationPanel({
  textBlocks,
  onTextBlocksChange,
  ocrLang,
  targetLang,
  onTargetLangChange,
  activePageIndex,
}: TranslationPanelProps) {
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const blocks = textBlocks[activePageIndex] || [];
  const hasTranslations = blocks.some((b) => b.translatedText);

  const translateCurrentPage = async () => {
    if (blocks.length === 0) return;
    setTranslating(true);

    const texts = blocks.map((b) => b.text);
    const translated = await translateBatch(
      texts,
      ocrLang,
      targetLang,
      (current, total) => setProgress({ current, total })
    );

    const updated = [...textBlocks];
    updated[activePageIndex] = blocks.map((block, idx) => ({
      ...block,
      translatedText: translated[idx],
    }));
    onTextBlocksChange(updated);
    setTranslating(false);
  };

  const translateAll = async () => {
    setTranslating(true);
    const updated = [...textBlocks];

    for (let pageIdx = 0; pageIdx < textBlocks.length; pageIdx++) {
      const pageBlocks = textBlocks[pageIdx] || [];
      if (pageBlocks.length === 0) continue;

      const texts = pageBlocks.map((b) => b.text);
      const translated = await translateBatch(
        texts,
        ocrLang,
        targetLang,
        (current, total) =>
          setProgress({
            current: current,
            total: total,
          })
      );

      updated[pageIdx] = pageBlocks.map((block, idx) => ({
        ...block,
        translatedText: translated[idx],
      }));
    }

    onTextBlocksChange(updated);
    setTranslating(false);
  };

  const updateTranslation = (blockId: string, newText: string) => {
    const updated = [...textBlocks];
    const pageBlocks = [...(updated[activePageIndex] || [])];
    const idx = pageBlocks.findIndex((b) => b.id === blockId);
    if (idx >= 0) {
      pageBlocks[idx] = { ...pageBlocks[idx], translatedText: newText };
      updated[activePageIndex] = pageBlocks;
      onTextBlocksChange(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-muted mb-1.5 font-medium">
            ภาษาปลายทาง
          </label>
          <select
            value={targetLang}
            onChange={(e) =>
              onTargetLangChange(e.target.value as TranslateLanguage)
            }
            disabled={translating}
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          >
            {TARGET_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.flag} {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-5">
          <button
            onClick={translateCurrentPage}
            disabled={translating || blocks.length === 0}
            className="btn-gradient px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {translating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังแปล... ({progress.current}/{progress.total})
              </>
            ) : (
              <>
                <Languages size={16} />
                แปลหน้านี้
              </>
            )}
          </button>
          <button
            onClick={translateAll}
            disabled={translating || textBlocks.every((b) => !b?.length)}
            className="px-5 py-2.5 rounded-xl border border-primary/30 text-primary font-bold text-sm flex items-center gap-2 hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Languages size={16} />
            แปลทั้งหมด
          </button>
        </div>
      </div>

      {/* Translation info */}
      <div className="glass-card rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
          <Languages size={16} className="text-accent-purple" />
        </div>
        <div className="text-xs text-muted">
          <span className="text-foreground font-medium">
            {ocrLangToTranslateLang(ocrLang).toUpperCase()}
          </span>
          <ArrowRight size={12} className="inline mx-1.5 text-primary" />
          <span className="text-foreground font-medium">
            {targetLang.toUpperCase()}
          </span>
          <span className="ml-2">
            · Google Translate → Lingva → MyMemory (ฟรี ไม่ต้องใช้ API Key)
          </span>
        </div>
      </div>

      {/* Translation list */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Languages size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">ยังไม่มีข้อความที่จะแปล</p>
            <p className="text-xs mt-1">
              กรุณาดึงข้อความในขั้นตอนที่ 2 ก่อน
            </p>
          </div>
        ) : (
          blocks.map((block, idx) => (
            <div key={block.id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                  #{idx + 1}
                </span>
              </div>

              {/* Original */}
              <div>
                <p className="text-[10px] text-muted mb-1 uppercase font-bold tracking-wider">
                  ต้นฉบับ
                </p>
                <p className="text-sm text-foreground bg-white/5 rounded-lg p-2.5 leading-relaxed">
                  {block.text}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowRight
                  size={14}
                  className="text-primary rotate-90"
                />
              </div>

              {/* Translation */}
              <div>
                <p className="text-[10px] text-muted mb-1 uppercase font-bold tracking-wider">
                  คำแปล
                </p>
                {editingId === block.id ? (
                  <div className="flex gap-2">
                    <textarea
                      autoFocus
                      value={block.translatedText || ''}
                      onChange={(e) =>
                        updateTranslation(block.id, e.target.value)
                      }
                      rows={2}
                      className="flex-1 px-3 py-2 bg-background border border-primary/30 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    />
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 text-primary self-start"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() =>
                      block.translatedText && setEditingId(block.id)
                    }
                    className={`rounded-lg p-2.5 text-sm leading-relaxed cursor-pointer transition-colors ${
                      block.translatedText
                        ? 'bg-primary/5 border border-primary/10 text-foreground hover:border-primary/30'
                        : 'bg-white/5 text-muted italic'
                    }`}
                  >
                    {block.translatedText || 'ยังไม่ได้แปล...'}
                    {block.translatedText && (
                      <Edit3
                        size={10}
                        className="inline ml-2 text-muted"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
