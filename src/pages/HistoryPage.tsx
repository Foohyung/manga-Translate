import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Clock, ArrowRight, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface HistoryEntry {
  id: number;
  date: string;
  pagesCount: number;
  sourceLang: string;
  targetLang: string;
  previewText: string;
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const historyStr = localStorage.getItem('translation_history');
    if (historyStr) {
      setHistory(JSON.parse(historyStr));
    }
  }, []);

  const clearHistory = () => {
    localStorage.removeItem('translation_history');
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ประวัติการทำงาน</h1>
            <p className="text-sm text-muted">บันทึกความคืบหน้าการแปลของคุณ 10 รายการล่าสุด</p>
          </div>
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              className="px-4 py-2 rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> ล้างประวัติ
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-3xl border border-dashed border-border">
            <Clock size={48} className="mx-auto mb-4 opacity-20 text-muted" />
            <h3 className="text-lg font-medium text-foreground mb-2">ยังไม่มีประวัติการทำงาน</h3>
            <p className="text-muted text-sm mb-6">คุณยังไม่ได้บันทึกงานแปลใดๆ เลย</p>
            <Link to="/worktable" className="btn-gradient px-6 py-2.5 rounded-xl text-white text-sm font-bold inline-block">
              เริ่มแปลงานแรก
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {item.pagesCount} หน้า
                    </span>
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: th })}
                    </span>
                  </div>
                  <p className="text-foreground font-medium text-sm mt-2 line-clamp-1">
                    "{item.previewText}"
                  </p>
                  <p className="text-xs text-muted mt-1 uppercase">
                    {item.sourceLang} → {item.targetLang}
                  </p>
                </div>
                
                <Link to="/worktable" className="shrink-0 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground hover:bg-white/5 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
                  ทำต่อ <ArrowRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
