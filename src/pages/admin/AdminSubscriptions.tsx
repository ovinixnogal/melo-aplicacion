import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import type { AdminUser } from '../../hooks/useAdmin';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, 
  CalendarDays, 
  Gift, 
  Search, 
  History, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    trial: 'bg-sky-100 text-sky-700',
    inactive: 'bg-rose-100 text-rose-600',
  };
  const labels: Record<string, string> = { active: 'Inversión Activa', trial: 'Periodo Prueba', inactive: 'Expirada' };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
};

const AdminSubscriptions: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { users, loadingUsers, fetchUsers, grantFreeAccess, cancelSubscriptionEntry } = useAdmin();
  
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [historyModal, setHistoryModal] = useState<AdminUser | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 5;

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    const matchesSearch = 
      (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    return matchesSearch && (u.subscription?.status || 'inactive') === filter;
  });

  const getDaysRemaining = (user: AdminUser): number => {
    const end = user.subscription?.currentPeriodEnd?.toDate();
    if (!end) return 0;
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleCancelEntry = async (userUid: string, index: number) => {
    if (!window.confirm("¿Estás seguro de cancelar este período de suscripción? Esto restará 30 días de la fecha de vencimiento actual.")) return;
    await cancelSubscriptionEntry(userUid, index);
    // Actualizar el modal si sigue abierto
    if (historyModal && historyModal.uid === userUid) {
       const updatedUser = users.find(u => u.uid === userUid);
       if (updatedUser) setHistoryModal(updatedUser);
    }
  };

  const tabs: { label: string; value: typeof filter }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Activos', value: 'active' },
    { label: 'En Prueba', value: 'trial' },
    { label: 'Inactivos', value: 'inactive' },
  ];

  // Pagination for History Modal
  const historyEntries = historyModal?.subscriptionHistory || [];
  const totalHistoryPages = Math.ceil(historyEntries.length / HISTORY_PAGE_SIZE);
  const currentHistoryEntries = [...historyEntries].reverse().slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate uppercase">
            Suscripciones<span className="text-pear">.</span>
          </h2>
          <p className="text-gray-400 font-bold text-xs mt-1">Control de vigencia de las cuentas del sistema.</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-6">
         {/* Search */}
         <div className="relative flex-1 group">
           <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate transition-colors" />
           <input
             type="text"
             placeholder="Buscar usuario por nombre o correo..."
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate/5 rounded-[30px] text-sm font-bold text-slate focus:outline-none focus:border-pear shadow-sm transition-all"
           />
         </div>

         {/* Filters */}
         <div className="flex bg-white/50 p-1.5 rounded-[24px] border border-slate/5 shadow-sm overflow-x-auto no-scrollbar">
            {tabs.map(t => (
               <button
                  key={t.value}
                  onClick={() => setFilter(t.value)}
                  className={`px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                  ${filter === t.value ? 'bg-slate text-pear shadow-xl' : 'text-gray-400 hover:text-slate'}`}
               >
                  {t.label}
               </button>
            ))}
         </div>
      </div>

      {loadingUsers ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-slate/5 border-t-pear rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sincronizando estados...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-slate/5 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-slate/5 bg-gray-50/50">
                  <th className="px-8 py-6">Información de Usuario</th>
                  <th className="px-8 py-6">Estado</th>
                  <th className="px-8 py-6 hidden md:table-cell">Vigencia Actual</th>
                  <th className="px-8 py-6">Vencimiento</th>
                  <th className="px-8 py-6 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {filtered.map(u => {
                  const end = u.subscription?.currentPeriodEnd?.toDate();
                  const endStr = end?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '—';
                  const days = getDaysRemaining(u);
                  return (
                    <tr key={u.uid} className="hover:bg-vanilla/10 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate text-pear flex items-center justify-center text-xs font-black shadow-lg">
                            {(u.displayName || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate uppercase italic tracking-tight">{u.displayName || 'Sin nombre'}</p>
                            <p className="text-[10px] font-bold text-gray-300">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5"><StatusBadge status={u.subscription?.status || 'inactive'} /></td>
                      <td className="px-8 py-5 hidden md:table-cell">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate uppercase tracking-tight">
                          <Clock size={14} className="text-pear" />
                          {u.subscription?.status === 'trial' ? 'Abono 7 días' : '$3.00 USD / Mes'}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                           <span className={`text-xs font-black italic ${days < 5 ? 'text-rose-500' : 'text-slate'}`}>{endStr}</span>
                           <span className={`text-[8px] font-bold uppercase tracking-widest ${days < 5 ? 'text-rose-400' : 'text-gray-300'}`}>
                             {days > 0 ? `Quedan ${days} días` : 'Cuenta vencida'}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setHistoryModal(u); setHistoryPage(1); }}
                            className="p-3 bg-slate text-pear rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-lg group"
                            title="Ver Historial"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`¿Regalar 30 días a ${u.displayName}?`)) grantFreeAccess(u.uid, adminUser?.uid || ''); }}
                            className="px-6 py-3 bg-pear text-slate rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-pear/10"
                          >
                            <Gift size={14} /> Regalo 30d
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-24 text-center">
               <TrendingUp size={48} className="mx-auto text-gray-100 mb-4" />
               <p className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">No hay coincidencias en el historial</p>
            </div>
          )}
        </div>
      )}

      {/* HISTORY MODAL */}
      {/* HISTORY MODAL */}
      {historyModal && (
        <div className="fixed inset-0 bg-slate/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] sm:rounded-[56px] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-3xl animate-in fade-in zoom-in-95 duration-300 border border-slate/5 flex flex-col">
              <div className="p-6 sm:p-14 overflow-y-auto no-scrollbar">
                 <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-10">
                    <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                       <div className="w-16 h-16 rounded-3xl bg-slate text-pear flex items-center justify-center text-xl font-black shadow-2xl transform -rotate-3">
                          {(historyModal.displayName || 'U').substring(0, 2).toUpperCase()}
                       </div>
                       <div>
                          <h3 className="text-xl sm:text-2xl font-black italic text-slate uppercase tracking-tighter">Historial de Subscripciones</h3>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{historyModal.displayName} — {historyModal.email}</p>
                       </div>
                    </div>
                    <button onClick={() => setHistoryModal(null)} className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-gray-100 text-gray-400 hover:text-slate rounded-[18px] sm:rounded-[24px] transition-all"><X size={24} /></button>
                 </div>

                 <div className="bg-gray-50/50 rounded-[32px] sm:rounded-[40px] border-2 border-slate/5 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[500px]">
                         <thead>
                            <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-slate/5">
                               <th className="px-8 py-6">Evento / Método</th>
                               <th className="px-8 py-6">Fecha Registro</th>
                               <th className="px-8 py-6">Extensión</th>
                               <th className="px-8 py-6 text-right">Acción</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate/5">
                            {currentHistoryEntries.map((h, i) => {
                               const idx = historyEntries.length - 1 - ((historyPage - 1) * HISTORY_PAGE_SIZE + i);
                               
                               // Safe Date Conversion
                               const d = (h.date as any)?.toDate ? (h.date as any).toDate() : new Date(h.date as any);
                               const eDate = (h.end as any)?.toDate ? (h.end as any).toDate() : (h.end ? new Date(h.end as any) : null);
                               
                               return (
                                  <tr key={i} className="hover:bg-white transition-colors">
                                     <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                           <span className="text-[10px] font-black text-slate uppercase tracking-tight line-clamp-1">{h.status || 'Pago'}</span>
                                           <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">{h.method || 'Manual'} — {h.notes || h.note || 'Sin nota'}</span>
                                        </div>
                                     </td>
                                     <td className="px-8 py-5 text-[10px] font-bold text-gray-500">{d.toLocaleDateString()}</td>
                                     <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                                           {eDate ? '+30 Días' : 'N/A'}
                                        </span>
                                     </td>
                                     <td className="px-8 py-5 text-right">
                                        <button 
                                          onClick={() => handleCancelEntry(historyModal.uid, idx)}
                                          className="p-2.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                          title="Cancelar este período"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     </td>
                                  </tr>
                               );
                            })}
                         </tbody>
                      </table>
                    </div>
                    {historyEntries.length === 0 && (
                       <div className="py-12 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">Sin registros históricos</div>
                    )}
                 </div>

                 {/* Modal Pagination */}
                 {totalHistoryPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-8 px-4">
                       <div className="flex items-center gap-2">
                          {[...Array(totalHistoryPages)].map((_, i) => (
                             <button
                                key={i}
                                onClick={() => setHistoryPage(i + 1)}
                                className={`w-8 h-8 rounded-xl font-black text-[9px] transition-all active:scale-90 ${historyPage === i + 1 ? 'bg-slate text-pear shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                             >
                                {i + 1}
                             </button>
                          ))}
                       </div>
                       <div className="flex items-center gap-3">
                          <button 
                             disabled={historyPage === 1} 
                             onClick={() => setHistoryPage(p => p - 1)}
                             className="p-3 bg-white border border-slate/5 text-slate rounded-2xl disabled:opacity-20 transition-all shadow-sm hover:shadow-md active:scale-90"
                          >
                             <ChevronLeft size={18} />
                          </button>
                          <button 
                             disabled={historyPage === totalHistoryPages} 
                             onClick={() => setHistoryPage(p => p + 1)}
                             className="p-3 bg-white border border-slate/5 text-slate rounded-2xl disabled:opacity-20 transition-all shadow-sm hover:shadow-md active:scale-90"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </div>
                    </div>
                 )}

                 <div className="mt-12 p-6 sm:p-8 bg-slate text-white rounded-[32px] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-pear text-slate rounded-2xl flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(226,255,59,0.2)]">
                          <CalendarDays size={24} strokeWidth={3} />
                       </div>
                       <div>
                          <p className="text-[8px] font-bold text-pear uppercase tracking-[0.3em]">Expiración Final</p>
                          <p className="text-base sm:text-lg font-black italic tracking-tighter">
                            {historyModal.subscription?.currentPeriodEnd?.toDate()?.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) || 'No definida'}
                          </p>
                       </div>
                    </div>
                    <div className="text-center sm:text-right">
                       <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Estado Sistema</p>
                       <StatusBadge status={historyModal.subscription?.status || 'inactive'} />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptions;
