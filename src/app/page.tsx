import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Download,
  Globe,
  Languages,
  Move,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { ContinueProjectBanner } from '@/components/ContinueProjectBanner';
import { SiteHeader } from '@/components/SiteHeader';

const STEPS = [
  { icon: Upload, title: 'อัปโหลดภาพ', description: 'ลากวางได้หลายหน้าพร้อมกัน รองรับ PNG, JPG, WEBP' },
  { icon: ScanText, title: 'ดึงข้อความ', description: 'อ่านข้อความในภาพอัตโนมัติ รองรับมังงะตัวอักษรแนวตั้ง' },
  { icon: Languages, title: 'แปลภาษา', description: 'แปลเป็นไทยหรือภาษาอื่น และแก้คำแปลได้ทุกจุด' },
  { icon: Move, title: 'จัดวางตัวอักษร', description: 'ลากย้ายตำแหน่ง ปรับขนาด เปลี่ยนสี ฟอนต์ และเส้นขอบ' },
  { icon: Download, title: 'ดาวน์โหลด', description: 'บันทึกเป็น PNG ทีละหน้า หรือ ZIP ทั้งตอน' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'แปลอัตโนมัติในคลิกเดียว',
    description: 'ดึงข้อความ ลบข้อความเดิม และแปลภาษาให้ครบทุกหน้า แล้วค่อยเก็บรายละเอียดทีหลัง',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: ShieldCheck,
    title: 'ฟรี ไม่ต้องสมัคร',
    description: 'ไม่ต้องใช้ API Key ไม่ต้องสร้างบัญชี งานของคุณถูกเก็บไว้ในเบราว์เซอร์ของคุณเอง',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Globe,
    title: 'รองรับหลายภาษา',
    description: 'ญี่ปุ่น เกาหลี จีน อังกฤษ แปลเป็นไทย อังกฤษ เวียดนาม อินโดนีเซีย และอื่น ๆ',
    gradient: 'from-blue-500 to-indigo-500',
  },
];

function StartLink({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/worktable"
      className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary/25 transition hover:scale-[1.03] hover:shadow-primary/40 sm:w-auto"
    >
      {children}
      <ArrowRight size={20} className="transition group-hover:translate-x-1" />
    </Link>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-4 pt-24 pb-20 sm:px-6 lg:pt-36 lg:pb-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute top-1/2 -right-40 size-[30rem] rounded-full bg-accent-cyan/10 blur-3xl" />
            <div className="absolute -bottom-40 left-1/2 size-96 -translate-x-1/2 rounded-full bg-accent-purple/20 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <p className="mb-8 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles size={14} /> เครื่องมือแปลการ์ตูนฟรี ใช้งานได้ทันที
            </p>
            <h1
              className="mb-6 animate-fade-up text-4xl font-black tracking-tight sm:text-5xl md:text-7xl"
              style={{ animationDelay: '80ms' }}
            >
              แปลการ์ตูนง่าย ๆ
              <br />
              <span className="gradient-text">จบในเว็บเดียว</span>
            </h1>
            <p
              className="mx-auto mb-10 max-w-2xl animate-fade-up text-lg leading-relaxed text-muted sm:text-xl"
              style={{ animationDelay: '160ms' }}
            >
              ดึงข้อความจากภาพ แปลภาษาอัตโนมัติ ลบข้อความต้นฉบับ แล้วจัดตำแหน่ง ขนาด สี และฟอนต์ของตัวอักษรได้อิสระ
            </p>
            <div
              className="flex animate-fade-up flex-col items-center justify-center gap-4 sm:flex-row"
              style={{ animationDelay: '240ms' }}
            >
              <StartLink>เริ่มแปลเลย</StartLink>
              <a
                href="#how-it-works"
                className="w-full rounded-full border border-border px-8 py-4 text-lg font-medium transition hover:bg-white/5 sm:w-auto"
              >
                ดูวิธีใช้งาน
              </a>
            </div>
          </div>
        </section>

        <ContinueProjectBanner />

        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface/50 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center">
              <h2 className="mb-4 text-3xl font-bold">
                ทำงานเป็นขั้นตอน <span className="gradient-text">ง่ายนิดเดียว</span>
              </h2>
              <p className="text-muted">ทำทีละขั้นเอง หรือกด “แปลอัตโนมัติ” ให้ระบบทำให้ทั้งหมด</p>
            </div>
            <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
              {STEPS.map(({ icon: Icon, title, description }, index) => (
                <li key={title} className="glass-card rounded-2xl p-6 text-center">
                  <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-white/10 bg-primary/10 text-primary">
                    <Icon size={24} />
                  </span>
                  <h3 className="mb-2 font-bold">
                    {index + 1}. {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-14 text-center text-3xl font-bold">
              ทำไมต้อง <span className="gradient-text">MangaTranslate</span>
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description, gradient }) => (
                <div key={title} className="glass-card rounded-2xl p-8">
                  <span
                    className={`mb-5 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${gradient}`}
                  >
                    <Icon size={22} className="text-white" />
                  </span>
                  <h3 className="mb-3 text-lg font-bold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 text-center sm:px-6">
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
            พร้อมแปลแล้วใช่ไหม? <span className="gradient-text">เริ่มเลย!</span>
          </h2>
          <p className="mb-8 text-lg text-muted">ไม่ต้องดาวน์โหลดโปรแกรม ไม่ต้องสมัครสมาชิก</p>
          <StartLink>เปิดโต๊ะทำงาน</StartLink>
        </section>
      </main>
    </>
  );
}
