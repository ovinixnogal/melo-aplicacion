import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { 
  ArrowUpRight, 
  Zap, 
  BellRing, 
  PieChart, 
  Shield, 
  Globe, 
  Activity,
  Target,
  Smartphone,
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  Rocket
} from 'lucide-react';
import { useExchangeRate } from '../hooks/useExchangeRate';

// ── COMPONENTE: VISUALIZACIÓN DINÁMICA DEL HERO ──
const ActiveFlowVisual: React.FC = () => {
  const payments = [
    { id: 1, name: 'Juan Pérez', amount: 150, time: '3h', status: 'pending' },
    { id: 2, name: 'María García', amount: 320, time: '5h', status: 'paid' },
    { id: 3, name: 'Pedro Castillo', amount: 90, time: '7h', status: 'pending' },
  ];

  return (
    <div className="relative w-full h-[400px] lg:h-[600px] flex items-center justify-center">
      {/* Background Glow */}
      <motion.div 
        animate={{ 
          scale: [1, 1.25, 1], 
          opacity: [0.1, 0.3, 0.1],
          rotate: [0, 180, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-64 h-64 lg:w-[500px] lg:h-[500px] bg-[#E2FF3B] rounded-full blur-[100px] lg:blur-[140px]"
      />

      <div className="relative z-10 space-y-4 lg:space-y-6 w-full max-w-[340px] md:max-w-[400px]">
        {payments.map((pay, index) => (
          <motion.div
            key={pay.id}
            initial={{ opacity: 0, x: 60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: index * 0.2, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ scale: 1.05, x: -10 }}
            className={`flex items-center gap-3 lg:gap-4 shadow-2xl transition-all
              ${index === 0 ? 'bg-white border-[#E2FF3B]' : 'bg-white/70 border-white/20'} 
              p-4 lg:p-5 rounded-[2rem] lg:rounded-[2.5rem] border backdrop-blur-3xl`}
          >
            <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-black text-base lg:text-xl shadow-lg
              ${index === 0 ? 'bg-[#1A1A1A] text-[#E2FF3B]' : 'bg-[#E2FF3B] text-[#1A1A1A]'}`}>
              {pay.name[0]}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className="font-black text-[#1A1A1A] tracking-tight truncate text-sm lg:text-base">{pay.name}</span>
                <span className={`text-[8px] lg:text-[9px] font-black uppercase px-2 py-0.5 lg:px-3 lg:py-1 rounded-full tracking-wider whitespace-nowrap
                  ${pay.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pay.status === 'paid' ? 'Recibido' : 'Pendiente'}
                </span>
              </div>
              <div className="text-[10px] lg:text-xs font-bold text-[#1A1A1A]/50 italic">
                {pay.status === 'paid' ? 'Abonado' : 'Vence'} · {pay.time} 
                <span className="text-[#1A1A1A] font-black pl-2 tracking-tighter text-xs lg:text-sm">${pay.amount}</span>
              </div>
            </div>

            {index === 0 && (
              <motion.button 
                whileTap={{ scale: 0.85 }}
                className="w-10 h-10 lg:w-12 lg:h-12 bg-[#E2FF3B] rounded-xl lg:rounded-2xl flex items-center justify-center text-[#1A1A1A] shadow-lg border border-black/5 shrink-0"
              >
                <BellRing size={18} strokeWidth={3} />
              </motion.button>
            )}
          </motion.div>
        ))}
        {/* Connection Line */}
        <div className="absolute top-10 left-[35px] lg:left-[43px] bottom-10 w-0.5 bg-[#1A1A1A]/5 -z-10"></div>
      </div>
    </div>
  );
};

// ── LANDING PAGE PRINCIPAL MELO ──
const LandingPage: React.FC = () => {
  const { exchangeRate } = useExchangeRate();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
  };

  const itemVariants: Variants = {
    hidden: { y: 40, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <div className="relative min-h-screen bg-[#FBFBF9] text-[#1A1A1A] font-sans selection:bg-[#E2FF3B] overflow-x-hidden">
      <div className="fixed inset-0 z-[1] opacity-[0.06] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      {/* --- NAVEGACIÓN --- */}
      <motion.nav 
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 lg:px-16"
      >
        <div className="max-w-[1700px] mx-auto flex items-center justify-between py-4 lg:py-6">
          <div className="flex items-center gap-3 lg:gap-4 group">
            <motion.div 
              whileHover={{ rotate: [-2, 2, -2] }}
              className="w-9 h-9 lg:w-11 lg:h-11 bg-[#1A1A1A] text-[#E2FF3B] rounded-xl lg:rounded-2xl flex items-center justify-center font-black text-xl lg:text-2xl shadow-xl"
            >
              M
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-lg lg:text-xl font-black tracking-tighter uppercase italic">Melo</span>
              <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-[0.4em] text-black/20">Préstamos</span>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-10">
            {/* Rates on Header (Desktop) */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2.5 bg-[#1A1A1A] rounded-2xl shadow-xl">
              <div className="w-2 h-2 bg-[#E2FF3B] rounded-full animate-pulse shadow-[0_0_8px_#E2FF3B]"></div>
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Tasa BCV</span>
              <span className="text-sm font-black italic text-[#E2FF3B]">
                {exchangeRate?.rate ? `${exchangeRate.rate.toFixed(2)}` : '...'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-3">
              <Link to="/login" className="text-[10px] lg:text-[11px] font-black uppercase tracking-widest text-black/40 hover:text-black px-2 lg:px-4">Ingresar</Link>
              <Link to="/register" className="px-5 lg:px-10 py-3 lg:py-4 bg-[#E2FF3B] text-[#1A1A1A] rounded-[14px] lg:rounded-[18px] font-black text-[9px] lg:text-xs uppercase tracking-widest border border-black/10 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] lg:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                Pruébalo Gratis
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      <motion.main 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative z-10 pt-10 lg:pt-28 px-6 lg:px-16 max-w-[1700px] mx-auto pb-20"
      >
        {/* --- HERO SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <motion.div variants={itemVariants} className="lg:col-span-6 space-y-8 lg:space-y-10">

            {/* Mobile BCV Badge — Added per user request */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden inline-flex items-center gap-3 px-4 py-2.5 bg-[#1A1A1A] rounded-2xl shadow-xl w-fit"
            >
               <div className="w-2 h-2 bg-[#E2FF3B] rounded-full animate-pulse shadow-[0_0_8px_#E2FF3B]"></div>
               <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Tasa BCV Oficial</span>
               <span className="text-sm font-black italic text-[#E2FF3B]">
                 {exchangeRate?.rate ? `Bs. ${exchangeRate.rate.toFixed(2)}` : 'Cargando...'}
               </span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-[115px] font-[1000] leading-[0.85] lg:leading-[0.80] tracking-[-0.05em] lg:tracking-[-0.07em] uppercase italic text-balance">
              Control <br />
              <span className="text-transparent" style={{ WebkitTextStroke: '2px #1A1A1A' }}>Total de</span> <br />
              <span className="text-[#1A1A1A]">Préstamos.</span>
            </h1>

            <p className="text-base lg:text-xl text-black/60 max-w-xl leading-snug lg:leading-tight font-medium">
              Diseñado exclusivamente para <span className="text-black font-black">profesionales del préstamo.</span> Gestiona tu cartera, calcula intereses automáticamente y mantén el control de tus clientes morosos.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:gap-6 pt-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Link to="/register" className="group px-8 lg:px-14 py-5 lg:py-8 bg-[#1A1A1A] text-white rounded-[1.5rem] lg:rounded-[2.5rem] font-black text-lg lg:text-2xl flex items-center justify-center gap-4 shadow-2xl hover:bg-black transition-colors">
                  INICIAR PRUEBA <ArrowUpRight size={28} className="text-[#E2FF3B] group-hover:rotate-45 transition-transform" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Link to="/login" className="group px-8 lg:px-14 py-5 lg:py-8 bg-white text-[#1A1A1A] border-2 border-black/5 rounded-[1.5rem] lg:rounded-[2.5rem] font-black text-lg lg:text-2xl flex items-center justify-center gap-4 shadow-xl hover:bg-black/5 transition-colors">
                  INGRESAR
                </Link>
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#E2FF3B]" />
                <span className="text-[9px] lg:text-xs font-black uppercase tracking-widest text-black/40 italic">7 Días de Prueba Gratis</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-black/10 rounded-full"></div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#E2FF3B]" />
                <span className="text-[9px] lg:text-xs font-black uppercase tracking-widest text-black/40 italic">Sin tarjetas</span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-6 mt-10 lg:mt-0">
            <ActiveFlowVisual />
          </motion.div>
        </div>

        {/* --- FEATURES GRID (BENTO) --- */}
        <section className="py-24 lg:py-48">
          <div className="text-center mb-16 lg:mb-24 max-w-3xl mx-auto space-y-4">
            <h2 className="text-4xl md:text-7xl font-[1000] tracking-tight uppercase italic leading-[0.9]">Hecho para <span className="text-[#E2FF3B]" style={{ WebkitTextStroke: '1px #1A1A1A' }}>Prestamistas</span></h2>
            <p className="font-bold text-black/40 uppercase tracking-widest text-[10px] lg:text-sm italic px-4">Olvida las libretas y los errores de cálculo. Melo es tu aliado en la gestión de crédito.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* FEATURE: BCV AUTO-SYNC */}
            <div className="md:col-span-8 bg-white border border-black/5 p-8 lg:p-12 rounded-[3rem] lg:rounded-[4rem] shadow-xl hover:shadow-2xl transition-all duration-700 flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-5 lg:opacity-10 group-hover:opacity-20 transition-opacity">
                <Globe size={180} />
              </div>
              <div className="space-y-4 lg:space-y-6 relative z-10">
                <div className="w-14 h-14 lg:w-16 lg:h-16 bg-[#1A1A1A] text-[#E2FF3B] rounded-[18px] lg:rounded-[22px] flex items-center justify-center shadow-2xl">
                  <Activity size={32} strokeWidth={3} />
                </div>
                <h3 className="text-3xl lg:text-5xl font-black italic uppercase tracking-tighter">Cobros en <br /> Divisas y Bs.</h3>
                <p className="text-base lg:text-lg text-black/50 font-medium max-w-md">Calcula deudas en dólares pero recibe pagos en bolívares. Melo ajusta el monto automáticamente según la tasa BCV del día, protegiendo tu capital.</p>
              </div>
              <div className="mt-8 lg:mt-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span> Sincronizado con BCV
              </div>
            </div>

            {/* FEATURE: COBROS EXPRESS */}
            <div className="md:col-span-4 bg-[#1A1A1A] p-8 lg:p-10 rounded-[3rem] lg:rounded-[4rem] text-white flex flex-col justify-between shadow-2xl group hover:bg-black transition-colors">
              <div className="flex justify-between items-start mb-10">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-[#E2FF3B] text-[#1A1A1A] rounded-[18px] lg:rounded-[20px] flex items-center justify-center">
                  <Zap size={28} fill="currentColor" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/40 font-black tracking-widest uppercase">Efectividad</span>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-[#E2FF3B] mb-3">Control de <br /> Morosidad.</h3>
                <p className="text-white/40 text-[11px] font-bold leading-relaxed">Detecta clientes con retrasos al instante y gestiona intereses de mora sin complicarte con hojas de cálculo.</p>
              </div>
            </div>

            {/* FEATURE: REPORTERÍA BRUTA */}
            <div className="md:col-span-5 bg-[#E2FF3B] p-8 lg:p-12 rounded-[3rem] lg:rounded-[4rem] border-2 border-black flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] lg:shadow-[10px_10px_0px_0px_rgba(26,26,26,1)] min-h-[300px]">
              <PieChart size={40} className="text-[#1A1A1A]" />
              <div className="mt-10 lg:mt-20">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-[#1A1A1A] mb-3">Cartera <br /> Inteligente.</h3>
                <p className="text-[#1A1A1A]/60 text-sm font-bold">Visualiza cuánto capital tienes prestado, cuántos intereses has ganado y qué tan saludable es tu negocio de préstamos de un vistazo.</p>
              </div>
            </div>

            {/* FEATURE: SEGURIDAD NIVEL BANCO */}
            <div className="md:col-span-7 bg-white border border-black/5 p-8 lg:p-12 rounded-[3rem] lg:rounded-[4rem] shadow-xl flex flex-col md:flex-row gap-8 lg:gap-10 items-center overflow-hidden">
               <div className="flex-1 space-y-4 lg:space-y-6">
                  <Shield size={40} className="text-[#1A1A1A]" />
                  <h3 className="text-3xl lg:text-4xl font-black italic uppercase tracking-tighter">Privacidad por <br /> Defecto.</h3>
                  <p className="text-black/40 text-[13px] lg:text-sm font-medium leading-loose">Tus datos están protegidos y cifrados. Melo es una herramienta privada donde solo tú tienes acceso a la información de tus préstamos y clientes.</p>
               </div>
               <div className="w-full md:w-56 h-40 md:h-full bg-slate-50 rounded-[2.5rem] flex items-center justify-center p-6 border-2 border-dashed border-black/5">
                  <div className="text-center space-y-2">
                    <Target size={28} className="mx-auto text-black/20" />
                    <span className="block text-[8px] font-black uppercase tracking-widest text-black/20">Audit Trail Enabled</span>
                  </div>
               </div>
            </div>

            {/* PRODUCT MODULES LIST */}
            <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-6 lg:mt-10">
               {[
                 { icon: Smartphone, t: "Reporte de Clientes", s: "Base de datos digital" },
                 { icon: Users, t: "Registro de Préstamos", s: "Historial por deudor" },
                 { icon: Calendar, t: "Cuotas Automáticas", s: "Cálculo de capital e interés" },
                 { icon: Clock, t: "Alertas de Vencimiento", s: "Seguimiento riguroso" }
               ].map((mod, i) => (
                 <div key={i} className="bg-white/40 backdrop-blur-md p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] border border-black/5 flex items-center lg:flex-col text-left lg:text-center gap-4 lg:gap-4 hover:bg-white transition-all shadow-sm">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#1A1A1A] text-white rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                      <mod.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-[11px] lg:text-[13px] uppercase italic tracking-tighter leading-none">{mod.t}</h4>
                      <p className="text-[9px] font-bold text-black/30 uppercase mt-1 tracking-widest leading-none">{mod.s}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </section>

        {/* --- CALL TO ACTION --- */}
        <section className="py-24 lg:py-40 bg-[#1A1A1A] rounded-[3rem] lg:rounded-[5rem] px-6 lg:px-20 text-center relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.4)] mt-10">
          <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          <div className="absolute -top-1/2 -right-1/4 w-[400px] lg:w-[800px] h-[400px] lg:h-[800px] bg-[#E2FF3B]/10 rounded-full blur-[80px] lg:blur-[150px]"></div>
          
          <div className="relative z-10 space-y-8 lg:space-y-10">
            <h2 className="text-4xl md:text-9xl font-[1000] text-white italic uppercase tracking-tighter leading-none px-4">Profesionaliza <br className="hidden lg:block" /> tu <span className="text-[#E2FF3B]">Negocio.</span></h2>
            <p className="text-white/40 text-base lg:text-xl font-medium max-w-2xl mx-auto px-4 leading-snug">Melo gestiona tu prosperidad como gestor de crédito. Empieza hoy tus 7 días de prueba sin compromiso.</p>
            <Link to="/register" className="px-8 lg:px-16 py-6 lg:py-8 bg-[#E2FF3B] text-[#1A1A1A] rounded-full font-black text-lg lg:text-2xl uppercase italic tracking-tight shadow-[0_20px_50px_rgba(226,255,59,0.2)] flex items-center justify-center gap-4 lg:gap-6">
                Crear cuenta de gestor <Rocket size={24} className="lg:w-8 lg:h-8" />
              </Link>
          </div>
        </section>

      </motion.main>

      <footer className="relative z-10 py-20 lg:py-40 flex flex-col items-center text-center px-6">
        <h2 className="text-[18vw] font-black leading-none tracking-[-0.08em] uppercase italic text-black/5 select-none hover:text-black/10 transition-colors">MELO</h2>
        <div className="mt-[-4vw] lg:mt-[-6vw] space-y-6 lg:space-y-10">
           <div className="flex items-center gap-6 lg:gap-12 text-[8px] lg:text-[10px] font-black uppercase tracking-[0.3em] lg:tracking-[0.5em] text-black/30">
             <Link to="/terminos" className="hover:text-[#1A1A1A] transition-colors">Legal</Link>
             <Link to="/seguridad" className="hover:text-[#1A1A1A] transition-colors">Privacidad</Link>
             <Link to="/dashboard" className="hover:text-[#1A1A1A] transition-colors">Portal</Link>
           </div>
           <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-black/10">© 2026 Melo | Gestión de Préstamos. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;