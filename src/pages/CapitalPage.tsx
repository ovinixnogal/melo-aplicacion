import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapital } from '../hooks/useCapital';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  DollarSign, 
  Plus, 
  Minus,
  AlertCircle,
  TrendingUp,
  HandCoins,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const CapitalPage: React.FC = () => {
  const { user } = useAuth();
  const { balances, history, loading, updateCapital, hasMore, loadMore } = useCapital(user?.uid);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const currentHistory = history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [isUpdating, setIsUpdating] = useState(false);
  const [showForm, setShowForm] = useState<'injection' | 'extraction' | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Monto inválido');
      return;
    }
    
    if (showForm === 'extraction' && Number(amount) > balances[currency]) {
      setError(`Capital en ${currency} insuficiente`);
      return;
    }

    setIsUpdating(true);
    setError(null);
    try {
      await updateCapital(
        Number(amount), 
        showForm!, 
        currency, 
        note || (showForm === 'injection' ? `Inyección (${currency})` : `Retiro (${currency})`)
      );
      setAmount('');
      setNote('');
      setShowForm(null);
    } catch (err) {
      setError('Error al procesar la transacción');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12 animate-in fade-in duration-500 pb-20">
         <Skeleton className="h-12 w-64" />
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-[220px] sm:h-[280px] rounded-[32px] sm:rounded-[48px]" />
            <Skeleton className="h-[220px] sm:h-[280px] rounded-[32px] sm:rounded-[48px]" />
         </div>
         <Skeleton className="h-[400px] rounded-[32px] sm:rounded-[48px]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12 animate-in fade-in zoom-in-95 duration-700 pb-24">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate tracking-tighter italic leading-none">
                Gestión <span className="text-pear">Bimonetaria</span>
            </h1>
            <p className="text-gray-400 font-bold text-[10px] sm:text-xs tracking-tight">Administra tu liquidez en Dólares y Bolívares simultáneamente.</p>
        </div>

        <div className="grid grid-cols-2 md:flex gap-2 sm:gap-4">
            <button 
              onClick={() => { setShowForm('injection'); setError(null); }}
              className="flex items-center justify-center gap-1.5 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 bg-emerald-500 text-white rounded-[18px] sm:rounded-[24px] font-black text-[8px] sm:text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
            >
               <Plus size={14} className="sm:w-4 sm:h-4" /> Inyectar
            </button>
            <button 
              onClick={() => { setShowForm('extraction'); setError(null); }}
              className="flex items-center justify-center gap-1.5 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 bg-slate text-white rounded-[18px] sm:rounded-[24px] font-black text-[8px] sm:text-[11px] uppercase tracking-widest shadow-lg hover:bg-slate/90 hover:scale-105 transition-all"
            >
               <Minus size={14} className="sm:w-4 sm:h-4" /> Retirar
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mt-10">
         {/* Balance Cards Group */}
         <div className="lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-8">
            {/* USD Balance */}
            <div className="bg-slate rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col justify-between min-h-[140px] sm:min-h-[260px] shadow-2xl border-2 sm:border-4 border-slate relative overflow-hidden group">
               <div className="absolute top-[-20%] right-[-10%] w-[100px] sm:w-[150px] h-[100px] sm:h-[150px] bg-pear/10 rounded-full blur-[40px] sm:blur-[70px]"></div>
               <div className="flex items-start justify-between relative z-10">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 bg-pear text-slate rounded-lg sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-xl shadow-[2px_2px_0_rgba(0,0,0,0.3)] sm:shadow-[4px_4px_0_rgba(0,0,0,0.3)] border border-slate sm:border-2">
                    <DollarSign size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                  </div>
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/5 text-pear text-[7px] sm:text-[9px] font-black rounded-full uppercase tracking-widest border border-pear/20 italic">USD</span>
               </div>
               <div className="relative z-10 mt-4 sm:mt-8">
                  <h3 className="text-[7px] sm:text-[9px] font-black text-white/30 uppercase tracking-[0.2em] sm:tracking-[0.4em] mb-1 sm:mb-2">Capital</h3>
                  <div className="flex items-baseline gap-0.5 sm:gap-2 overflow-hidden">
                     <span className="text-xs sm:text-2xl font-black text-pear tracking-tight">$</span>
                     <p className="text-xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black text-white tracking-tighter italic leading-none truncate w-full" title={balances.USD.toLocaleString()}>
                        {balances.USD.toLocaleString()}
                     </p>
                  </div>
               </div>
            </div>

            {/* VES Balance */}
            <div className="bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col justify-between min-h-[140px] sm:min-h-[260px] shadow-2xl border-2 sm:border-4 border-slate relative overflow-hidden group">
               <div className="flex items-start justify-between relative z-10">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 bg-slate text-pear rounded-lg sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-xl shadow-[2px_2px_0_rgba(0,0,0,0.1)] sm:shadow-[4px_4px_0_rgba(0,0,0,0.1)] border border-slate sm:border-2">
                    <TrendingUp size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                  </div>
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-slate text-pear text-[7px] sm:text-[9px] font-black rounded-full uppercase tracking-widest border border-slate italic">VES</span>
               </div>
               <div className="relative z-10 mt-4 sm:mt-8">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-3 text-slate/40 flex-wrap">
                     <h3 className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em]">Capital</h3>
                  </div>
                  <div className="flex items-baseline gap-0.5 sm:gap-2 overflow-hidden">
                     <span className="text-[10px] sm:text-xl font-black text-slate tracking-tight">Bs.</span>
                     <p className="text-xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black text-slate tracking-tighter italic leading-none truncate w-full" title={balances.VES.toLocaleString()}>
                        {balances.VES.toLocaleString()}
                     </p>
                  </div>
               </div>
            </div>

            {/* USD Earned */}
            <div className="bg-pear rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col justify-between min-h-[140px] sm:min-h-[260px] shadow-2xl border-2 sm:border-4 border-slate relative overflow-hidden group">
               <div className="flex items-start justify-between relative z-10">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 bg-slate text-pear rounded-lg sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-xl shadow-[2px_2px_0_rgba(0,0,0,0.1)] sm:shadow-[4px_4px_0_rgba(0,0,0,0.1)] border border-slate sm:border-2">
                    <HandCoins size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                  </div>
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-slate text-pear text-[7px] sm:text-[9px] font-black rounded-full uppercase tracking-widest border border-slate italic">Ganas USD</span>
               </div>
               <div className="relative z-10 mt-4 sm:mt-8">
                  <h3 className="text-[7px] sm:text-[9px] font-black text-slate/40 uppercase tracking-[0.2em] sm:tracking-[0.4em] mb-1 sm:mb-2 text-slate/60">Intereses</h3>
                  <div className="flex items-baseline gap-0.5 sm:gap-2 overflow-hidden">
                     <span className="text-xs sm:text-2xl font-black text-slate tracking-tight">$</span>
                     <p className="text-xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black text-slate tracking-tighter italic leading-none truncate w-full" title={(balances.earnedUSD || 0).toLocaleString()}>
                        {(balances.earnedUSD || 0).toLocaleString()}
                     </p>
                  </div>
               </div>
            </div>

            {/* VES Earned */}
            <div className="bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-8 flex flex-col justify-between min-h-[140px] sm:min-h-[260px] shadow-2xl border-2 sm:border-4 border-emerald-500/30 relative overflow-hidden group">
               <div className="flex items-start justify-between relative z-10">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 bg-emerald-500 text-white rounded-lg sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-xl shadow-[2px_2px_0_rgba(0,0,0,0.1)] sm:shadow-[4px_4px_0_rgba(0,0,0,0.1)] border border-emerald-600 sm:border-2">
                    <HandCoins size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                  </div>
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-100 text-emerald-600 text-[7px] sm:text-[9px] font-black rounded-full uppercase tracking-widest border border-emerald-200 italic">Ganas VES</span>
               </div>
               <div className="relative z-10 mt-4 sm:mt-8">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-3 text-emerald-500/40 flex-wrap">
                     <h3 className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em]">Intereses</h3>
                  </div>
                  <div className="flex items-baseline gap-0.5 sm:gap-2 overflow-hidden">
                     <span className="text-[10px] sm:text-xl font-black text-emerald-600 tracking-tight">Bs.</span>
                     <p className="text-xl sm:text-4xl xl:text-5xl 2xl:text-6xl font-black text-emerald-600 tracking-tighter italic leading-none truncate w-full" title={(balances.earnedVES || 0).toLocaleString()}>
                        {(balances.earnedVES || 0).toLocaleString()}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Form Modal */}
      <Modal 
        isOpen={!!showForm} 
        onClose={() => setShowForm(null)}
        title={showForm === 'injection' ? 'Cargar Fondos' : 'Retirar Fondos'}
        maxWidth="md"
      >
        <div className="space-y-8 p-1">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${showForm === 'injection' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate text-white'}`}>
              {showForm === 'injection' ? <ArrowUpCircle size={28} /> : <ArrowDownCircle size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate uppercase italic tracking-tighter">
                {showForm === 'injection' ? 'Inyección de Capital' : 'Extracción de Capital'}
              </h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ajuste de Balance General</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate/40 ml-4">Moneda de la Operación</label>
                  <div className="flex p-1.5 bg-gray-100 rounded-2xl border border-slate/5 gap-2">
                     <button
                       type="button"
                       onClick={() => setCurrency('USD')}
                       className={`flex-1 py-3 rounded-xl font-black text-[11px] transition-all ${currency === 'USD' ? 'bg-slate text-white shadow-lg' : 'text-slate/40 hover:text-slate'}`}
                     >
                       USD
                     </button>
                     <button
                       type="button"
                       onClick={() => setCurrency('VES')}
                       className={`flex-1 py-3 rounded-xl font-black text-[11px] transition-all ${currency === 'VES' ? 'bg-slate text-white shadow-lg' : 'text-slate/40 hover:text-slate'}`}
                     >
                       VES
                     </button>
                  </div>
               </div>

               <Input 
                 label={`Monto a ${showForm === 'injection' ? 'Inyectar' : 'Retirar'} (${currency})`}
                 placeholder="0.00"
                 type="number"
                 inputMode="decimal"
                 step="0.01"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 icon={currency === 'USD' ? <DollarSign size={16} /> : <TrendingUp size={16} />}
               />
               
               <Input 
                 label="Concepto o Nota"
                 placeholder="Ej: Aporte de socio, retiro personal..."
                 value={note}
                 onChange={(e) => setNote(e.target.value)}
                 icon={<History size={16} />}
               />
            </div>

            <div className="flex flex-col gap-4">
               {error && (
                 <div className="flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest">
                    <AlertCircle size={14} /> {error}
                 </div>
               )}
               <Button 
                 type="submit" 
                 disabled={isUpdating}
                 className="w-full !rounded-[24px] py-6 shadow-xl font-black uppercase italic tracking-tighter"
               >
                 {isUpdating ? 'Procesando...' : (showForm === 'injection' ? `Confirmar Inyectar ${currency}` : `Confirmar Retirar ${currency}`)}
               </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* History Table */}
      <div className="space-y-6 pb-20">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
               <History size={20} className="text-slate/30" />
               <h3 className="text-lg sm:text-xl font-black text-slate tracking-tighter uppercase italic">Historial Multimoneda</h3>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</p>
         </div>

         {/* Desktop View */}
         <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-4">
               <thead>
                  <tr className="text-left">
                     <th className="px-8 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Movimiento</th>
                     <th className="px-8 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                     <th className="px-8 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Divisa</th>
                     <th className="px-8 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                     <th className="px-8 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
               </thead>
               <tbody>
                  {currentHistory.length > 0 ? currentHistory.map((tx) => (
                    <tr key={tx.id} className="group cursor-default">
                       <td className="bg-white border-y-2 border-l-2 border-slate/5 first-of-type:rounded-l-[32px] px-8 py-6 group-hover:border-slate transition-colors duration-300">
                          <div className="flex items-center gap-4">
                             <div className={`p-3 rounded-xl ${
                                tx.type === 'injection' || tx.type === 'loan_repayment' 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : 'bg-slate/5 text-slate'
                             }`}>
                                {tx.type === 'injection' || tx.type === 'loan_repayment' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                             </div>
                             <div>
                                <p className="text-[11px] font-black text-slate uppercase tracking-wide">{tx.note}</p>
                                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em] mt-0.5">{tx.type.replace('_', ' ')}</p>
                             </div>
                          </div>
                       </td>
                       <td className="bg-white border-y-2 border-slate/5 px-8 py-6 group-hover:border-slate transition-colors duration-300">
                          <p className={`text-sm font-black ${
                             tx.type === 'injection' || tx.type === 'loan_repayment' ? 'text-emerald-600' : 'text-slate'
                          }`}>
                             {tx.type === 'injection' || tx.type === 'loan_repayment' ? '+' : '-'}{tx.amount.toLocaleString()}
                          </p>
                       </td>
                       <td className="bg-white border-y-2 border-slate/5 px-8 py-6 group-hover:border-slate transition-colors duration-300">
                          <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${
                             tx.currency === 'USD' ? 'bg-pear text-slate border border-slate/10 shadow-sm' : 'bg-slate text-white border border-white/10 shadow-sm'
                          }`}>
                            {tx.currency}
                          </span>
                       </td>
                       <td className="bg-white border-y-2 border-slate/5 px-8 py-6 group-hover:border-slate transition-colors duration-300">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                             {tx.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                       </td>
                       <td className="bg-white border-y-2 border-r-2 border-slate/5 rounded-r-[32px] px-8 py-6 text-right group-hover:border-slate transition-colors duration-300">
                          <span className="text-[10px] font-black text-slate/20 uppercase tracking-[0.2em]">Verified</span>
                       </td>
                    </tr>
                  )) : (
                    <tr>
                       <td colSpan={5} className="text-center py-20 bg-white/50 border-2 border-dashed border-slate/5 rounded-[48px]">
                          <p className="text-[10px] font-black text-slate/20 uppercase tracking-widest">No hay transacciones registradas</p>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>

         {/* Mobile View */}
         <div className="md:hidden space-y-4">
            {currentHistory.length > 0 ? currentHistory.map((tx) => (
              <div key={tx.id} className="bg-white border-2 border-slate/5 rounded-[24px] p-5 space-y-4 animate-in fade-in duration-300">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${
                          tx.type === 'injection' || tx.type === 'loan_repayment' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-slate/5 text-slate'
                       }`}>
                          {tx.type === 'injection' || tx.type === 'loan_repayment' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate uppercase tracking-tight leading-none truncate max-w-[120px]">{tx.note}</p>
                          <p className="text-[8px] font-bold text-gray-300 uppercase tracking-[0.1em] mt-1">{tx.type.replace('_', ' ')}</p>
                       </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-widest ${
                       tx.currency === 'USD' ? 'bg-pear text-slate' : 'bg-slate text-white'
                    }`}>
                      {tx.currency}
                    </span>
                 </div>
                 <div className="flex items-end justify-between pt-2 border-t border-slate/5">
                    <div>
                       <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Fecha</p>
                       <p className="text-[10px] font-black text-slate uppercase">
                          {tx.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                       </p>
                    </div>
                    <p className={`text-lg font-black italic tracking-tighter ${
                       tx.type === 'injection' || tx.type === 'loan_repayment' ? 'text-emerald-600' : 'text-slate'
                    }`}>
                       {tx.type === 'injection' || tx.type === 'loan_repayment' ? '+' : '-'}{tx.amount.toLocaleString()}
                    </p>
                 </div>
              </div>
            )) : (
              <div className="text-center py-10 bg-white/50 border-2 border-dashed border-slate/5 rounded-[32px]">
                 <p className="text-[10px] font-black text-slate/20 uppercase tracking-widest">Sin registros</p>
              </div>
            )}
         </div>

         {/* Pagination Controls */}
         {totalPages > 1 && (
           <div className="flex items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-3 bg-white border-2 border-slate rounded-xl disabled:opacity-30 hover:bg-vanilla transition-colors shadow-[4px_4px_0_#1A1A1A] active:shadow-none active:translate-x-1 active:translate-y-1"
              >
                 <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2">
                 {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`w-10 h-10 rounded-xl font-black text-[11px] border-2 border-slate transition-all shadow-[4px_4px_0_#1A1A1A] active:shadow-none active:translate-x-1 active:translate-y-1 ${currentPage === i + 1 ? 'bg-pear text-slate' : 'bg-white text-slate'}`}
                    >
                       {i + 1}
                    </button>
                 ))}
              </div>
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-3 bg-white border-2 border-slate rounded-xl disabled:opacity-30 hover:bg-vanilla transition-colors shadow-[4px_4px_0_#1A1A1A] active:shadow-none active:translate-x-1 active:translate-y-1"
              >
                 <ChevronRight size={20} />
              </button>
           </div>
         )}

         {hasMore && (
           <div className="flex justify-center pt-8">
              <button 
                onClick={() => loadMore()}
                className="flex items-center gap-3 px-8 py-4 bg-pear text-slate border-2 border-slate rounded-[24px] font-black text-[11px] uppercase tracking-widest shadow-[6px_6px_0_#1A1A1A] hover-brutalist transition-all"
              >
                 <TrendingUp size={16} /> Cargar más del servidor
              </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default CapitalPage;
