import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import type { AdminUser } from '../../hooks/useAdmin';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Search, 
  ShieldBan, 
  ShieldCheck, 
  X, 
  Save, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus,
  Check,
  AlertCircle
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../api/firebase';

const PAGE_SIZE = 20;

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active:   'bg-emerald-100 text-emerald-700',
    trial:    'bg-sky-100 text-sky-700',
    inactive: 'bg-red-100 text-red-600',
  };
  const labels: Record<string, string> = {
    active: 'Activa', trial: 'Prueba', inactive: 'Inactiva'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
};

const AdminUsers: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { users, loadingUsers, fetchUsers, banUser, unbanUser, editUser, registerUser } = useAdmin();
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);

  // Formulario Registro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPaid, setRegPaid] = useState(false);

  // Formulario Editar
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u =>
    (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const page_data = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPass) {
       setError("Completa todos los campos obligatorios");
       return;
    }
    setSaving(true);
    setError(null);
    try {
      await registerUser({
        displayName: regName,
        email: regEmail,
        password: regPass,
        hasSubscription: regPaid,
        adminUid: adminUser?.uid || ''
      });
      setShowRegisterModal(false);
      setRegName(''); setRegEmail(''); setRegPass(''); setRegPaid(false);
    } catch (err: any) {
      setError(err.message || "Error al registrar usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    await editUser(editModal.uid, { displayName: editName, email: editEmail });
    setSaving(false);
    setEditModal(null);
  };

  const handleResetPassword = async (email: string) => {
    if (!email) return;
    await sendPasswordResetEmail(auth, email);
    alert(`Correo de reseteo enviado a ${email}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate uppercase">
            Usuarios<span className="text-pear">.</span>
          </h2>
          <p className="text-gray-400 font-bold text-xs mt-1">Gestión administrativa de la cartera de clientes de Melo.</p>
        </div>
        
        <button 
          onClick={() => { setShowRegisterModal(true); setError(null); }}
          className="flex items-center justify-center gap-3 px-8 py-5 bg-slate text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-gray-800 transition-all hover:-translate-y-1 group"
        >
          Registrar Usuario <UserPlus size={18} className="text-pear group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl group">
        <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nombre o correo electrónico..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate/5 rounded-[30px] text-sm font-bold text-slate focus:outline-none focus:border-pear shadow-sm transition-all"
        />
      </div>

      {/* Users Table */}
      {loadingUsers ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-slate/5 border-t-pear rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Cargando base de datos...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-slate/5 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-slate/5 bg-gray-50/50">
                  <th className="px-8 py-6">Información General</th>
                  <th className="px-8 py-6">Estado Cuenta</th>
                  <th className="px-8 py-6 hidden md:table-cell">Registrado</th>
                  <th className="px-8 py-6 hidden lg:table-cell">Volumen</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {page_data.map(u => (
                  <tr key={u.uid} className={`hover:bg-vanilla/10 transition-colors ${u.banned ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate text-pear flex items-center justify-center text-xs font-black shadow-lg">
                          {(u.displayName || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate uppercase italic tracking-tight">{u.displayName || 'Sin nombre'}</p>
                          <p className="text-[10px] font-bold text-gray-300 flex items-center gap-1">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                         <StatusBadge status={u.subscription?.status || 'inactive'} />
                         {u.banned && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1"><ShieldBan size={10} /> Cuenta Baneada</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5 hidden md:table-cell">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {u.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-8 py-5 hidden lg:table-cell">
                       <div className="flex gap-4">
                          <div className="text-center">
                             <p className="text-xs font-black text-slate leading-none">{u.clientsCount || 0}</p>
                             <p className="text-[7px] font-bold text-gray-300 uppercase tracking-widest mt-1">Clientes</p>
                          </div>
                          <div className="text-center">
                             <p className="text-xs font-black text-slate leading-none">{u.loansCount || 0}</p>
                             <p className="text-[7px] font-bold text-gray-300 uppercase tracking-widest mt-1">Préstamos</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => { setEditModal(u); setEditName(u.displayName || ''); setEditEmail(u.email || ''); }}
                          className="px-5 py-2.5 bg-slate text-pear rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                        >
                          Editar
                        </button>
                        {u.banned
                          ? <button onClick={() => unbanUser(u.uid)} className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"><ShieldCheck size={14} /> Activar</button>
                          : <button onClick={() => { if (window.confirm('¿Banear usuario?')) banUser(u.uid); }} className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"><ShieldBan size={14} /> Banear</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-8 py-6 border-t border-slate/5 flex items-center justify-between bg-gray-50/50">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Página {page} de {totalPages}</span>
              <div className="flex items-center gap-3">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-3 rounded-xl bg-white border border-slate/5 hover:bg-slate hover:text-pear disabled:opacity-30 transition-all shadow-sm">
                  <ChevronLeft size={18} />
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-3 rounded-xl bg-white border border-slate/5 hover:bg-slate hover:text-pear disabled:opacity-30 transition-all shadow-sm">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REGISTER MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border-4 border-slate">
              <div className="p-10 sm:p-12 space-y-8">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <h3 className="text-3xl font-black italic text-slate uppercase tracking-tighter">Nuevo Usuario</h3>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Registro manual de cliente corporativo</p>
                    </div>
                    <button onClick={() => setShowRegisterModal(false)} className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 hover:text-slate rounded-2xl transition-all"><X size={24} /></button>
                 </div>

                 {error && (
                   <div className="p-5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border-2 border-rose-100 flex items-center gap-3">
                      <AlertCircle size={18} /> {error}
                   </div>
                 )}

                 <form onSubmit={handleRegister} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40 ml-4">Nombre Completo</label>
                          <input 
                            required
                            value={regName} 
                            onChange={e => setRegName(e.target.value)} 
                            placeholder="Nombre del usuario..."
                            className="w-full px-6 py-5 bg-vanilla/30 border-2 border-transparent focus:border-slate rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300" 
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40 ml-4">Correo Electrónico</label>
                          <input 
                            required
                            type="email"
                            value={regEmail} 
                            onChange={e => setRegEmail(e.target.value)} 
                            placeholder="usuario@ejemplo.com"
                            className="w-full px-6 py-5 bg-vanilla/30 border-2 border-transparent focus:border-slate rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300" 
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40 ml-4">Contraseña Inicial</label>
                          <input 
                            required
                            type="password"
                            value={regPass} 
                            onChange={e => setRegPass(e.target.value)} 
                            placeholder="Mínimo 6 caracteres"
                            className="w-full px-6 py-5 bg-vanilla/30 border-2 border-transparent focus:border-slate rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all placeholder:text-gray-300" 
                          />
                       </div>
                       <div className="flex flex-col justify-end pb-1 px-4">
                          <label className="flex items-center gap-4 cursor-pointer group">
                             <div className="relative">
                                <input 
                                  type="checkbox" 
                                  className="sr-only" 
                                  checked={regPaid}
                                  onChange={e => setRegPaid(e.target.checked)}
                                />
                                <div className={`w-14 h-8 rounded-full transition-all duration-300 ${regPaid ? 'bg-pear' : 'bg-gray-200'}`}></div>
                                <div className={`absolute top-1 left-1.5 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-md ${regPaid ? 'translate-x-5' : ''}`}></div>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-tight text-slate">Activar Suscripción</span>
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Registrar pago de $3.00 USD</span>
                             </div>
                          </label>
                       </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={saving}
                      className="w-full py-6 bg-slate text-pear rounded-[28px] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                       {saving ? 'Procesando...' : (
                         <>Crear Cuenta y Finalizar <Check size={18} /></>
                       )}
                    </button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-slate/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-xl p-10 sm:p-12 shadow-2xl animate-in zoom-in-95 border-4 border-slate">
            <div className="flex items-center justify-between mb-10">
              <div className="space-y-1">
                <h3 className="text-3xl font-black italic text-slate uppercase tracking-tighter">Editar Perfil</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Modificación de datos del usuario</p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 hover:text-slate rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="space-y-6 mb-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40 ml-4">Nombre Público</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-6 py-5 bg-vanilla/30 border-2 border-transparent focus:border-slate rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40 ml-4">Correo Electrónico</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="w-full px-6 py-5 bg-vanilla/30 border-2 border-transparent focus:border-slate rounded-[24px] text-sm font-bold text-slate focus:outline-none transition-all" />
              </div>

              {/* Password Section */}
              <div className="p-6 bg-amber-50 rounded-[28px] border-2 border-amber-100 flex items-start gap-4">
                 <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20"><AlertCircle size={20} /></div>
                 <div>
                    <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-tight">Seguridad de la Cuenta</h4>
                    <p className="text-[9px] font-medium text-amber-600/80 leading-relaxed mt-1">Por políticas de Firebase, no es posible sobrescribir la clave directamente. El usuario debe usar la función de restablecimiento.</p>
                    <button 
                      onClick={() => handleResetPassword(editModal.email || '')} 
                      className="mt-4 flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                      <RotateCcw size={14} /> Resetear e Informar al Usuario
                    </button>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setEditModal(null)} className="flex-1 py-5 bg-gray-100 text-gray-400 rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                Cancelar
              </button>
              <button onClick={handleEdit} disabled={saving} className="flex-[2] flex items-center justify-center gap-3 py-6 bg-slate text-pear rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
                {saving ? 'Guardando...' : <><Save size={16} /> Guardar Cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
