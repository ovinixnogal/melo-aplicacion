import React from 'react';
import { 
  ShieldCheck, 
  Bell, 
  Smartphone,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Info,
  ExternalLink,
  Lock
} from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 md:pb-16 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">

          <h1 className="text-3xl md:text-5xl font-black text-slate tracking-tighter italic leading-none">
            Ajustes
            <span className="text-pear italic">.</span>
          </h1>
          <p className="text-gray-400 font-bold text-xs tracking-tight">Preferencias globales y centro de ayuda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
         
         {/* CONFIGURACIÓN MÓDULO */}
         <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 ml-4">Preferencias</h3>
            <div className="bg-white rounded-[40px] border border-slate/5 shadow-xl overflow-hidden divide-y divide-slate/5">
               <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-vanilla text-slate group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center shadow-sm">
                        <Bell size={20} />
                     </div>
                     <div>
                        <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Notificaciones In-App</h4>
                        <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Habilitadas en tu flujo de trabajo</p>
                     </div>
                  </div>
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative shadow-inner">
                     <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-md"></div>
                  </div>
               </div>

               <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-vanilla text-slate group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center shadow-sm">
                        <ShieldCheck size={20} />
                     </div>
                     <div>
                        <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Seguridad Biométrica</h4>
                        <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Habilitar en dispositivos móviles</p>
                     </div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-pear transition-colors" size={20} />
               </div>
               
               <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-not-allowed opacity-60">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-vanilla text-slate group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center shadow-sm">
                        <CreditCard size={20} />
                     </div>
                     <div>
                        <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Cuentas Receptoras</h4>
                        <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Gestión de Zelle, Pago Móvil (Próximamente)</p>
                     </div>
                  </div>
                  <Lock className="text-gray-300" size={16} />
               </div>
            </div>
         </div>

         {/* AYUDA Y SOPORTE MÓDULO */}
         <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 ml-4">Asistencia y Soporte</h3>
            <div className="bg-white rounded-[40px] border border-slate/5 shadow-xl overflow-hidden divide-y divide-slate/5">
               <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.open("https://wa.me/584124898715", "_blank")}>
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-[20px] flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                        <HelpCircle size={20} />
                     </div>
                     <div>
                        <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Centro de Ayuda</h4>
                        <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Dudas frecuentes y tutoriales básicos</p>
                     </div>
                  </div>
                  <ExternalLink className="text-gray-300 group-hover:text-sky-500 transition-colors" size={18} />
               </div>
               <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.open("https://wa.me/584124898715", "_blank")}>
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-[20px] flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                        <Smartphone size={20} />
                     </div>
                     <div>
                        <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Contactar Soporte Técnico</h4>
                        <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Asistencia directa con agentes Melo</p>
                     </div>
                  </div>
                  <ExternalLink className="text-gray-300 group-hover:text-indigo-500 transition-colors" size={18} />
               </div>
            </div>
         </div>

         {/* ACERCA DE MÓDULO */}
         <div className="md:col-span-2 pt-8">
            <div className="bg-slate rounded-[56px] border border-white/5 shadow-2xl overflow-hidden p-10 md:p-14 flex flex-col items-center justify-center text-center relative">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pear to-emerald-400"></div>
               <div className="w-20 h-20 bg-white/5 text-pear rounded-[28px] flex items-center justify-center mb-8 shadow-inner border border-white/5">
                  <Info size={32} />
               </div>
               <h4 className="font-black text-white text-2xl uppercase italic tracking-tighter">Melo Finance Ecosystem</h4>
               <p className="text-white/40 text-sm mt-4 max-w-lg font-medium leading-relaxed italic">
                  "La plataforma que empodera a los gestores de préstamos con tecnología de vanguardia y análisis en tiempo real."
               </p>
               <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <span className="px-5 py-2 bg-white/5 text-white/40 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                     Engine v3.4.2
                  </span>
                  <span className="px-5 py-2 bg-pear text-slate rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                     Cloud Node Active
                  </span>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

export default SettingsPage;
