import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Languages, Image as ImageIcon, Sparkles, CheckCircle2, Paintbrush, FileText, Zap, Shield, Globe } from 'lucide-react';
import { Header } from '../components/Header';
import { motion } from 'framer-motion';

export function LandingPage() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setHasDraft(Boolean(localStorage.getItem('manga_translate_draft')));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const } },
  };

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30 selection:text-white">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 z-0">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse-slow" />
            <div className="absolute top-1/2 -right-40 w-[30rem] h-[30rem] bg-accent-cyan/10 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent-purple/20 rounded-full blur-3xl opacity-50" />
            
            {/* Grid pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+Cjwvc3ZnPg==')] opacity-50 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
          </div>

          <motion.div 
            className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wide">เครื่องมือแปลการ์ตูนด้วย AI ฟรี 100%</span>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 tracking-tight">
              แปลการ์ตูนง่ายๆ <br className="hidden sm:block" />
              <span className="gradient-text-animated">จบในเว็บเดียว</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="max-w-2xl mx-auto text-lg sm:text-xl text-muted mb-10 leading-relaxed">
              ดึงข้อความ (OCR) คลีนภาพ ลบtextเดิม แปลภาษาอัตโนมัติ<br className="hidden sm:block" />
              พร้อม Editor ปรับแต่งฟอนต์ ไม่ต้องลงโปรแกรม ไม่ต้องใช้ API Key
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/worktable" className="group relative px-8 py-4 rounded-full bg-gradient-to-r from-primary via-accent-purple to-accent-cyan text-white font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 hover:scale-105 overflow-hidden w-full sm:w-auto flex justify-center items-center gap-2">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative flex items-center gap-2">
                  เริ่มแปลเลย <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <a href="#features" className="px-8 py-4 rounded-full border border-border text-foreground font-medium text-lg hover:bg-white/5 transition-colors w-full sm:w-auto">
                ดูวิธีการใช้งาน
              </a>
            </motion.div>
          </motion.div>
        </section>

        {hasDraft && (
          <section className="py-6 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-3xl border border-primary/20 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">มีงานที่บันทึกไว้</p>
                    <h3 className="text-lg font-bold text-foreground">คุณสามารถกลับมาทำต่อจากเดิมได้ทันที</h3>
                    <p className="text-sm text-muted">ระบบจะจำขั้นตอน OCR, คำแปลและภาพที่คลีนไว้ในเบราว์เซอร์ของคุณ</p>
                  </div>
                </div>
                <Link to="/worktable" className="inline-flex items-center justify-center gap-2 rounded-full bg-surface border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors">
                  ทำต่อจากงานเดิม <ArrowRight size={16} className="text-primary" />
                </Link>
              </motion.div>
            </div>
          </section>
        )}

        {/* Workflow Section */}
        <section id="features" className="py-20 bg-surface/50 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold mb-4">ทำงานเป็นสเต็ป <span className="gradient-text">ง่ายนิดเดียว</span></h2>
              <p className="text-muted">Workflow 5 ขั้นตอนสำหรับนักแปล</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { icon: ImageIcon, title: '1. อัปโหลด', desc: 'ลากวางรูปภาพ รองรับหลายหน้าพร้อมกัน', color: 'from-pink-500/20 to-rose-500/20' },
                { icon: Languages, title: '2. ดึงข้อความ', desc: 'AI ตรวจจับข้อความในภาพ (OCR) รองรับมังงะแนวตั้ง', color: 'from-purple-500/20 to-violet-500/20' },
                { icon: Paintbrush, title: '3. คลีนภาพ', desc: 'ลบข้อความต้นฉบับแนบเนียนด้วย Smart Inpaint', color: 'from-cyan-500/20 to-blue-500/20' },
                { icon: Sparkles, title: '4. แปลภาษา', desc: 'แปลฟรีด้วย Google + Lingva + MyMemory', color: 'from-amber-500/20 to-orange-500/20' },
                { icon: CheckCircle2, title: '5. วาง&โหลด', desc: 'จัดฟอนต์ วางตำแหน่ง โหลดเป็น ZIP', color: 'from-emerald-500/20 to-green-500/20' },
              ].map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className="glass-card rounded-2xl p-6 text-center cursor-default group"
                >
                  <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 border border-white/10 group-hover:scale-110 transition-transform duration-300`}>
                    <step.icon size={24} className="text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features highlight */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold mb-4">ทำไมต้อง <span className="gradient-text">MangaTranslate</span></h2>
              <p className="text-muted">เครื่องมือที่ออกแบบมาสำหรับนักแปลการ์ตูนโดยเฉพาะ</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Zap,
                  title: 'เร็วทันใจ',
                  desc: 'ระบบ AI Flow ทำทุกขั้นตอนให้อัตโนมัติ ตั้งแต่ OCR ถึงแปลภาษา จบในคลิกเดียว',
                  gradient: 'from-amber-500 to-orange-500',
                },
                {
                  icon: Shield,
                  title: 'ฟรี ไม่ต้องสมัคร',
                  desc: 'ไม่ต้อง API Key ไม่ต้องสมัครบัญชี ทำงานได้ทันทีในเบราว์เซอร์ ข้อมูลอยู่ในเครื่องคุณ',
                  gradient: 'from-emerald-500 to-teal-500',
                },
                {
                  icon: Globe,
                  title: 'รองรับหลายภาษา',
                  desc: 'ภาษาญี่ปุ่น (แนวตั้ง/แนวนอน) เกาหลี จีน อังกฤษ แปลเป็นไทยหรือภาษาอื่นได้ทันที',
                  gradient: 'from-blue-500 to-indigo-500',
                },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.15 }}
                  className="glass-card rounded-2xl p-8 group hover:border-primary/20 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <feature.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] bg-primary/10 rounded-full blur-3xl opacity-60" />
          </div>
          <motion.div 
            className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              พร้อมแปลแล้วใช่ไหม? <span className="gradient-text">เริ่มเลย!</span>
            </h2>
            <p className="text-muted mb-8 text-lg">
              ไม่ต้องดาวน์โหลด ไม่ต้องสมัคร ใช้งานได้ทันที
            </p>
            <Link 
              to="/worktable" 
              className="group relative inline-flex items-center gap-2 px-10 py-5 rounded-full bg-gradient-to-r from-primary via-accent-purple to-accent-cyan text-white font-bold text-lg shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2">
                เปิดโต๊ะทำงาน <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>
        </section>

      </main>
    </div>
  );
}
