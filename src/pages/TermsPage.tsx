import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';
import './Landing.css';

const TermsPage: React.FC = () => {
  const { exchangeRate } = useExchangeRate();

  return (
    <div className="landing-root min-h-screen">
      {/* ─── FONDO DE PARTÍCULAS Y GRIDS ─── */}
      <div className="bg-grid-pattern"></div>
      <div className="glow-effect" style={{ top: '5%', left: '10%', width: '600px', height: '600px' }}></div>
      <div className="glow-effect" style={{ bottom: '15%', right: '5%', width: '500px', height: '500px', opacity: 0.04 }}></div>

      {/* ─── NAVEGACIÓN PREMIUM ─── */}
      <nav className="glass-nav">
        <div className="nav-container px-6 py-4">
          <Link to="/" className="logo-group">
            <div className="logo-box">M</div>
            <span className="logo-text">Melo.</span>
          </Link>

          <div className="nav-actions flex items-center gap-6">
            <div className="bcv-indicator bcv-pulse hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tasa BCV</span>
              <span className="text-xs font-black text-[#E2FF3B]">
                {exchangeRate?.rate ? `Bs. ${exchangeRate.rate.toFixed(2)}` : 'Sincronizando...'}
              </span>
            </div>

            <div className="cta-group flex items-center gap-4">
              <Link to="/login" className="login-link hover:text-white transition-colors">Ingresar</Link>
              <Link to="/register" className="btn-primary-sm">Crear Cuenta</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content max-w-4xl mx-auto px-6 pt-60 pb-20 relative z-10">
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8 }}
           className="space-y-12"
        >
          <header className="space-y-6">
            <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#E2FF3B] hover:gap-4 transition-all">
              <ArrowLeft size={14} /> Volver al Inicio
            </Link>
            <h1 className="text-5xl lg:text-7xl font-black italic uppercase leading-none text-white">
              Términos y <br />
              <span className="text-[#E2FF3B] text-glow">Condiciones.</span>
            </h1>
            <p className="text-white/30 text-xs font-black uppercase tracking-[0.3em]">Última actualización: 09 de Abril, 2026 · Caracas, VE</p>
          </header>

          <div className="space-y-16">
            <section className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase text-white/90 border-l-2 border-[#E2FF3B] pl-6">1. Aceptación del Servicio</h2>
              <p className="text-white/50 text-lg leading-relaxed font-medium">
                Al acceder y utilizar MELO, usted acepta estar sujeto a estos términos. 
                Nuestra plataforma proporciona herramientas de gestión para prestamistas independientes 
                en Venezuela, incluyendo cálculos basados en la tasa oficial del BCV.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase text-white/90 border-l-2 border-[#E2FF3B] pl-6">2. Privacidad de los Datos</h2>
              <p className="text-white/50 text-lg leading-relaxed font-medium">
                Sus datos son privados y están cifrados. MELO no comparte información de 
                sus clientes ni de sus préstamos con terceros. Usted es el único responsable de la 
                confidencialidad de sus credenciales de acceso.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                 {[
                   'Cifrado de extremo a extremo',
                   'Acceso por Google Auth',
                   'Sin claves en texto plano',
                   'Backups diarios en GCP'
                 ].map((item, i) => (
                   <div key={i} className="glass-panel p-4 flex items-center gap-3 border-white/5">
                      <CheckCircle2 size={16} className="text-[#E2FF3B]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{item}</span>
                   </div>
                 ))}
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase text-white/90 border-l-2 border-[#E2FF3B] pl-6">3. Modelo de Suscripción</h2>
              <p className="text-white/50 text-lg leading-relaxed font-medium">
                MELO opera bajo un modelo SaaS de suscripción mensual. 
                El incumplimiento en el pago resultará en la restricción temporal del acceso 
                al panel de gestión de préstamos.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase text-white/90 border-l-2 border-[#E2FF3B] pl-6">4. Responsabilidad Financiera</h2>
              <p className="text-white/50 text-lg leading-relaxed font-medium">
                MELO es una herramienta de software de asistencia. No somos una 
                institución bancaria ni nos hacemos responsables por la recuperación de capital 
                de los préstamos registrados por el usuario. Los cálculos de la tasa BCV son 
                informativos y basados en fuentes públicas oficiales.
              </p>
            </section>

            <section className="pt-10">
               <div className="glass-panel p-8 bg-[#E2FF3B]/5 border-[#E2FF3B]/20 flex flex-col sm:flex-row gap-6 items-center">
                  <ShieldCheck className="text-[#E2FF3B]" size={40} />
                  <p className="text-[11px] font-black uppercase leading-relaxed text-[#E2FF3B]/80 italic">
                    ESTA PLATAFORMA ES UNA HERRAMIENTA DE ASISTENCIA PARA GESTIONAR PRESTAMOS. 
                    SU USO ESTÁ SUJETO A LAS LEYES VIGENTES DE LA REPÚBLICA BOLIVARIANA DE VENEZUELA.
                  </p>
               </div>
            </section>
          </div>
        </motion.div>
      </main>

      <footer className="footer-area border-t border-white/5 py-24 px-12 bg-[#06070a] relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start gap-20">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E2FF3B] rounded-xl flex items-center justify-center font-black italic text-black text-xl">M</div>
              <span className="text-2xl font-black italic uppercase tracking-tighter">Melo.</span>
            </div>
            <p className="text-white/30 text-sm max-w-sm font-medium leading-relaxed">
              La plataforma que empodera a los gestores de préstamos con tecnología de vanguardia.
            </p>
          </div>

          <div className="flex gap-16">
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#E2FF3B]">Legal</p>
              <Link to="/terminos" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Términos</Link>
              <Link to="/privacidad" className="block text-sm font-bold text-white/40 hover:text-white transition-colors">Privacidad</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsPage;

