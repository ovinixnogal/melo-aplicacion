import React from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  Zap,
  CheckCircle2,
  Plus,
  MessageCircle,
  TrendingUp,
  CreditCard,
  Users,
  LayoutDashboard,
  Bell,
  Rocket,
  Shield,
  ArrowRight,
  History
} from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';
import './Landing.css';

const LandingPage: React.FC = () => {
  const { exchangeRate } = useExchangeRate();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  return (
    <div className="landing-root">
      {/* ─── FONDO DE PARTÍCULAS Y GRIDS ─── */}
      <div className="bg-grid-pattern"></div>
      <div className="glow-effect" style={{ top: '-10%', left: '0%', width: 'clamp(300px, 80vw, 800px)', height: 'clamp(300px, 80vw, 800px)', opacity: 0.03 }}></div>
      <div className="glow-effect" style={{ bottom: '15%', right: '5%', width: 'clamp(200px, 50vw, 500px)', height: 'clamp(200px, 50vw, 500px)', opacity: 0.02 }}></div>

      {/* ─── NAVEGACIÓN PREMIUM ─── */}
      <nav className="glass-nav">
        <div className="nav-container px-6 py-4">
          <div className="logo-group">
            <div className="logo-box">M</div>
            <span className="logo-text">Melo.</span>
          </div>

          <div className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
            <a href="#beneficios" className="hover:text-[#E2FF3B] transition-colors">Ventajas</a>
            <a href="#seguridad" className="hover:text-[#E2FF3B] transition-colors">Seguridad</a>
            <a href="#precios" className="hover:text-[#E2FF3B] transition-colors">Suscripción</a>
          </div>

          <div className="nav-actions flex items-center gap-3 sm:gap-6">
            <div className="bcv-indicator bcv-pulse flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-white/5">
              <span className="text-[8px] sm:text-[10px] font-bold text-white/40 uppercase tracking-widest hidden xs:block">BCV</span>
              <span className="text-[10px] sm:text-xs font-black text-[#E2FF3B]">
                {exchangeRate?.rate ? `Bs. ${exchangeRate.rate.toFixed(1)}` : '...'}
              </span>
            </div>

            <div className="cta-group flex items-center gap-3 sm:gap-4">
              <Link to="/login" className="login-link hover:text-white transition-colors">Entrar</Link>
              <Link to="/register" className="btn-primary-sm">Registrar</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content max-w-7xl mx-auto px-6 py-20">

        {/* ─── HERO: THE POWER OF CONTROL ─── */}
        <section className="hero-section grid grid-cols-1 lg:grid-cols-2 gap-20 items-center min-h-[70vh]">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-10"
          >
            <motion.h1 variants={itemVariants} className="hero-title text-gradient-dark font-black italic uppercase">
              Domina <br />
              tu flujo de <br />
              <span className="text-glow text-[#E2FF3B]">Capital.</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="hero-description text-xl text-white/50 border-l-2 border-[#E2FF3B] pl-8 max-w-lg leading-relaxed">
              Melo Finance es la plataforma de alto rendimiento para prestamitas que buscan precisión milimétrica en sus cobros y blindaje ante la inflación.
            </motion.p>

            <motion.div variants={itemVariants} className="hero-cta flex flex-col sm:flex-row items-stretch sm:items-center gap-6 sm:gap-8 pt-4">
              <Link to="/register" className="btn-hero shadow-glow flex items-center justify-center gap-4 px-8 py-5 bg-[#E2FF3B] text-black rounded-2xl font-black text-lg sm:text-xl italic uppercase hover:scale-105 transition-transform">
                Probar Gratis <ArrowUpRight size={24} />
              </Link>
              <div className="hero-stats-brief text-center sm:text-left space-y-1">
                <p className="text-lg font-black italic text-white">Multimoneda</p>
                <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-black">Control Total USD | VES</p>
              </div>
            </motion.div>
          </motion.div>

          {/* MOCKUP DINÁMICO DE APP */}
          <motion.div
            className="hero-visual perspective-1000 flex justify-center lg:justify-end mt-12 lg:mt-0"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="iphone-frame animate-float relative z-20">
              <div className="iphone-content bg-[#FDFCF9]">
                {/* --- HEADER --- */}
                <div className="app-header p-5 flex justify-between items-center bg-[#FDFCF9]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#E2FF3B]"></div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#1A1A1A]">Dashboard</span>
                  </div>
                  <div className="w-8 h-8 rounded-[12px] bg-[#1A1A1A]/5 flex items-center justify-center text-[#1A1A1A]">
                    <Bell size={14} />
                  </div>
                </div>

                <div className="px-5 space-y-6">
                  {/* --- WELCOME --- */}
                  <div>
                    <h4 className="text-[17px] font-black italic uppercase leading-none text-[#1A1A1A]">
                      Resumen <span className="text-[#E2FF3B] bg-[#1A1A1A] px-1.5 py-0.5 rounded-lg ml-1">2026</span>
                    </h4>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/40 mt-1">Estado actual de tu cartera</p>
                  </div>

                  {/* --- CARD --- */}
                  <div className="bg-[#1A1A1A] p-6 rounded-[32px] shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[7px] font-black uppercase tracking-[0.3em] text-[#E2FF3B]/50 mb-1">Total en Calle</p>
                      <h4 className="text-3xl font-[1000] text-white italic tracking-tighter">$24,680.00</h4>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-[9px] font-black text-[#E2FF3B] italic">+14.2%</span>
                        <TrendingUp size={14} className="text-[#E2FF3B] opacity-40" />
                      </div>
                    </div>
                    <ArrowUpRight size={32} className="absolute -bottom-2 -right-2 text-white/5" />
                  </div>

                  {/* --- LIST --- */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[8px] font-black uppercase text-[#1A1A1A]/40 tracking-[0.3em]">Atención Requerida</p>
                      <ArrowRight size={10} className="text-[#1A1A1A]/20" />
                    </div>
                    
                    {[
                      { n: "Ricardo Sosa", a: "VENCIDO", t: "Cuota #4 (Mora)", c: "#FF2D55", b: "bg-rose-50 border-rose-100", tx: "text-[#1A1A1A]" },
                      { n: "Lina Marcano", a: "$85.00", t: "Vence en 2h", c: "#1A1A1A", b: "bg-white border-[#1A1A1A]/5", tx: "text-[#1A1A1A]" },
                      { n: "Fabio Ortiz", a: "$120.00", t: "Abono Capital", c: "#E2FF3B", b: "bg-[#1A1A1A]", tx: "text-white" }
                    ].map((p, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3.5 border rounded-[24px] shadow-sm transition-all ${p.b}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black italic text-[11px] ${p.tx === 'text-white' ? 'bg-white/10 text-white' : 'bg-[#1A1A1A]/5 text-[#1A1A1A]'}`}>
                          {p.n[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-black uppercase italic leading-none truncate ${p.tx}`}>{p.n}</p>
                          <p className={`text-[7px] font-bold uppercase mt-1 opacity-40 ${p.tx}`}>{p.t}</p>
                        </div>
                        <p className="text-[10px] font-black italic" style={{ color: p.c }}>{p.a}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* --- NAV --- */}
                <div className="absolute bottom-6 left-4 right-4 h-16 bg-[#1A1A1A] rounded-[28px] flex justify-between items-center px-6 shadow-2xl border border-white/5">
                  <LayoutDashboard size={18} className="text-[#E2FF3B]" />
                  <Users size={18} className="text-white/20" />
                  <div className="w-11 h-11 bg-[#E2FF3B] rounded-2xl flex items-center justify-center text-[#1A1A1A] shadow-lg shadow-[#E2FF3B]/30 transform rotate-3"><Plus size={22} strokeWidth={3} /></div>
                  <CreditCard size={18} className="text-white/20" />
                  <History size={18} className="text-white/20" />
                </div>
              </div>
            </div>

            {/* WhatsApp Integration Preview */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="floating-card glass-panel absolute -left-48 top-[35%] border-[#E2FF3B]/10 hidden 2xl:flex"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#25D366] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,211,102,0.4)]">
                  <MessageCircle size={24} color="white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase mb-0.5">Integración Directa</p>
                  <p className="text-sm font-black italic uppercase text-white">Cobros por WhatsApp</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── BENTO GRID FEATURES ─── */}
        <section id="beneficios" className="features-section mt-52 space-y-16">
          <div className="section-header text-center space-y-4">
            <h2 className="text-4xl lg:text-7xl font-black italic uppercase text-gradient-dark">Ingeniería <span className="text-glow text-[#E2FF3B]">Financiera.</span></h2>
            <p className="text-white/40 text-lg font-medium max-w-2xl mx-auto italic">Diseñado para quienes ven el préstamo no como un favor, sino como un negocio de alta precisión.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div whileHover={{ y: -10 }} className="feature-card glass-panel group p-10 border-white/5">
              <Zap size={48} className="feature-icon mb-8 text-[#E2FF3B]" />
              <h3 className="feature-name text-2xl font-black italic uppercase mb-4">Cálculo de Mora</h3>
              <p className="feature-desc text-white/50 leading-relaxed">Automatiza intereses punitorios. El sistema detecta atrasos y recalculas los montos según los parámetros de tu negocio.</p>
            </motion.div>

            <motion.div whileHover={{ y: -10 }} className="feature-card glass-panel p-10 border-[#E2FF3B]/30 bg-[#E2FF3B]/5">
              <Smartphone size={48} className="feature-icon mb-8 text-[#E2FF3B]" />
              <h3 className="feature-name text-2xl font-black italic uppercase mb-4">PWA Nativa</h3>
              <p className="feature-desc text-white/50 leading-relaxed">No necesitas descargar nada de la App Store. Instala Melo directamente en tu pantalla de inicio y conéctate en segundos.</p>
            </motion.div>

            <motion.div whileHover={{ y: -10 }} className="feature-card glass-panel group p-10 border-white/5">
              <ShieldCheck size={48} className="feature-icon mb-8 text-[#E2FF3B]" />
              <h3 className="feature-name text-2xl font-black italic uppercase mb-4">Data Analytics</h3>
              <p className="feature-desc text-white/50 leading-relaxed">Reportes detallados de rentabilidad, proyecciones de cobro y flujos de caja proyectados para tomar mejores decisiones.</p>
            </motion.div>
          </div>
        </section>

        {/* ─── SECURITY SECTION ─── */}
        <section id="seguridad" className="mt-20 lg:mt-52 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center bg-white/[0.01] p-8 lg:p-24 rounded-[2.5rem] lg:rounded-[5rem] border border-white/5 relative overflow-hidden mx-auto w-full">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#E2FF3B] blur-[150px] opacity-[0.03] pointer-events-none"></div>
          <div className="space-y-8 relative z-10">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mx-auto lg:mx-0">
              <Shield size={32} className="text-[#E2FF3B]" />
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-[0.9] text-white text-center lg:text-left break-words">
              Blindaje <br /> <span className="text-[#E2FF3B]">Estructural.</span>
            </h2>
            <p className="text-white/50 text-base lg:text-xl leading-relaxed max-w-md mx-auto lg:mx-0 text-center lg:text-left">Tu información está alojada en Google Cloud Platform con encriptación AES-256 de nivel militar. Solo tú tienes la llave.</p>
          </div>
          <div className="grid grid-cols-2 gap-6 relative z-10">
            {[
              { title: "Firebase Secure", desc: "Auth & Database" },
              { title: "Daily Backup", desc: "Nube Redundante" },
              { title: "SSL 256bit", desc: "Comunicación Cifrada" },
              { title: "Audit Log", desc: "Rastreo de Actividad" }
            ].map((item, idx) => (
              <div key={idx} className="glass-panel p-8 text-center border-white/5 hover:border-[#E2FF3B]/30 transition-colors">
                <p className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">{item.title}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E2FF3B]/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="precios" className="mt-52 text-center space-y-16">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-[100px] font-black italic uppercase tracking-tighter leading-none text-white">PRECIO <span className="text-[#E2FF3B]">ÚNICO.</span></h2>
            <p className="text-white/30 font-black uppercase tracking-[0.5em] text-sm">Transparencia desde el primer día</p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto glass-panel p-1 lg:p-1.5 bg-gradient-to-b from-[#E2FF3B]/20 to-transparent"
          >
            <div className="p-10 lg:p-20 bg-[#0A0B0E] rounded-[3rem] flex flex-col items-center gap-12 text-center">
              <div className="space-y-4">
                <h4 className="text-8xl font-black italic text-white tracking-tighter">$3.99<span className="text-2xl text-white/20">/m</span></h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 text-left w-full max-w-lg mx-auto border-y border-white/5 py-12">
                {[
                  'Clientes Ilimitados',
                  'Multimoneda (BCV/USD)',
                  'Mora Automatizada',
                  'WhatsApp Integrado',
                  'Soporte 24/7 VIP',
                  'Panel de Capital'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white/60 italic">
                    <div className="w-5 h-5 bg-[#E2FF3B]/10 rounded-full flex items-center justify-center"><CheckCircle2 size={12} className="text-[#E2FF3B]" /></div> {item}
                  </div>
                ))}
              </div>

              <Link to="/register" className="w-full py-8 bg-[#E2FF3B] text-black rounded-3xl font-black text-2xl uppercase italic tracking-tighter hover:scale-105 transition-transform flex items-center justify-center gap-4 shadow-[0_30px_60px_rgba(226,255,59,0.3)]">
                Empezar Prueba Gratuita <Rocket />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ─── FINAL CTA MASSIVE ─── */}
        <section className="mt-64 text-center space-y-16 py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#E2FF3B]/10 to-transparent blur-[120px] opacity-20"></div>
          <motion.h2
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-[12vw] font-black italic uppercase leading-[0.8] tracking-tighter text-white"
          >
            DOMINA TUS <br /> <span className="text-[#E2FF3B]">FINANZAS.</span>
          </motion.h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-10">
            <Link to="/register" className="px-16 py-8 bg-white text-black rounded-3xl font-black text-2xl italic uppercase hover:bg-[#E2FF3B] transition-colors shadow-2xl">Crear Portafolio</Link>
          </div>
        </section>

      </main>

      <footer className="footer-area border-t border-white/5 py-24 px-12 bg-[#06070a] relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start gap-20">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E2FF3B] rounded-xl flex items-center justify-center font-black italic text-black text-xl">M</div>
              <span className="text-2xl font-black italic uppercase tracking-tighter">Melo.</span>
            </div>
            <p className="text-white/30 text-sm max-w-sm font-medium leading-relaxed">
              La plataforma que empodera a los gestores de préstamos con tecnología de vanguardia y análisis en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 lg:gap-32">
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#E2FF3B]">Producto</p>
              <a href="#beneficios" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Funciones</a>
              <a href="#precios" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Precio</a>
            </div>
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#E2FF3B]">Compañía</p>
              <Link to="/terminos" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Términos</Link>
              <Link to="/privacidad" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Privacidad</Link>
            </div>
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#E2FF3B]">Social</p>
              <a href="#" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Instagram</a>
              <a href="#" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Twitter</a>
            </div>
          </div>
        </div>
        <div className="mt-32 border-t border-white/5 pt-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 italic">© 2026 Melo Finance Ecosystem | Más allá de la banca</p>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;