import React from 'react';
import { 
  History, 
  Calendar as CalendarIcon, 
  CreditCard, 
  Loader2, 
  FileText,
  BadgeInfo
} from 'lucide-react';
import { usePayments } from '../../hooks/usePayments';
import type { Currency } from '../../hooks/useLoans';
import type { PaymentRecord } from '../../hooks/usePayments';
import Card from '../ui/Card';

interface PaymentHistoryProps {
  loanId: string;
  currency: Currency;
  refreshTrigger?: number; // to refetch when a payment is made
}

const PaymentHistory: React.FC<PaymentHistoryProps> = ({ loanId, currency, refreshTrigger }) => {
  const { payments, loading, refresh } = usePayments(loanId);
  
  // Paginación
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 10;

  React.useEffect(() => {
    if (refreshTrigger) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  const totalPages = Math.ceil(payments.length / ITEMS_PER_PAGE);
  const currentPayments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return payments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [payments, currentPage]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && payments.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-gray-300">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cargando historial...</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="p-16 border-2 border-dashed border-slate/5 rounded-[48px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center text-gray-300 shadow-inner">
          <History size={36} />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-black text-slate uppercase tracking-tighter italic">Sin pagos registrados</h4>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aún no se han realizado abonos a este préstamo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate text-pear rounded-[20px] shadow-2xl flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform">
          <History size={22} />
        </div>
        <div>
          <h3 className="text-3xl font-[900] text-slate tracking-tight italic uppercase">Historial de Cobros</h3>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">Registro cronológico de movimientos</p>
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-[44px] border border-slate/5 shadow-2xl shadow-slate/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/30 border-b border-slate/5">
              <th className="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Fecha</th>
              <th className="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Monto</th>
              <th className="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Método</th>
              <th className="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Cuotas</th>
              <th className="px-10 py-7 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right pr-12">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate/5">
            {currentPayments.map((payment: PaymentRecord) => (
              <tr key={payment.id} className="hover:bg-vanilla/30 transition-colors group">
                <td className="px-10 py-7 font-black text-sm text-slate">
                   <div className="flex items-center gap-3">
                      <CalendarIcon size={16} className="text-gray-300 group-hover:text-slate transition-colors" />
                      {formatDate(payment.paymentDate)}
                   </div>
                </td>
                <td className="px-10 py-7">
                   <div className="flex flex-col">
                     <span className="font-black text-emerald-600 text-lg italic tracking-tight">
                        {currency === 'USD' ? '$' : 'Bs.'}{payment.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </span>
                     {payment.originalAmount && payment.originalAmount !== payment.amountPaid && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate opacity-40 mt-1">
                           Entró: {payment.currency === 'USD' ? '$' : 'Bs.'}{payment.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {payment.currency}
                        </span>
                     )}
                   </div>
                </td>
                <td className="px-10 py-7">
                   <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-slate text-pear rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-slate/10">
                      <CreditCard size={12} />
                      {payment.method}
                   </div>
                </td>
                <td className="px-10 py-7">
                   <div className="flex flex-wrap gap-1.5">
                      {payment.affectedInstallments?.map((num: number) => (
                        <span key={num} className="w-6 h-6 bg-pear text-slate rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm group-hover:scale-110 transition-transform">
                           {num}
                        </span>
                      ))}
                      {!payment.affectedInstallments?.length && <span className="text-[10px] text-gray-300">-</span>}
                   </div>
                </td>
                <td className="px-10 py-7 text-right pr-12">
                   {payment.note ? (
                     <div className="inline-flex items-center gap-2.5 text-[11px] font-bold text-gray-400 max-w-[240px] truncate bg-gray-50/50 px-4 py-2 rounded-2xl group-hover:bg-white transition-all">
                        <FileText size={14} className="shrink-0 text-slate/20" />
                        {payment.note}
                     </div>
                   ) : (
                     <span className="text-gray-200">-</span>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-6 pb-2">
        {currentPayments.map((payment: PaymentRecord) => (
          <Card key={payment.id} className="p-8 space-y-6 !rounded-[40px] hover:scale-[1.02] transition-transform">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                      <CalendarIcon size={16} className="text-gray-400" />
                   </div>
                   <span className="font-black text-xs text-slate">{formatDate(payment.paymentDate)}</span>
                </div>
                <span className="px-4 py-1.5 bg-slate text-pear rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-slate/10">
                   {payment.method}
                </span>
             </div>

             <div className="flex justify-between items-end border-y border-slate/5 py-6">
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Monto Abonado</p>
                   <div className="flex flex-col">
                      <p className="text-3xl font-[900] italic tracking-tight text-emerald-600 leading-none">
                         {currency === 'USD' ? '$' : 'Bs.'}{payment.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                      {payment.originalAmount && payment.originalAmount !== payment.amountPaid && (
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate opacity-40 mt-1">
                            Entró: {payment.currency === 'USD' ? '$' : 'Bs.'}{payment.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {payment.currency}
                         </span>
                      )}
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Cuotas</p>
                   <div className="flex justify-end gap-1.5">
                      {payment.affectedInstallments?.map((num: number) => (
                        <span key={num} className="w-7 h-7 bg-pear text-slate rounded-xl flex items-center justify-center text-[11px] font-black shadow-sm">
                           {num}
                        </span>
                      ))}
                   </div>
                </div>
             </div>

             {payment.note && (
               <div className="flex gap-3 items-start bg-vanilla/50 p-4 rounded-3xl border border-slate/5">
                  <BadgeInfo size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">"{payment.note}"</p>
               </div>
             )}
          </Card>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
         <div className="px-6 py-4 flex items-center justify-between bg-white md:bg-transparent rounded-[32px] text-[10px] font-black uppercase tracking-widest text-slate border border-slate/5 md:border-0 shadow-sm md:shadow-none">
            <button 
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               disabled={currentPage === 1}
               className="px-6 py-3 rounded-xl transition-all disabled:opacity-30 hover:bg-slate hover:text-white"
            >
               Anterior
            </button>
            <span className="opacity-60">
               Página <span className="text-pear md:text-emerald-600 bg-slate md:bg-emerald-50 px-2 py-0.5 rounded-md text-xs">{currentPage}</span> de {totalPages}
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
  );
};

export default PaymentHistory;
