import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { uiFontVariables } from '@/lib/fonts';
import './globals.css';

const description =
  'เครื่องมือแปลการ์ตูนออนไลน์ฟรี ดึงข้อความจากภาพ แปลภาษา ลบข้อความเดิม และจัดตำแหน่ง ขนาด สีตัวอักษรได้ในเว็บเดียว';

export const metadata: Metadata = {
  title: {
    default: 'MangaTranslate — แปลมังงะ มันฮวา มันฮัว ออนไลน์ฟรี',
    template: '%s · MangaTranslate',
  },
  description,
  keywords: ['แปลมังงะ', 'แปลการ์ตูน', 'manga translator', 'manhwa translate', 'OCR manga'],
  openGraph: {
    title: 'MangaTranslate — แปลมังงะออนไลน์ฟรี',
    description,
    type: 'website',
    locale: 'th_TH',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={uiFontVariables}>
      <body>{children}</body>
    </html>
  );
}
