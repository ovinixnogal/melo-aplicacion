import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  User as UserIcon, 
  Settings, 
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
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../api/firebase';
import { signOut, updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (window.confirm('¿Seguro que deseas cerrar sesión?')) {
      await signOut(auth);
      navigate('/login');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setLoading(true);
    try {
      await updateProfile(firebaseUser, { displayName });
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, { displayName });
      
      let needsRelogin = false;

      // Update Email
      if (email.trim() && email !== firebaseUser.email) {
        await updateEmail(firebaseUser, email.trim());
        await updateDoc(userRef, { email: email.trim() });
      }

      // Update Password
      if (password.trim() && password.length >= 6) {
        await updatePassword(firebaseUser, password);
        needsRelogin = true;
      }
      
      setIsEditing(false);
      setPassword('');
      
      if (needsRelogin) {
        alert('Clave actualizada con éxito. Por seguridad, debes iniciar sesión nuevamente.');
        handleSignOut();
      } else {
        alert('Configuración actualizada con éxito');
        window.location.reload(); 
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Por razones de seguridad, debes cerrar sesión y volver a entrar para cambiar tu correo o clave.');
      } else {
        alert('Error actualizando la configuración: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 md:p-12 space-y-8 animate-in fade-in duration-700 pb-36 md:pb-16 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h4 className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-400 flex items-center gap-2">
            <Settings size={12} className="text-gray-300" /> Preferencias
          </h4>
          <h1 className="text-4xl md:text-6xl font-black text-slate tracking-tighter italic leading-none">
            Configuración
            <span className="text-pear italic">.</span>
          </h1>
          <p className="text-gray-400 font-bold text-xs tracking-tight">Administración de cuenta y ecosistema</p>
        </div>
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
        
        {/* COLUMNA IZQUIERDA: Tarjeta de Perfil & Plan */}
        <div className="lg:col-span-1 space-y-8">
           
           {/* IDENTITY CARD */}
           <div className="bg-slate p-8 rounded-[44px] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex flex-col items-center text-center relative z-10 pt-4">
                 <div className="w-28 h-28 rounded-full bg-pear text-slate flex items-center justify-center text-4xl font-[900] shadow-xl shadow-pear/20 group-hover:scale-105 transition-transform duration-500 border-4 border-slate">
                   {getInitials(user?.displayName)}
                 </div>
                 
                 <div className="mt-6 space-y-1">
                    <h2 className="text-2xl font-black italic tracking-tighter truncate max-w-[200px]">
                      {user?.displayName || 'Usuario Melo'}
                    </h2>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 truncate max-w-[200px]">{user?.email}</p>
                 </div>
                 
                 <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="mt-8 w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                 >
                    <UserIcon size={14} /> Editar Perfil
                 </button>
              </div>
           </div>
        </div>

        {/* COLUMNA DERECHA: Ajustes y Formulario */}
        <div className="lg:col-span-2 space-y-8">
           
           {isEditing ? (
             <div className="bg-white p-8 md:p-12 rounded-[44px] border border-slate/5 shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black italic tracking-tighter text-slate">Editar Perfil</h3>
                  <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-slate"><ChevronRight size={24} /></button>
                </div>
                
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                   <div className="space-y-4">
                      {/* Name */}
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2">Nombre Comercial</label>
                         <input 
                            type="text" 
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-6 py-5 bg-gray-50/50 border-2 border-slate/5 focus:border-pear rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300"
                            placeholder="Ej. Inversiones Melo"
                            required
                         />
                      </div>
                      
                      {/* Email */}
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2">Correo Electrónico</label>
                         <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-5 bg-gray-50/50 border-2 border-slate/5 focus:border-pear rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300"
                            placeholder="correo@ejemplo.com"
                         />
                      </div>
                      
                      {/* Password */}
                      <div className="space-y-2 pt-2">
                         <div className="flex items-center justify-between ml-2 mb-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate">Nueva Clave</label>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Opcional</span>
                         </div>
                         <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-6 py-5 bg-gray-50/50 border-2 border-slate/5 focus:border-pear rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300"
                            placeholder="Min. 6 caracteres"
                            minLength={6}
                         />
                         <p className="text-[10px] font-bold text-gray-400 mt-2 ml-2 leading-relaxed max-w-sm">Si cambias el correo o la clave, el sistema cerrará tu sesión por políticas de seguridad bancaria.</p>
                      </div>
                   </div>
                   <div className="pt-4 flex justify-end gap-3">
                      <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-slate transition-colors">Cancelar</button>
                      <button type="submit" disabled={loading} className="px-10 py-5 bg-slate text-pear rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50">
                         {loading ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                   </div>
                </form>
             </div>
           ) : (
             <div className="space-y-6">
                
                {/* CONFIGURACIÓN MÓDULO */}
                <div>
                   <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 ml-4">Configuración</h3>
                   <div className="bg-white rounded-[40px] border border-slate/5 shadow-xl overflow-hidden divide-y divide-slate/5">
                      <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-gray-100 text-gray-400 group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center">
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
                            <div className="w-12 h-12 bg-gray-100 text-gray-400 group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center">
                               <ShieldCheck size={20} />
                            </div>
                            <div>
                               <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Verificación y Seguridad</h4>
                               <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Configura autenticación de acceso</p>
                            </div>
                         </div>
                         <ChevronRight className="text-gray-300 group-hover:text-pear transition-colors" size={20} />
                      </div>
                      
                      <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-not-allowed opacity-60">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-gray-100 text-gray-400 group-hover:bg-slate group-hover:text-pear transition-colors rounded-[20px] flex items-center justify-center">
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
                <div>
                   <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 mt-8 ml-4">Asistencia</h3>
                   <div className="bg-white rounded-[40px] border border-slate/5 shadow-xl overflow-hidden divide-y divide-slate/5">
                      <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => alert("Centro de Ayuda abriendo...")}>
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-[20px] flex items-center justify-center group-hover:scale-105 transition-transform">
                               <HelpCircle size={20} />
                            </div>
                            <div>
                               <h4 className="font-black text-slate text-[15px] uppercase italic tracking-tight">Centro de Ayuda</h4>
                               <p className="text-[10px] font-bold text-gray-400 tracking-wide mt-1">Dudas frecuentes y tutoriales básicos</p>
                            </div>
                         </div>
                         <ExternalLink className="text-gray-300 group-hover:text-sky-500 transition-colors" size={18} />
                      </div>
                      <div className="p-8 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => alert("Abriendo chat de soporte técnico...")}>
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-[20px] flex items-center justify-center group-hover:scale-105 transition-transform">
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
                <div>
                   <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 mt-8 ml-4">Acerca De</h3>
                   <div className="bg-white rounded-[40px] border border-slate/5 shadow-xl overflow-hidden p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate text-pear rounded-[24px] flex items-center justify-center mb-6 shadow-2xl">
                         <Info size={28} />
                      </div>
                      <h4 className="font-black text-slate text-xl uppercase italic tracking-tight">MELO</h4>
                      <p className="text-xs font-bold text-gray-400 tracking-wide mt-2 max-w-xs leading-relaxed">
                         Diseñado con tecnología de punta para la gestión de créditos inteligente, resiliencia inflacionaria y auditoría centralizada en tiempo real.
                      </p>
                      <span className="mt-6 px-4 py-1.5 bg-gray-50 text-gray-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-gray-100">
                         Versión 2.0.0 (Cloud Sync)
                      </span>
                   </div>
                </div>

             </div>
           )}


        </div>

      </div>
    </div>
  );
};

export default ProfilePage;

