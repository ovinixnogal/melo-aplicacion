import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Loader2, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  ChevronRight,
  RefreshCcw,
  Ban
} from 'lucide-react';
import { useLoans } from '../hooks/useLoans';
import type { Loan } from '../hooks/useLoans';
import { useAuth } from '../contexts/AuthContext';
import LoanForm from '../components/loans/LoanForm';

const LoansPage: React.FC = () => {
  const { user } = useAuth();
  const { loans, loading, hasMore, loadMoreLoans, error, refresh, syncAllActiveLoans } = useLoans(user?.uid);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLoans = loans.filter((loan: Loan) => {
    const matchesSearch = loan.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
    
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'overdue': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'cancelled': return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-50 text-gray-400 border-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock size={12} />;
      case 'completed': return <CheckCircle2 size={12} />;
      case 'overdue': return <AlertCircle size={12} />;
      case 'cancelled': return <Ban size={12} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-36 md:pb-16">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black text-slate tracking-tighter uppercase italic leading-none">
            Mis Préstamos
            <span className="text-pear">.</span>
          </h1>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            {loans.length} créditos en gestión
          </p>
        </div>

        <div className="flex gap-3">
          <button 
             onClick={async () => {
                setIsSyncing(true);
                try {
                  const count = await syncAllActiveLoans();
                  alert(`Sincronización completada. ${count} préstamos actualizados a mora.`);
                } catch {
                  alert("Error al sincronizar");
                } finally {
                  setIsSyncing(false);
                }
             }}
             disabled={isSyncing}
             className="p-4 bg-white border border-gray-100 text-gray-400 hover:text-[#1A1A1A] rounded-2xl transition-all active:rotate-180 duration-500 shadow-sm disabled:opacity-50"
             title="Sincronizar Estados"
          >
             {isSyncing ? <Loader2 size={18} className="animate-spin text-pear" /> : <RefreshCcw size={18} />}
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-4 px-8 py-5 bg-slate text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-gray-800 transition-all hover:-translate-y-1 active:scale-95 group"
          >
             Nuevo Préstamo <Plus size={18} className="text-pear group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-slate transition-colors" size={22} />
          <input 
            type="text" 
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate/5 focus:border-pear rounded-[30px] text-sm font-bold text-slate focus:outline-none transition-all focus:shadow-xl"
          />
        </div>
        <div className="flex gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex items-center justify-center gap-3 px-4 py-3 md:px-6 md:py-4 bg-white border-2 border-slate/5 rounded-[20px] md:rounded-[30px] font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate hover:bg-gray-50 transition-all focus:outline-none focus:border-pear cursor-pointer appearance-none min-w-[140px] text-center"
            >
              <option value="all">Todos los estados</option>
              <option value="active">En Curso</option>
              <option value="overdue">Vencidos</option>
              <option value="completed">Finalizados</option>
              <option value="cancelled">Cancelados</option>
            </select>
            
            <button className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-white border-2 border-slate/5 rounded-[20px] md:rounded-[30px] font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate hover:bg-gray-50 transition-all active:scale-95">
               <Filter size={14} className="text-pear" /> <span className="hidden sm:inline text-nowrap">Filtros</span>
            </button>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-[30px] text-rose-600 text-[11px] font-black uppercase tracking-widest text-center">
          ⚠️ Error: {error}
        </div>
      )}

      {/* LOANS LIST Content */}
      {loading && loans.length === 0 ? (
        <div className="space-y-4">
           {[1,2,3,4].map(i => (
             <div key={i} className="h-20 bg-gray-50 rounded-[24px] animate-pulse"></div>
           ))}
        </div>
      ) : filteredLoans.length > 0 ? (
        <div className="space-y-6">
          
          <div className="bg-white rounded-[32px] md:rounded-[48px] border border-slate/5 shadow-3xl shadow-slate/5 overflow-hidden">
            
            {/* MOBILE LIST VIEW */}
            <div className="lg:hidden divide-y divide-gray-50">
               {filteredLoans.map((loan: Loan) => {
                 const progress = (loan.paidInstallmentsCount / loan.numberOfInstallments) * 100;
                 return (
                   <Link 
                     key={loan.id} 
                     to={`/prestamos/${loan.id}`}
                     className="flex items-center gap-4 p-5 md:p-6 active:bg-gray-50 transition-colors group"
                   >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner shrink-0 ${loan.status === 'overdue' ? 'bg-rose-50 text-rose-500' : 'bg-slate text-pear'}`}>
                         {loan.clientName[0].toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1">
                            <h3 className="font-black text-[13px] text-slate truncate uppercase italic leading-none">
                              {loan.clientName}
                            </h3>
                            <span className={`text-[10px] font-black italic ${loan.status === 'overdue' ? 'text-rose-500' : 'text-slate'}`}>
                              {loan.currency === 'USD' ? '$' : 'Bs.'}{loan.totalToPay.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                            </span>
                         </div>
                         
                         <div className="flex justify-between items-center mb-2">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${loan.status === 'overdue' ? 'text-rose-500' : 'text-gray-400'}`}>
                               {loan.status === 'active' ? 'En Curso' : 
                                loan.status === 'completed' ? 'Finalizado' : 
                                loan.status === 'cancelled' ? 'Cancelado' : 'Vencido'}
                            </span>
                            <span className="text-[8px] font-black text-gray-400">{progress.toFixed(0)}%</span>
                         </div>

                         <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${loan.status === 'completed' ? 'bg-emerald-500' : loan.status === 'overdue' ? 'bg-rose-500' : 'bg-pear'}`}
                              style={{ width: `${progress}%` }}
                            ></div>
                         </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-200" />
                   </Link>
                 );
               })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden lg:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-vanilla/50">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Cliente</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Estado</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Progreso</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Saldo Total</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 text-right">Acción</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {filteredLoans.map((loan: Loan) => {
                       const progress = ((loan.paidInstallmentsCount || 0) / (loan.numberOfInstallments || 1)) * 100;
                       return (
                         <tr key={loan.id} className="hover:bg-vanilla/30 transition-all group">
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner ${loan.status === 'overdue' ? 'bg-rose-50 text-rose-500' : 'bg-slate text-pear'}`}>
                                     {loan.clientName.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="font-black text-sm uppercase italic tracking-tighter text-slate">{loan.clientName}</span>
                                     <span className="text-[9px] font-bold text-gray-300 uppercase mt-0.5">{loan.paidInstallmentsCount} de {loan.numberOfInstallments} cuotas</span>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${getStatusColor(loan.status)}`}>
                                  {getStatusIcon(loan.status)}
                                  {loan.status === 'active' ? 'En Curso' : loan.status === 'completed' ? 'Finalizado' : 'Vencido'}
                               </span>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-4 min-w-[150px]">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                     <div 
                                       className={`h-full transition-all duration-1000 ${loan.status === 'completed' ? 'bg-emerald-500' : loan.status === 'overdue' ? 'bg-rose-500' : 'bg-pear'}`}
                                       style={{ width: `${progress}%` }}
                                     ></div>
                                  </div>
                                  <span className="text-[10px] font-black italic text-slate">{progress.toFixed(0)}%</span>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <p className="text-lg font-black italic tracking-tighter text-slate leading-none">
                                  {loan.currency === 'USD' ? '$' : 'Bs.'}{loan.totalToPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                               </p>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <Link 
                                 to={`/prestamos/${loan.id}`}
                                 className="inline-flex items-center gap-2 px-5 py-2.5 bg-vanilla border border-slate/5 text-[9px] font-black uppercase tracking-widest text-slate rounded-xl hover:bg-slate hover:text-white transition-all group/btn"
                               >
                                  Ver Detalles <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                               </Link>
                            </td>
                         </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
          </div>

          {hasMore && (
             <div className="flex justify-center pt-8">
                <button 
                  onClick={loadMoreLoans}
                  disabled={loading}
                  className="px-12 py-5 bg-[#1A1A1A] text-white rounded-[30px] font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl hover:bg-gray-800 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'Cargar más préstamos'}
                </button>
             </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="py-24 text-center bg-white rounded-[56px] border border-[#1A1A1A]/5 shadow-inner">
           <div className="w-24 h-24 bg-gray-50 rounded-[34px] flex items-center justify-center mx-auto mb-8">
              <TrendingUp className="text-gray-200" size={56} />
           </div>
           <h3 className="text-2xl font-black text-[#1A1A1A] tracking-tighter italic uppercase">Sin créditos activos</h3>
           <p className="text-gray-400 text-sm mt-4 max-w-xs mx-auto font-medium">Empieza a generar rentabilidad creando tu primer préstamo sistematizado.</p>
           <button 
              onClick={() => setIsFormOpen(true)}
              className="mt-10 px-10 py-5 bg-[#E2FF3B] text-[#1A1A1A] rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
           >
              Crear Préstamo
           </button>
        </div>
      )}

      {/* LOAN FORM MODAL */}
      <LoanForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
           setIsFormOpen(false);
           refresh();
        }}
      />

    </div>
  );
};

export default LoansPage;
