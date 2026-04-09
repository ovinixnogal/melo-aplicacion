import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import type { AdminUser, SubscriptionPayment } from '../../hooks/useAdmin';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, 
  Search, 
  Receipt, 
  Ban, 
  Plus, 
  User, 
  ChevronRight, 
  DollarSign,
  AlertCircle,
  Clock
} from 'lucide-react';

const AdminPayments: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { 
    payments, 
    users, 
    loadingPayments, 
    fetchPayments, 
    fetchUsers, 
    registerManualPayment,
    annulPayment
  } = useAdmin();

  const [search, setSearch] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  
  // Payment Form
  const [formAmount] = useState('3');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'VES'>('USD');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const bcvRate = parseFloat(localStorage.getItem('melo_finance_bcv_rate') || '60');

  useEffect(() => {
    fetchPayments();
    fetchUsers();
  }, []);

  const filteredPayments = payments.filter(p => {
    const term = search.toLowerCase();
    return (
      (p.userName || '').toLowerCase().includes(term) ||
      (p.notes || '').toLowerCase().includes(term)
    );
  });

  const filteredUsers = users.filter(u => {
    const term = userSearch.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  });

  const handleRegister = async () => {
    if (!selectedUser || !adminUser) return;
    setSaving(true);
    const amount = parseFloat(formAmount);
    const amountBs = formCurrency === 'VES' ? amount * bcvRate : 0;
    
    await registerManualPayment(
      selectedUser.uid,
      amount,
      formCurrency,
      bcvRate,
      amountBs,
      formNotes,
      adminUser.uid
    );
    
    setSaving(false);
    setRegisterOpen(false);
    setSelectedUser(null);
    setFormNotes('');
  };

  const handleAnnul = async (p: SubscriptionPayment) => {
    if (!adminUser) return;
    if (!window.confirm(`¿Seguro que deseas anular el pago de $${p.amount} de ${p.userName}? Esta acción lo marcará como anulado y restará vigencia al usuario.`)) return;
    await annulPayment(p.id, adminUser.uid);
  };

  const statusStyles: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-rose-100 text-rose-700',
    annulled: 'bg-gray-100 text-gray-500 line-through'
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate uppercase">
            Gestión Pagos<span className="text-pear">.</span>
          </h2>
          <p className="text-gray-400 font-bold text-xs mt-1">Suscripciones manuales y auditoría de ingresos bimonetarios.</p>
        </div>
        <button
          onClick={() => setRegisterOpen(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-slate text-pear rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
        >
          <Plus size={18} /> Registrar Cobro
        </button>
      </div>

      {/* Stats/Search */}
      <div className="relative group max-w-2xl">
        <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate transition-colors" />
        <input
          type="text"
          placeholder="Buscar auditoría por usuario o referencia..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate/5 rounded-[30px] text-sm font-bold text-slate focus:outline-none focus:border-pear shadow-sm transition-all"
        />
      </div>

      {/* Main Table */}
      {loadingPayments ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-12 h-12 border-4 border-slate/5 border-t-pear rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Cargando transacciones...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-slate/5 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-slate/5 bg-gray-50/50">
                  <th className="px-8 py-6">Usuario / Fecha</th>
                  <th className="px-8 py-6">Monto Total</th>
                  <th className="px-8 py-6 hidden lg:table-cell">Bimonetario (BS)</th>
                  <th className="px-8 py-6">Referencia</th>
                  <th className="px-8 py-6">Estado</th>
                  <th className="px-8 py-6 text-right">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {filteredPayments.map(p => {
                  const date = (p.date as any)?.toDate?.() ?? new Date(p.date as any);
                  const isAnnulled = p.status === 'annulled';
                  return (
                    <tr key={p.id} className={`hover:bg-vanilla/10 transition-colors ${isAnnulled ? 'opacity-50' : ''}`}>
                      <td className="px-8 py-6">
                         <div className="flex flex-col">
                            <span className="text-sm font-black text-slate uppercase tracking-tighter">{p.userName}</span>
                            <span className="text-[10px] font-bold text-gray-400">{date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">
                               <DollarSign size={14} />
                            </div>
                            <span className="text-base font-black text-slate italic">${p.amount.toFixed(2)}</span>
                            {p.currency === 'VES' && <span className="text-[9px] font-black text-pear bg-slate px-1.5 py-0.5 rounded-md uppercase">Pagado en BS</span>}
                         </div>
                      </td>
                      <td className="px-8 py-6 hidden lg:table-cell">
                         {p.amountBs ? (
                            <div className="flex flex-col">
                               <span className="text-[11px] font-black text-emerald-600">Bs. {p.amountBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                               <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Tasa: {p.exchangeRate}</span>
                            </div>
                         ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase">N/A</span>
                         )}
                      </td>
                      <td className="px-8 py-6">
                         <p className="text-[10px] font-black text-slate uppercase tracking-tight line-clamp-1">{p.notes || 'S/R'}</p>
                      </td>
                      <td className="px-8 py-6">
                         <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusStyles[p.status]}`}>
                            {p.status === 'paid' ? 'Efectivo' : p.status === 'annulled' ? 'Anulado' : p.status}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         {!isAnnulled && (
                            <button
                               onClick={() => handleAnnul(p)}
                               className="p-3 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                               title="Anular Transacción"
                            >
                               <Ban size={18} />
                            </button>
                         )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPayments.length === 0 && (
            <div className="py-24 text-center">
               <Receipt size={64} className="mx-auto text-gray-100 mb-4" />
               <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.4em]">No hay registros de cobros aún</p>
            </div>
          )}
        </div>
      )}

      {/* REGISTER MODAL */}
      {registerOpen && (
        <div className="fixed inset-0 bg-slate/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300 border-4 border-slate flex flex-col md:flex-row">
              {/* Left: User Select */}
              <div className="w-full md:w-1/2 p-10 border-b md:border-b-0 md:border-r border-slate/10 flex flex-col overflow-hidden">
                 <div className="mb-6">
                    <h3 className="text-2xl font-black italic text-slate uppercase tracking-tighter mb-4">Seleccionar Usuario</h3>
                    <div className="relative group">
                       <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate" />
                       <input
                          type="text"
                          placeholder="Buscar por nombre..."
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-slate/5 rounded-[20px] text-xs font-bold focus:outline-none focus:border-pear transition-all"
                       />
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                    {filteredUsers.map(u => (
                       <button
                          key={u.uid}
                          onClick={() => setSelectedUser(u)}
                          className={`w-full flex items-center justify-between p-4 rounded-[22px] transition-all
                          ${selectedUser?.uid === u.uid ? 'bg-slate text-pear shadow-xl scale-[0.98]' : 'bg-gray-50 text-slate hover:bg-gray-100'}`}
                       >
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-xl ${selectedUser?.uid === u.uid ? 'bg-pear text-slate' : 'bg-slate text-pear'} flex items-center justify-center text-[10px] font-black`}>
                                {(u.displayName || 'U').substring(0,2).toUpperCase()}
                             </div>
                             <div className="text-left">
                                <p className="text-[11px] font-black uppercase line-clamp-1">{u.displayName}</p>
                                <p className={`text-[8px] font-bold ${selectedUser?.uid === u.uid ? 'text-white/50' : 'text-gray-400'}`}>{u.email}</p>
                             </div>
                          </div>
                          {selectedUser?.uid === u.uid && <ChevronRight size={16} />}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Right: Payment Form */}
              <div className="w-full md:w-1/2 p-10 bg-vanilla/10 relative">
                 <button onClick={() => setRegisterOpen(false)} className="absolute right-8 top-8 p-3 text-gray-300 hover:text-slate hover:bg-white rounded-2xl transition-all shadow-sm">
                    <X size={24} />
                 </button>

                 <div className="mt-4">
                    <div className="p-6 bg-slate text-white rounded-[32px] shadow-2xl mb-8 flex items-center gap-4">
                       <div className="w-14 h-14 bg-pear text-slate rounded-3xl flex items-center justify-center shadow-xl">
                          <DollarSign size={28} strokeWidth={3} />
                       </div>
                       <div>
                          <p className="text-[8px] font-black text-pear uppercase tracking-widest">Suscripción Premium</p>
                          <p className="text-xl font-black italic uppercase tracking-tighter">$3.00 USD / Mes</p>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {/* Currency Toggle */}
                       <div className="flex p-1.5 bg-white rounded-[24px] border-2 border-slate/5 shadow-inner">
                          <button
                             onClick={() => setFormCurrency('USD')}
                             className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                             ${formCurrency === 'USD' ? 'bg-slate text-pear shadow-lg' : 'text-gray-400'}`}
                          >
                             Dólares ($)
                          </button>
                          <button
                             onClick={() => setFormCurrency('VES')}
                             className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                             ${formCurrency === 'VES' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400'}`}
                          >
                             Bolívares (Bs)
                          </button>
                       </div>

                       {/* Amount Result (if BS) */}
                       {formCurrency === 'VES' && (
                          <div className="p-5 bg-emerald-50 rounded-[24px] border-2 border-emerald-100/50 flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                   <Clock size={20} />
                                </div>
                                <div>
                                   <p className="text-[8px] font-black text-emerald-400 uppercase">Total en Bs.</p>
                                   <p className="text-lg font-black text-emerald-700 italic">Bs. {(3 * bcvRate).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-[8px] font-black text-emerald-300 uppercase">Tasa BCV</p>
                                <p className="text-xs font-black text-emerald-600">{bcvRate}</p>
                             </div>
                          </div>
                       )}

                       {/* Notes Input */}
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate ml-4">Referencia / Nota</label>
                          <textarea
                             value={formNotes}
                             onChange={e => setFormNotes(e.target.value)}
                             placeholder="Ej. Transferencia Banesco #98127, Binance Pay, Efectivo..."
                             className="w-full px-6 py-5 bg-white border-2 border-slate/5 rounded-[28px] text-sm font-bold placeholder:text-gray-200 focus:outline-none focus:border-pear transition-all h-32 resize-none"
                          />
                       </div>

                       {/* User Preview */}
                       {selectedUser && (
                          <div className="p-4 bg-slate text-white rounded-[24px] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                             <div className="w-8 h-8 rounded-xl bg-pear text-slate flex items-center justify-center text-[10px] font-black">
                                {(selectedUser.displayName || 'U').substring(0,2).toUpperCase()}
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-tighter">Cobro para: {selectedUser.displayName}</p>
                          </div>
                       )}

                       {/* Action */}
                       <button
                          onClick={handleRegister}
                          disabled={!selectedUser || !formNotes.trim() || saving}
                          className="w-full py-5 bg-slate text-pear rounded-[28px] text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
                       >
                          {saving ? (
                             <div className="w-5 h-5 border-2 border-pear/30 border-t-pear rounded-full animate-spin"></div>
                          ) : (
                             <User size={16} />
                          )}
                          {saving ? 'Registrando...' : 'Confirmar Cobro de Suscripción'}
                       </button>

                       {!selectedUser && (
                          <div className="flex items-center gap-2 text-rose-400 justify-center">
                             <AlertCircle size={14} />
                             <p className="text-[8px] font-black uppercase">Debes elegir un usuario a la izquierda</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
