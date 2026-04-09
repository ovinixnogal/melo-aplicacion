import React from 'react';
import { 
  Phone, 
  Mail, 
  Calendar,
  ArrowRight,
  TrendingUp,
  CreditCard,
  History,
  ShieldCheck,
  ArrowLeft,
  LayoutGrid,
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoans } from '../../hooks/useLoans';
import type { Client } from '../../hooks/useClients';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useExchangeRate } from '../../hooks/useExchangeRate';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onEdit: () => void;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  isOpen,
  onClose,
  client,
  onEdit
}) => {
  const { user } = useAuth();
  const { getClientFinancials } = useLoans(user?.uid);
  const { exchangeRate } = useExchangeRate();
  const [financials, setFinancials] = React.useState({ totalPaid: 0, totalPending: 0, activeLoans: 0 });
  const [loading, setLoading] = React.useState(false);
  
  const [viewMode, setViewMode] = React.useState<'details' | 'history'>('details');
  const [historyRecords, setHistoryRecords] = React.useState<any[]>([]);

  React.useEffect(() => {
    setViewMode('details');
    setHistoryRecords([]);
  }, [isOpen]);

  React.useEffect(() => {
    let isMounted = true;
    if (isOpen && client && viewMode === 'details') {
      setLoading(true);
      getClientFinancials(client.id)
        .then(data => {
          if (isMounted) setFinancials(data);
        })
        .catch(err => console.error("Could not load financials", err))
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [isOpen, client?.id, getClientFinancials, viewMode]);

  const loadHistory = async () => {
    if (!user || !client) return;
    setLoading(true);
    try {
      const allRecords: any[] = [];
      const lQuery = query(collection(db, 'loans'), where('clientId', '==', client.id));
      const lSnap = await getDocs(lQuery);
      const clientLoanIds = lSnap.docs.map(d => d.id);
      
      lSnap.docs.forEach(d => {
        const data = d.data();
        allRecords.push({ id: d.id, type: 'egreso', amount: data.amount, date: data.createdAt, concept: 'Préstamo', currency: data.currency || 'USD' });
      });

      if (clientLoanIds.length > 0) {
        // Query chunking is safer but since it's a small app, we can fetch all user payments and filter locally
        // to avoid "in" query limits if client has many loans. OR we can use the 'in' array. We'll fetch all.
        const pQuery = query(collection(db, 'payments'), where('userId', '==', user.uid));
        const pSnap = await getDocs(pQuery);
        pSnap.docs.forEach(d => {
          const data = d.data();
          if (clientLoanIds.includes(data.loanId)) {
            allRecords.push({ id: d.id, type: 'ingreso', amount: data.amountPaid, date: data.paymentDate, concept: 'Abono/Pago', currency: data.currency || 'USD' });
          }
        });
      }

      allRecords.sort((a,b) => {
        const dA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
        const dB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
        return dB - dA;
      });

      setHistoryRecords(allRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;


  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'No registrado';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { 
       day: 'numeric', 
       month: 'short', 
       year: 'numeric' 
    });
  };

  const handleViewHistory = () => {
    setViewMode('history');
    loadHistory();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setViewMode('details'); }}
      title={viewMode === 'history' ? 'Historial de Movimientos' : client.name}
      subtitle={viewMode === 'history' ? `Cliente: ${client.name}` : 'Detalles del Cliente'}
      maxWidth="2xl"
    >
      <div className={`pt-4 transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        
        {viewMode === 'details' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Quick Profile Summary Card */}
            <Card hoverable={false} className="!p-6 md:!p-8">
               <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
                  <div className="w-24 h-24 bg-slate text-pear rounded-[30px] flex items-center justify-center shadow-2xl rotate-3">
                     <User size={48} strokeWidth={2.5} />
                  </div>
                  
                  <div className="flex-1 w-full space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl hover:bg-pear/10 transition-colors">
                           <Phone size={14} className="text-gray-400" />
                           <span className="text-xs md:text-sm font-bold text-slate">{client.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl hover:bg-indigo-50 transition-colors">
                           <Mail size={14} className="text-gray-400" />
                           <span className="text-xs md:text-sm font-bold text-slate truncate">{client.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl">
                           <Calendar size={14} className="text-gray-400" />
                           <span className="text-[10px] md:text-xs font-bold text-gray-500">Desde: {formatDate(client.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-emerald-50/30 rounded-2xl">
                           <ShieldCheck size={14} className="text-emerald-500" />
                           <span className="text-[10px] md:text-xs font-bold text-emerald-600">Préstamos Activos: {financials.activeLoans}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </Card>

            {/* Financial Overview - Bento Grid */}
            <div className="grid grid-cols-2 gap-4 md:gap-6">
               <div className="bg-emerald-500 p-6 md:p-8 rounded-[32px] md:rounded-[40px] text-white shadow-xl relative overflow-hidden group">
                  <TrendingUp size={20} className="mb-4 opacity-50" />
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-70">Abonado Total</p>
                  <p className="text-xl md:text-3xl font-[900] tracking-tighter italic">${financials.totalPaid.toLocaleString()}</p>
                  {exchangeRate?.rate && (
                     <p className="text-[10px] font-bold text-emerald-100 mt-1 italic tracking-widest">
                        ~ Bs. {(financials.totalPaid * exchangeRate.rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </p>
                  )}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 blur-2xl rounded-full"></div>
               </div>

               <div className="bg-slate p-6 md:p-8 rounded-[32px] md:rounded-[40px] text-white shadow-xl relative overflow-hidden group">
                  <CreditCard size={20} className="mb-4 text-pear" />
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-40">Deuda Pendiente</p>
                  <p className="text-xl md:text-3xl font-[900] tracking-tighter italic text-pear">${financials.totalPending.toLocaleString()}</p>
                  {exchangeRate?.rate && (
                     <p className="text-[10px] font-bold text-gray-400 mt-1 italic tracking-widest">
                        ~ Bs. {(financials.totalPending * exchangeRate.rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </p>
                  )}
               </div>
            </div>

            {/* Bottom Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
               <Button 
                onClick={onEdit}
                variant="primary"
                size="lg"
                rightIcon={<div className="p-1 bg-pear rounded-md text-slate"><ArrowRight size={12} strokeWidth={4} /></div>}
               >
                  Editar Perfil
               </Button>

               <Button 
                onClick={handleViewHistory}
                variant="outline"
                size="lg"
                leftIcon={<History size={16} />}
                className="border-indigo-100 text-indigo-700 hover:bg-indigo-50"
               >
                  Ver Historial
               </Button>

               <Button 
                variant="outline"
                size="lg"
                leftIcon={<Phone size={16} />}
                className="md:col-span-2"
                onClick={() => window.location.href = `tel:${client.phone}`}
               >
                  Llamar Cliente
               </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-4">
             <button 
                onClick={() => setViewMode('details')}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-slate transition-colors mb-4"
              >
                  <ArrowLeft size={14} /> Volver a Detalles
              </button>
             
             <div className="bg-gray-50 rounded-3xl overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                   <tbody className="divide-y divide-gray-100 text-slate">
                      {historyRecords.length === 0 ? (
                        <tr>
                          <td className="p-12 text-center text-gray-400 font-bold text-xs uppercase tracking-widest flex flex-col items-center gap-2">
                             <LayoutGrid size={32} className="opacity-20" />
                             Sin movimientos registrados
                          </td>
                        </tr>
                      ) : historyRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-white transition-all group">
                           <td className="p-4 pl-6">
                              <div className="flex flex-col">
                                 <span className="font-black text-xs tracking-tight">{formatDate(r.date)}</span>
                                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{r.concept}</span>
                              </div>
                           </td>
                           <td className="p-4">
                              <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${r.type === 'ingreso' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                 {r.type}
                              </span>
                           </td>
                           <td className="p-4 pr-6 text-right">
                              <span className={`text-sm font-black italic tracking-tighter ${r.type === 'ingreso' ? 'text-emerald-500' : 'text-slate'}`}>
                                 {r.type === 'ingreso' ? '+' : '-'}{r.currency === 'USD' ? '$' : 'Bs.'}{r.amount.toLocaleString()}
                              </span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClientDetailsModal;
