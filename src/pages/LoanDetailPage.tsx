import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  Trash2,
  Edit2,
  AlertTriangle,
  Banknote,
  SendHorizontal,
  Zap,
  Ban
} from 'lucide-react';
import { useLoans } from '../hooks/useLoans';
import type { Loan, Installment } from '../hooks/useLoans';
import { useAuth } from '../contexts/AuthContext';
import PaymentHistory from '../components/loans/PaymentHistory';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { useExchangeRate } from '../hooks/useExchangeRate';

const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getLoanById, recordGlobalPayment, cancelLoan, deleteLoan, updateLoanStructure } = useLoans(user?.uid);
  
  const [loan, setLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);

  const { exchangeRate } = useExchangeRate();

  const [activeTab, setActiveTab] = useState<'cronograma' | 'pagos' | 'abono'>('cronograma');

  // Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Payment Form States
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo USD');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedInstallmentIndices, setSelectedInstallmentIndices] = useState<number[]>([]);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    endDate: '',
    interestRate: 0,
    frequency: 'monthly' as Loan['frequency']
  });

  const fetchLoanData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getLoanById(id);
      if (data) {
        setLoan(data.loan);
        setInstallments(data.installments);
        
        const endDateVal = data.loan.endDate;
        const ed = (endDateVal as any).toDate ? (endDateVal as any).toDate() : new Date(endDateVal as any);
        setEditForm({
          endDate: ed.toISOString().split('T')[0],
          interestRate: data.loan.interestRate,
          frequency: data.loan.frequency
        });
      } else {
        setError("Préstamo no encontrado");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, getLoanById]);

  useEffect(() => {
    fetchLoanData();
  }, [fetchLoanData]);

  // Quick selection logic
  const toggleInstallmentSelection = (index: number) => {
    let newSelection = [...selectedInstallmentIndices];
    if (newSelection.includes(index)) {
      newSelection = newSelection.filter(i => i !== index);
    } else {
      // Ensure we select in order? Not strictly necessary but useful
      newSelection.push(index);
    }
    setSelectedInstallmentIndices(newSelection);
    
    // Calculate new amount
    const totalSelected = newSelection.reduce((sum, idx) => {
      const inst = installments[idx];
      const rate = (loan?.isIndexed && loan?.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
      const realAmount = (loan?.isIndexed && loan?.currency === 'VES' && inst.amountUSD) 
        ? (inst.amountUSD * rate) 
        : inst.amount;
      return sum + (realAmount - (inst.paidAmount || 0));
    }, 0);

    setPaymentAmount(totalSelected > 0 ? totalSelected.toFixed(2) : '');
  };


  useEffect(() => {
    if (loan?.currency) {
      setPaymentCurrency(loan.currency);
      setPaymentMethod(loan.currency === 'USD' ? 'Efectivo USD' : 'Pago Móvil');
    }
  }, [loan?.currency]);

  const totalPending = useMemo(() => {
     return installments.reduce((acc, inst) => {
        if (inst.status !== 'paid') {
           const rate = (loan?.isIndexed && loan?.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
           const realAmount = (loan?.isIndexed && loan?.currency === 'VES' && inst.amountUSD) 
             ? (inst.amountUSD * rate) 
             : inst.amount;
           return acc + (realAmount - (inst.paidAmount || 0));
        }
        return acc;
     }, 0);
  }, [installments, loan, exchangeRate]);

  const hasPayments = useMemo(() => {
     return installments.some(i => (i.paidAmount || 0) > 0);
  }, [installments]);

  const handleGlobalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !id || !paymentAmount || parseFloat(paymentAmount) <= 0) return;
    
    const inputAmount = parseFloat(paymentAmount);
    let finalPrincipalAmount = inputAmount;

    // Cross-Currency Mathematical BCV logic
    if (paymentCurrency === 'VES' && loan.currency === 'USD') {
        finalPrincipalAmount = inputAmount / (exchangeRate?.rate || 1);
    } else if (paymentCurrency === 'USD' && loan.currency === 'VES') {
        finalPrincipalAmount = inputAmount * (exchangeRate?.rate || 1);
    }

    setSubmittingPayment(true);
    try {
      await (recordGlobalPayment as any)(loan.id, finalPrincipalAmount, {
        method: paymentMethod, 
        currency: paymentCurrency, 
        originalAmount: inputAmount,
        note: paymentNote,
        currentRate: exchangeRate?.rate
      });
      setSelectedInstallmentIndices([]);
      setPaymentAmount('');
      setPaymentNote('');
      setRefreshHistory(prev => prev + 1);
      await fetchLoanData();
    } catch (err: any) {
      alert("Error al procesar pago: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !loan) return;
    setIsUpdating(true);
    try {
      await (cancelLoan as any)(id, cancelReason);
      setShowCancelModal(false);
      await fetchLoanData();
    } catch (err: any) {
      alert("Error al cancelar: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("¿Estás seguro de eliminar este préstamo definitivamente?")) return;
    setIsUpdating(true);
    try {
      await (deleteLoan as any)(id);
      navigate('/prestamos');
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !loan) return;
    
    setIsUpdating(true);
    try {
      await (updateLoanStructure as any)(id, {
        endDate: new Date(editForm.endDate + 'T12:00:00'),
        interestRate: Number(editForm.interestRate),
        frequency: editForm.frequency
      });
      setShowEditModal(false);
      await fetchLoanData();
    } catch (err: any) {
      alert("Error al editar: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-12 animate-in fade-in duration-500 pb-20">
        <div className="space-y-4">
           <Skeleton className="h-4 w-32" />
           <Skeleton className="h-16 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <Skeleton className="lg:col-span-4 h-[600px] rounded-[48px]" />
           <Skeleton className="lg:col-span-8 h-full min-h-[500px] rounded-[56px]" />
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
           <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate tracking-tighter italic uppercase">{error || "No encontrado"}</h2>
        <Button onClick={() => navigate('/prestamos')} variant="secondary" leftIcon={<ArrowLeft size={16} />}>
           Volver a Préstamos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32 max-w-[1600px] mx-auto">
      
      {/* ─── 1. BREADCRUMBS & TOP ACTIONS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <Link to="/prestamos" className="inline-flex items-center gap-2 text-gray-400 hover:text-slate font-black text-[10px] uppercase tracking-widest transition-all group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Listado de préstamos
         </Link>
         
         <div className="flex items-center gap-2">
            {loan.status === 'active' && !hasPayments && (
               <button onClick={() => setShowEditModal(true)} className="p-3 bg-white border border-slate/5 text-slate rounded-xl hover:bg-slate hover:text-white transition-all shadow-sm"><Edit2 size={16} /></button>
            )}
            {(loan.status === 'active' || loan.status === 'overdue') && (
               hasPayments ? (
                 <button onClick={() => setShowCancelModal(true)} className="p-3 bg-white border border-slate/5 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Anular"><Ban size={16} /></button>
               ) : (
                 <button onClick={handleDelete} className="p-3 bg-white border border-slate/5 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Eliminar"><Trash2 size={16} /></button>
               )
            )}
         </div>
      </div>

      {/* ─── 2. HERO DASHBOARD ─── */}
      <div className="bg-slate rounded-[40px] md:rounded-[56px] p-8 md:p-12 text-white relative overflow-hidden shadow-3xl">
         {/* Background accent */}
         <div className="absolute top-0 right-0 w-1/3 h-full bg-pear/10 skew-x-[-20deg] translate-x-1/2"></div>
         
         <div className="relative z-10 flex flex-col gap-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
               <div className="space-y-2">
                  <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest w-fit border shadow-lg ${
                    loan.status === 'completed' ? 'bg-emerald-500 text-white border-emerald-400' :
                    loan.status === 'cancelled' ? 'bg-rose-500 text-white border-rose-400' :
                    loan.status === 'overdue' ? 'bg-rose-500 text-white border-rose-400 animate-pulse' :
                    'bg-pear text-slate border-pear'
                  }`}>
                    {loan.status === 'completed' ? 'Finalizado' : loan.status === 'cancelled' ? 'Anulado' : loan.status === 'overdue' ? 'Vencido' : 'En Curso'}
                  </div>
                  <h1 className="text-2xl md:text-5xl font-black italic tracking-tighter uppercase leading-tight break-words max-w-2xl">
                    {loan.clientName}
                  </h1>
               </div>
               
               <div className="text-left md:text-right">
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Monto Total Contrato</p>
                  <p className="text-2xl md:text-4xl font-black italic tracking-tighter text-pear">
                    {loan.currency === 'USD' ? '$' : 'Bs.'}{loan.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 border-t border-white/10 pt-10">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Saldo Pendiente</p>
                  <p className="text-lg md:text-2xl font-black italic text-white tracking-tighter">
                     {loan.currency === 'USD' ? '$' : 'Bs.'}{totalPending.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Interés / Frecuencia</p>
                  <p className="text-lg md:text-2xl font-black italic text-white tracking-tighter">
                     {loan.interestRate}% <span className="text-xs uppercase text-white/40 ml-1">{loan.frequency}</span>
                  </p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Cuotas Pagadas</p>
                  <div className="flex items-baseline gap-2">
                     <span className="text-lg md:text-2xl font-black italic text-pear">{loan.paidInstallmentsCount}</span>
                     <span className="text-xs font-black text-white/20">/ {loan.numberOfInstallments}</span>
                  </div>
               </div>
               <div className="flex flex-col md:items-start">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Progreso</p>
                  <div className="w-full h-8 bg-white/5 rounded-2xl p-1 relative overflow-hidden flex items-center px-4">
                     <div 
                        className="absolute left-0 top-0 h-full bg-pear transition-all duration-1000" 
                        style={{ width: `${(loan.paidInstallmentsCount/loan.numberOfInstallments)*100}%` }}
                     ></div>
                     <span className="relative z-10 text-[11px] font-black italic text-white mix-difference">
                        {((loan.paidInstallmentsCount/loan.numberOfInstallments)*100).toFixed(0)}%
                     </span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* ─── 3. MAIN CONTENT GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         {/* LEFT/MAIN AREA: Schedule & History */}
         <div className="lg:col-span-8 space-y-8">
            
            {/* TABS (Mobile only switch) */}
            <div className="flex lg:hidden bg-white p-2 rounded-[24px] border border-slate/5 shadow-lg">
               <button 
                  onClick={() => setActiveTab('cronograma')}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cronograma' ? 'bg-slate text-pear' : 'text-gray-400'}`}
               >
                  Cuotas
               </button>
               <button 
                  onClick={() => setActiveTab('pagos')}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pagos' ? 'bg-slate text-pear' : 'text-gray-400'}`}
               >
                  Pagos
               </button>
               <button 
                  onClick={() => setActiveTab('abono')}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'abono' ? 'bg-pear text-slate shadow-xl' : 'text-gray-400'}`}
               >
                  Cobrar
               </button>
            </div>

            {/* CRONOGRAMA */}
            <div className={activeTab === 'cronograma' ? 'block' : 'hidden lg:block'}>
               <div className="bg-white rounded-[40px] md:rounded-[56px] border border-slate/5 shadow-2xl overflow-hidden p-3 md:p-6">
                  <div className="px-6 py-8 border-b border-gray-50 flex items-center gap-4">
                     <div className="p-3 bg-vanilla text-slate rounded-2xl"><Clock size={18} /></div>
                     <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate">Cronograma de Pagos</h3>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="border-b border-gray-50">
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300">#</th>
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300">Fecha</th>
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300">Estado</th>
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300">Cuota</th>
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300">Pagado</th>
                              <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-gray-300 text-right">Saldo</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {installments.map((inst, index) => {
                              const rate = (loan.isIndexed && loan.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
                              const realAmount = (loan.isIndexed && loan.currency === 'VES' && inst.amountUSD) ? (inst.amountUSD * rate) : inst.amount;
                              const remaining = realAmount - (inst.paidAmount || 0);
                              return (
                                 <tr key={inst.id} className="group hover:bg-gray-50/50 transition-all">
                                    <td className="px-6 py-6 text-xs font-black text-gray-300 italic">#{ (index+1).toString().padStart(2, '0') }</td>
                                    <td className="px-6 py-6 font-black text-sm text-slate uppercase">{formatDate(inst.dueDate)}</td>
                                    <td className="px-6 py-6">
                                       <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                          inst.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                          inst.status === 'partial' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                       }`}>
                                          {inst.status === 'paid' ? 'PAGADO' : inst.status === 'partial' ? 'AVANCE' : 'PENDIENTE'}
                                       </span>
                                    </td>
                                    <td className="px-6 py-6 font-bold text-gray-400 text-sm italic">{loan.currency === 'USD' ? '$' : 'Bs.'}{realAmount.toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                                    <td className="px-6 py-6 font-black text-slate text-sm italic">{loan.currency === 'USD' ? '$' : 'Bs.'}{(inst.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
                                    <td className="px-6 py-6 text-right font-black text-base italic text-slate">
                                       {remaining > 0 ? (
                                          <span className="text-rose-500">{loan.currency === 'USD' ? '$' : 'Bs.'}{remaining.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                                       ) : (
                                          <span className="text-emerald-500">LIQUIDADO</span>
                                       )}
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>

                  {/* Mobile Mobile List */}
                  <div className="md:hidden divide-y divide-gray-50">
                     {installments.map((inst, index) => {
                        const rate = (loan.isIndexed && loan.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
                        const realAmount = (loan.isIndexed && loan.currency === 'VES' && inst.amountUSD) ? (inst.amountUSD * rate) : inst.amount;
                        const remaining = realAmount - (inst.paidAmount || 0);
                        return (
                           <div key={inst.id} className="p-6 space-y-4">
                              <div className="flex justify-between items-center text-[9px] font-black tracking-widest uppercase">
                                 <span className="text-gray-300">Cuota #{index+1}</span>
                                 <span className={inst.status === 'paid' ? 'text-emerald-500' : inst.status === 'partial' ? 'text-amber-500' : 'text-gray-300'}>{formatDate(inst.dueDate)}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                 <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${inst.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                                    {inst.status === 'paid' ? 'Pagado' : inst.status === 'partial' ? 'Avance' : 'Pendiente'}
                                 </span>
                                 <div className="text-right">
                                    <p className="text-[9px] font-black text-gray-300 uppercase mb-1">Pendiente</p>
                                    <p className={`text-xl font-black italic tracking-tighter leading-none ${remaining > 0 ? 'text-slate' : 'text-emerald-500'}`}>
                                       {loan.currency === 'USD' ? '$' : 'Bs.'}{remaining.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                    </p>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            {/* HISTORIAL PAGOS */}
            <div className={activeTab === 'pagos' ? 'block' : 'hidden lg:block'}>
               <PaymentHistory loanId={loan.id} currency={loan.currency} refreshTrigger={refreshHistory} />
            </div>
         </div>

         {/* SIDEBAR AREA: Payment Form & Quick Stats */}
         <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-10">
            {/* Payment Panel */}
            <div className={activeTab === 'abono' ? 'block' : 'hidden lg:block'}>
               {loan.status === 'active' || loan.status === 'overdue' ? (
                 <Card className="!p-8 md:!p-10 !rounded-[48px] border-2 border-slate shadow-2xl space-y-10 bg-white">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-pear rounded-2xl flex items-center justify-center text-slate shadow-inner"><TrendingUp size={20} /></div>
                        <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate">Registrar Cobro</h3>
                     </div>

                     {/* ─── QUICK INSTALLMENT SELECTOR ─── */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Seleccionar Cuotas</span>
                           {selectedInstallmentIndices.length > 0 && (
                              <button 
                                 type="button"
                                 onClick={() => { setSelectedInstallmentIndices([]); setPaymentAmount(''); }}
                                 className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:underline"
                              >
                                 Limpiar
                              </button>
                           )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {installments
                              .map((inst, idx) => ({ ...inst, originalIndex: idx }))
                              .filter(inst => inst.status !== 'paid')
                              .slice(0, 6) // Solo mostrar las próximas 6 para no saturar
                              .map((inst) => (
                                 <button
                                    key={inst.id}
                                    type="button"
                                    onClick={() => toggleInstallmentSelection(inst.originalIndex)}
                                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                                       selectedInstallmentIndices.includes(inst.originalIndex)
                                       ? 'bg-slate border-slate text-pear shadow-lg scale-105'
                                       : 'bg-white border-gray-50 text-gray-400 hover:border-slate/10'
                                    }`}
                                 >
                                    #{inst.originalIndex + 1}
                                 </button>
                              ))
                           }
                           {installments.filter(i => i.status !== 'paid').length > 6 && (
                              <div className="px-4 py-3 rounded-2xl text-[10px] font-black text-gray-300 uppercase italic">...</div>
                           )}
                        </div>
                     </div>

                    <form onSubmit={handleGlobalPayment} className="space-y-8">
                        <div className="space-y-2">
                           <Input
                             label="Monto Recibido"
                             type="number"
                             step="0.01"
                             required
                             min="0.01"
                              value={paymentAmount}
                              onChange={(e) => {
                                 setPaymentAmount(e.target.value);
                                 if (selectedInstallmentIndices.length > 0) setSelectedInstallmentIndices([]); // Si escribe manual, desactiva selección
                              }}
                             className="font-black text-xl italic tracking-tighter"
                             icon={<span className="font-black text-sm italic text-gray-300">{paymentCurrency === 'USD' ? '$' : 'Bs.'}</span>}
                           />
                           
                           {/* Conversión visual rápida */}
                           {paymentCurrency !== loan.currency && paymentAmount && exchangeRate?.rate && (
                              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                 <span className="text-[9px] font-black uppercase text-emerald-800 tracking-widest italic leading-none">Equivalencia <br/> Préstamo</span>
                                 <span className="font-black text-lg text-emerald-600 italic tracking-tighter">
                                    {loan.currency === 'USD' ? '$' : 'Bs.'}
                                    {paymentCurrency === 'VES' 
                                      ? (parseFloat(paymentAmount) / exchangeRate.rate).toFixed(2)
                                      : (parseFloat(paymentAmount) * exchangeRate.rate).toFixed(2)
                                    }
                                 </span>
                              </div>
                           )}
                        </div>

                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-[28px]">
                              {['USD', 'VES'].map(c => (
                                 <button key={c} type="button" onClick={() => { setPaymentCurrency(c as any); setPaymentMethod(c === 'USD' ? 'Efectivo USD' : 'Pago Móvil'); }} className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentCurrency === c ? 'bg-slate text-pear shadow-xl' : 'text-gray-400 hover:text-slate'}`}>{c}</button>
                              ))}
                           </div>

                           <div className="grid grid-cols-3 gap-3">
                              {(paymentCurrency === 'USD' 
                                ? [{ id: 'Efectivo USD', icon: Banknote, l: 'Efec' }, { id: 'Zelle', icon: Zap, l: 'Zelle' }, { id: 'Binance', icon: SendHorizontal, l: 'Binan' }]
                                : [{ id: 'Pago Móvil', icon: Zap, l: 'P Móv' }, { id: 'Transferencia', icon: SendHorizontal, l: 'Transf' }, { id: 'Efectivo VES', icon: Banknote, l: 'Efec' }]
                              ).map(m => (
                                 <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)} className={`py-4 flex flex-col items-center gap-1.5 rounded-2xl border transition-all ${paymentMethod === m.id ? 'bg-slate border-slate text-pear shadow-lg scale-105' : 'bg-gray-50/50 border-transparent text-gray-400 hover:border-slate/10'}`}>
                                    <m.icon size={18} />
                                    <span className="text-[8px] font-black uppercase tracking-wider">{m.l}</span>
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="relative">
                           <FileText className="absolute left-6 top-6 text-gray-400" size={20} />
                           <textarea className="w-full bg-vanilla/50 border-2 border-transparent focus:border-slate focus:bg-white p-6 pl-16 rounded-[32px] font-bold text-sm text-slate placeholder:text-gray-400 outline-none transition-all min-h-[140px]" placeholder="Ej: Pago adelantado..." value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
                        </div>

                        <Button type="submit" isLoading={submittingPayment} disabled={!paymentAmount} variant="primary" size="lg" className="w-full !rounded-[32px] text-base" rightIcon={<TrendingUp size={20} />}>
                           REGISTRAR COBRO
                        </Button>
                    </form>
                 </Card>
               ) : (
                 <div className={`p-10 rounded-[48px] border-2 space-y-6 shadow-sm ${loan.status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    <div className="p-3 bg-white rounded-2xl shadow-inner w-fit mx-auto">{loan.status === 'cancelled' ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}</div>
                    <div className="text-center space-y-2">
                       <h3 className="text-2xl font-black uppercase italic tracking-tighter">{loan.status === 'cancelled' ? 'Anulado' : 'Finalizado'}</h3>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 leading-relaxed">
                          {loan.status === 'cancelled' ? `Cancelado el ${formatDate(loan.cancelledAt)}` : 'Este préstamo ha sido liquidado exitosamente.'}
                       </p>
                    </div>
                 </div>
               )}
            </div>

            {/* Quick Meta Info */}
            <div className="bg-vanilla p-8 rounded-[40px] border border-slate/5 space-y-6">
               <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate/30 ml-1">Estructura del Contrato</h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-gray-400 italic">Fecha Inicio</span>
                     <span className="text-slate">{formatDate(loan.startDate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-gray-400 italic">Fecha Vencimiento</span>
                     <span className="text-slate">{formatDate(loan.endDate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest border-t border-slate/5 pt-4">
                     <span className="text-gray-400 italic">Tasa Mensual</span>
                     <span className="text-slate">{loan.interestRate}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-gray-400 italic">Modo Indexado</span>
                     <span className={loan.isIndexed ? 'text-emerald-500' : 'text-rose-500'}>{loan.isIndexed ? 'Sí (BCV)' : 'Directo'}</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

         {/* Payment History Section */}
         <div className="lg:col-span-12 mt-12 pb-20">
            <PaymentHistory 
               loanId={loan.id} 
               currency={loan.currency} 
               refreshTrigger={refreshHistory} 
            />
         </div>

      {/* CANCEL MODAL */}
      <Modal
         isOpen={showCancelModal}
         onClose={() => setShowCancelModal(false)}
         title="Anular Préstamo"
         subtitle="Seguridad"
         maxWidth="lg"
      >
         <div className="space-y-8 pt-4">
            <div className="flex items-center gap-6 p-6 bg-rose-50 rounded-[32px] border-2 border-rose-100">
               <div className="w-16 h-16 bg-white shrink-0 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                  <AlertTriangle size={32} />
               </div>
               <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-rose-600">Acción Crítica</h3>
                  <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider leading-relaxed">
                     Esta acción detendrá todos los cobros programados de forma permanente.
                  </p>
               </div>
            </div>

            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2">Motivo de Cancelación</label>
               <textarea 
                  className="w-full bg-[#F5F5F3]/50 p-6 rounded-[32px] font-bold text-sm text-slate placeholder:text-gray-400 outline-none focus:bg-white border-2 border-transparent focus:border-rose-500 transition-all min-h-[120px]"
                  placeholder="Ej: Devolución de capital por parte del cliente..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
               />
            </div>

            <div className="flex gap-4 pt-2">
               <Button 
                  variant="outline"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 !rounded-[24px]"
               >
                  Retroceder
               </Button>
               <Button 
                  variant="primary"
                  onClick={handleCancel}
                  isLoading={isUpdating}
                  className="flex-1 !rounded-[24px] !bg-rose-500 !text-white"
               >
                  Confirmar Anulación
               </Button>
            </div>
         </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
         isOpen={showEditModal}
         onClose={() => setShowEditModal(false)}
         title="Ajustar Estructura"
         subtitle="Configuración"
         maxWidth="xl"
      >
         <form onSubmit={handleEditSave} className="space-y-8 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Input 
                  label="Nueva Fecha Fin"
                  type="date"
                  required
                  icon={<Clock size={20} />}
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({...editForm, endDate: e.target.value})}
               />
               <Input 
                  label="Tasa de Interés (%)"
                  type="number"
                  required
                  icon={<TrendingUp size={20} />}
                  value={editForm.interestRate}
                  onChange={(e) => setEditForm({...editForm, interestRate: Number(e.target.value)})}
                  className="font-black text-xl italic"
               />

               <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2">Frecuencia de Pagos</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-2 rounded-[28px]">
                     {['daily', 'weekly', 'monthly', 'yearly'].map(f => (
                        <button
                           key={f}
                           type="button"
                           onClick={() => setEditForm({...editForm, frequency: f as any})}
                           className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${editForm.frequency === f ? 'bg-slate text-pear shadow-xl' : 'text-gray-400 hover:text-slate hover:bg-white'}`}
                        >
                           {f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : f === 'monthly' ? 'Mensual' : 'Anual'}
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-[32px] border-2 border-amber-100 flex gap-4 shadow-sm">
               <AlertCircle className="text-amber-500 shrink-0" />
               <p className="text-[10px] font-black text-amber-700 uppercase leading-relaxed tracking-wider">
                  Las cuotas actuales se regenerarán desde cero con los nuevos parámetros de tiempo e interés.
               </p>
            </div>

            <div className="flex gap-4 pt-2">
               <Button 
                  variant="outline"
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 !rounded-[24px]"
               >
                  Cancelar
               </Button>
               <Button 
                  variant="primary"
                  type="submit"
                  isLoading={isUpdating}
                  className="flex-1 !rounded-[24px]"
               >
                  Aplicar Cambios
               </Button>
            </div>
         </form>
      </Modal>

    </div>
  );
};

export default LoanDetailPage;
