import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege las rutas privadas.
 * Muestra una pantalla de carga premium mientras verifica la sesión.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate relative overflow-hidden">
        {/* Efecto de grano sutil */}
        <div className="absolute inset-0 bg-grain opacity-5 pointer-events-none"></div>
        
        {/* Luz ambiental de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pear/5 rounded-full blur-[120px] animate-pulse"></div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Contenedor del Logo/Icono */}
          <div className="relative mb-12">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center animate-in fade-in zoom-in duration-1000 shadow-2xl">
                 {/* Anillo de pulso exterior */}
                 <div className="absolute inset-0 rounded-[32px] border-2 border-pear/10 animate-ping duration-[3s]"></div>
                 
                 {/* Icono central con brillo */}
                 <div className="w-14 h-14 bg-pear text-slate rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(226,255,59,0.2)] transform -rotate-3">
                    <ShieldCheck size={32} strokeWidth={3} className="animate-pulse" />
                 </div>
              </div>
          </div>

          {/* Textos y Loader */}
          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <h2 className="text-pear font-black text-[10px] uppercase tracking-[0.6em] ml-2 animate-in slide-in-from-bottom-2 duration-700">
                Verificando Acceso
              </h2>
              <p className="text-white/20 font-bold text-[8px] uppercase tracking-widest leading-none">
                Sincronizando con el servidor de Melo
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
               <Loader2 size={18} className="text-pear/40 animate-spin" />
               <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className="w-1 h-1 bg-pear/60 rounded-full animate-bounce" 
                      style={{ animationDelay: `${i * 0.15}s` }}
                    ></div>
                  ))}
               </div>
            </div>
          </div>
        </div>

        {/* Branding Footer */}
        <div className="absolute bottom-12 left-0 right-0 text-center animate-in fade-in duration-1000 delay-500">
           <span className="text-white/10 font-black text-[9px] uppercase tracking-[0.5em] italic">Melo Finance Ecosystem</span>
        </div>
      </div>
    );
  }

  // Redirigir a login si el usuario no está autenticado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Renderizar contenido protegido
  return <>{children}</>;
};

export default ProtectedRoute;
