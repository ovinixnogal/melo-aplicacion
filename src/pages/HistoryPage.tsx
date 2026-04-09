import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Briefcase,
  History,
  LayoutGrid,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { db } from '../api/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';

interface FinancialRecord {
  id: string;
  type: 'ingreso' | 'egreso';
  date: any;
  amount: number;
  clientName: string;
  concept: string;
  method: string;
  currency: string;
}

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { exchangeRate } = useExchangeRate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'egreso'>('all');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const fetchGlobalHistory = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const allRecords: FinancialRecord[] = [];

      // 1. Inflow: Payments recorded by clients
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('userId', '==', user.uid),
        orderBy('paymentDate', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      const loansQuery = query(collection(db, 'loans'), where('userId', '==', user.uid));
      const loansSnapshot = await getDocs(loansQuery);
      const loansMap = new Map();
      loansSnapshot.docs.forEach(doc => {
        loansMap.set(doc.id, doc.data());
      });

      paymentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const loanData = loansMap.get(data.loanId);
        
        allRecords.push({
          id: doc.id,
          type: 'ingreso',
          date: data.paymentDate,
          amount: data.amountPaid || 0,
          clientName: loanData?.clientName || 'Cliente desconocido',
          concept: 'Cobro de Cuota',
          method: data.method || 'Efectivo',
          currency: data.currency || 'USD'
        });
      });

      // 2. Outflow: New Loans (Capital lent)
      loansSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        allRecords.push({
          id: doc.id,
          type: 'egreso',
          date: data.createdAt,
          amount: data.amount || 0,
          clientName: data.clientName,
          concept: 'Préstamo Otorgado',
          method: 'Capital',
          currency: data.currency || 'USD'
        });
      });

      // 3. Capital Movements: Injections and Extractions
      const capQuery = query(collection(db, 'capital_history'), where('userId', '==', user.uid));
      const capSnapshot = await getDocs(capQuery);
      
      capSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Skip disbursements/repayments as they are already handled by loans/payments
        if (data.type === 'loan_disbursement' || data.type === 'loan_repayment' || data.type === 'extraction' && data.note?.includes('Desembolso')) return;

        allRecords.push({
          id: doc.id,
          type: data.type === 'injection' ? 'ingreso' : 'egreso',
          date: data.createdAt,
          amount: data.amount || 0,
          clientName: 'Sistema (Capital)',
          concept: data.note || (data.type === 'injection' ? 'Inyección de Capital' : 'Retiro de Fondos'),
          method: 'Balance',
          currency: data.currency || 'USD'
        });
      });

      // Sort combined records by date
      allRecords.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
        return dateB - dateA;
      });

      setRecords(allRecords);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchGlobalHistory();
  }, [fetchGlobalHistory]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.concept.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || r.type === filterType;
      return matchSearch && matchType;
    });
  }, [records, searchTerm, filterType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const currentRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const stats = useMemo(() => {
    const rate = exchangeRate?.rate || 1;
    
    // Consolidamos todo a USD para el Dashboard estadístico
    const ingresos = records.filter(r => r.type === 'ingreso').reduce((acc, curr) => {
      const valueInUSD = curr.currency === 'VES' ? (curr.amount / rate) : curr.amount;
      return acc + valueInUSD;
    }, 0);

    const egresos = records.filter(r => r.type === 'egreso').reduce((acc, curr) => {
      const valueInUSD = curr.currency === 'VES' ? (curr.amount / rate) : curr.amount;
      return acc + valueInUSD;
    }, 0);

    return { 
      ingresos, 
      egresos, 
      balance: ingresos - egresos,
      hasVES: records.some(r => r.currency === 'VES')
    };
  }, [records, exchangeRate]);

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-12 space-y-10 animate-in fade-in duration-500">
        <Skeleton className="h-20 w-full rounded-[30px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <Skeleton className="h-32 rounded-[30px]" count={3} />
        </div>
        <Skeleton className="h-[400px] w-full rounded-[40px]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-12 space-y-6 md:space-y-12 animate-in slide-in-from-bottom-4 duration-700 pb-28 md:pb-12 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-slate text-pear rounded-2xl shadow-xl shadow-pear/10 transform -rotate-3"><History size={24} /></div>
              <h1 className="text-4xl md:text-6xl font-black text-slate tracking-tighter italic leading-none uppercase">
                Historial General
                <span className="text-pear">.</span>
              </h1>
           </div>
           <p className="text-gray-400 font-bold text-xs tracking-tight">Kardex detallado de todos los movimientos de capital.</p>
        </div>

        <div className="flex gap-4">
           <button 
             onClick={() => setFilterType('all')}
             className={`px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-slate text-white shadow-2xl' : 'bg-white text-gray-400 hover:text-slate border border-slate/5'}`}
           >
              Todos
           </button>
           <button 
             onClick={() => setFilterType('ingreso')}
             className={`px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'ingreso' ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-2xl scale-105' : 'bg-white text-gray-400 hover:text-emerald-500 border border-slate/5'}`}
           >
              Ingresos
           </button>
           <button 
             onClick={() => setFilterType('egreso')}
             className={`px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'egreso' ? 'bg-rose-500 text-white shadow-rose-500/20 shadow-2xl scale-105' : 'bg-white text-gray-400 hover:text-rose-500 border border-slate/5'}`}
           >
              Egresos
           </button>
        </div>
      </div>

      {/* Mini Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
         <Card className="!p-5 md:!p-8 bg-white border-2 border-slate/5 shadow-sm group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full">
            <div className="flex items-center justify-between mb-4 md:mb-6">
               <div className="p-2 bg-slate/5 text-slate rounded-xl"><ArrowDownLeft size={16} strokeWidth={3} /></div>
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate/30">Ingresos</span>
            </div>
            <div>
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Entradas</p>
               <p className="text-xl md:text-4xl font-black text-slate tracking-tighter italic leading-none truncate">
                  ${stats.ingresos.toLocaleString()}
               </p>
            </div>
         </Card>

         <Card className="!p-5 md:!p-8 bg-white border-2 border-slate/5 shadow-sm group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full">
            <div className="flex items-center justify-between mb-4 md:mb-6">
               <div className="p-2 bg-slate/5 text-slate rounded-xl"><ArrowUpRight size={16} strokeWidth={3} /></div>
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate/30">Egresos</span>
            </div>
            <div>
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Salidas</p>
               <p className="text-xl md:text-4xl font-black text-slate tracking-tighter italic leading-none truncate">
                  ${stats.egresos.toLocaleString()}
               </p>
            </div>
         </Card>

         <Card className="col-span-2 lg:col-span-1 !p-5 md:!p-8 bg-slate text-white shadow-xl group hover:scale-[1.01] transition-all relative overflow-hidden h-full border-2 border-slate/10">
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-pear/10 rounded-full blur-3xl opacity-20"></div>
            <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
               <div className="p-2 bg-pear text-slate rounded-xl"><Briefcase size={16} strokeWidth={3} /></div>
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Liquidación</span>
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Flujo Neto de Capital</p>
               <p className={`text-2xl md:text-4xl font-black tracking-tighter italic leading-none ${stats.balance >= 0 ? 'text-pear' : 'text-rose-400'}`}>
                  {stats.balance >= 0 ? '+' : '-'}${Math.abs(stats.balance).toLocaleString()}
               </p>
            </div>
         </Card>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-[56px] border border-slate/5 shadow-3xl shadow-slate/5 overflow-hidden">
         <div className="p-6 md:p-12 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="relative flex-1 max-w-lg group">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate transition-colors" size={20} />
               <input 
                 type="text" 
                 placeholder="Buscar movimiento..."
                 className="w-full pl-16 pr-8 py-4 md:py-5 bg-vanilla/50 border-2 border-transparent focus:border-slate focus:bg-white rounded-[24px] md:rounded-[28px] text-sm font-bold transition-all outline-none"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black text-gray-300 uppercase tracking-widest">
               <Clock size={16} /> {filteredRecords.length} movimientos encontrados
            </div>
         </div>

         <div className="block md:hidden p-4 space-y-4 bg-slate/5 rounded-b-[40px]">
            {currentRecords.map((r) => (
               <div key={r.id} className="bg-white border-2 border-slate/5 rounded-[28px] p-5 shadow-lg space-y-4 relative overflow-hidden group hover:border-slate/10 transition-colors">
                  <div className="absolute top-[-50%] right-[-10%] w-[120px] h-[120px] bg-slate/5 rounded-full blur-[40px] pointer-events-none"></div>
                  <div className="flex items-start justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${r.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                           {r.type === 'ingreso' ? <ArrowDownLeft size={22} strokeWidth={2.5} /> : <ArrowUpRight size={22} strokeWidth={2.5} />}
                        </div>
                        <div className="flex flex-col">
                           <span className="font-black text-[15px] uppercase italic tracking-tighter text-slate leading-tight w-[140px] sm:w-[200px] truncate">
                              {r.clientName}
                           </span>
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate max-w-[140px] mt-0.5">
                              {r.concept}
                           </span>
                        </div>
                     </div>
                     <div className="text-right flex flex-col items-end">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] mb-1.5 ${r.type === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                           {r.type}
                        </span>
                        <p className={`text-xl font-black italic tracking-tighter leading-none ${r.type === 'ingreso' ? 'text-emerald-600' : 'text-slate'}`}>
                           {r.type === 'ingreso' ? '+' : '-'}{r.currency === 'USD' ? '$' : 'Bs.'}{r.amount.toLocaleString()}
                        </p>
                     </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t-2 border-slate/5 relative z-10">
                     <div className="flex items-center gap-2">
                        <Clock size={12} className="text-gray-300" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{formatDate(r.date)}</span>
                     </div>
                     <span className="text-[9px] font-black text-slate/40 uppercase tracking-[0.2em] italic bg-slate/5 px-3 py-1.5 rounded-xl">
                        {r.method}
                     </span>
                  </div>
               </div>
            ))}
         </div>

         <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-gray-50">
                     <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Fecha</th>
                     <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Deudor / Concepto</th>
                     <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Tipo</th>
                     <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Monto</th>
                     <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 text-right">Método</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 text-slate">
                  {currentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-vanilla/30 transition-all group">
                       <td className="px-10 py-7">
                          <div className="flex flex-col">
                             <span className="font-black text-[13px] tracking-tight">{formatDate(r.date)}</span>
                             <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1">Ref: {r.id.substring(0,6)}</span>
                          </div>
                       </td>
                       <td className="px-10 py-7">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black shadow-inner ${r.type === 'ingreso' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                {r.clientName.substring(0, 2).toUpperCase()}
                             </div>
                             <div className="flex flex-col">
                                <span className="font-black text-sm uppercase italic tracking-tighter truncate max-w-[200px]">{r.clientName}</span>
                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{r.concept}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-10 py-7">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.type === 'ingreso' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                             {r.type}
                          </span>
                       </td>
                       <td className="px-10 py-7">
                          <span className={`text-xl font-black italic tracking-tighter ${r.type === 'ingreso' ? 'text-emerald-500' : 'text-slate'}`}>
                             {r.type === 'ingreso' ? '+' : '-'}{r.currency === 'USD' ? '$' : 'Bs.'}{r.amount.toLocaleString()}
                          </span>
                       </td>
                       <td className="px-10 py-7 text-right">
                          <span className="px-4 py-2 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 rounded-xl group-hover:text-slate transition-colors">
                             {r.method}
                          </span>
                       </td>
                    </tr>
                  ))}

                  {filteredRecords.length === 0 && (
                    <tr>
                       <td colSpan={5} className="px-10 py-24 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                             <LayoutGrid size={64} />
                             <p className="font-black text-xs uppercase tracking-[0.4em]">No hay registros para mostrar</p>
                          </div>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
         
         {/* Paginación */}
         {totalPages > 1 && (
            <div className="px-8 py-6 border-t border-gray-50 flex items-center justify-between bg-white text-[10px] font-black uppercase tracking-widest text-gray-400">
               <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-6 py-3 rounded-xl transition-all disabled:opacity-30 hover:bg-slate hover:text-white"
               >
                  Anterior
               </button>
               <span>
                  Página <span className="text-slate">{currentPage}</span> de {totalPages}
               </span>
               <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 rounded-xl transition-all disabled:opacity-30 hover:bg-slate hover:text-white"
               >
                  Siguiente
               </button>
            </div>
         )}
      </div>
    </div>
  );
};

export default HistoryPage;
