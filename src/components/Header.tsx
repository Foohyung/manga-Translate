import { Link, useLocation } from 'react-router-dom';
import { Languages, Home, Clock, Sparkles } from 'lucide-react';

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'หน้าแรก', icon: Home },
    { path: '/worktable', label: 'โต๊ะทำงาน', icon: Languages },
    { path: '/history', label: 'ประวัติ', icon: Clock },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top gradient line */}
      <div className="h-1 bg-gradient-to-r from-primary via-accent-purple to-accent-cyan" />
      
      <nav className="glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight gradient-text">
                  MangaTranslate
                </span>
                <span className="text-[10px] text-muted -mt-1 hidden sm:block">
                  แปลการ์ตูนออนไลน์ฟรี
                </span>
              </div>
            </Link>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'text-muted hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
