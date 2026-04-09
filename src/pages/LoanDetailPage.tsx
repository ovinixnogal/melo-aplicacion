import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  CreditCard,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  TrendingUp,
  PlusCircle,
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

  // Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  // Form State
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo USD');
  const [paymentNote, setPaymentNote] = useState('');

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
      <div className="p-4 md:p-12 space-y-12 animate-in fade-in duration-500 pb-20">
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
    <div className="p-4 md:p-12 space-y-8 md:space-y-12 animate-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* 1. Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-4">
          <Link to="/prestamos" className="inline-flex items-center gap-2 text-gray-400 hover:text-slate font-black text-[10px] uppercase tracking-widest transition-all group">
             <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver al Listado
          </Link>
          <div className="flex flex-col md:flex-row md:items-start gap-4">
             <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate tracking-tighter italic leading-[0.9] uppercase underline decoration-pear decoration-8 underline-offset-8 break-words max-w-full">
               {loan.clientName}
             </h1>
             <div className="flex gap-2 mt-4 md:mt-2 shrink-0">
                <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border-2 shadow-xl ${
                  loan.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  loan.status === 'cancelled' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                  loan.status === 'overdue' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-200' :
                  'bg-pear text-slate border-pear/30 shadow-pear/10'
                }`}>
                  {loan.status === 'completed' ? 'Finalizado' : 
                   loan.status === 'cancelled' ? 'Cancelado / Fallido' : 
                   loan.status === 'overdue' ? '⚡ Vencido (Mora)' : 'Activo'}
                </span>
             </div>
          </div>
        </div>
        
        {/* Actions Button Group */}
        <div className="flex gap-2">
           {loan.status === 'active' && !hasPayments && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                leftIcon={<Edit2 size={16} />}
              >
                Editar
              </Button>
           )}
           {(loan.status === 'active' || loan.status === 'overdue') && (
               <>
                 {hasPayments ? (
                   <Button 
                     variant="ghost"
                     size="sm"
                     onClick={() => setShowCancelModal(true)}
                     leftIcon={<Ban size={16} />}
                     className="text-rose-500 hover:bg-rose-50"
                   >
                     Cancelar Préstamo
                   </Button>
                 ) : (
                   <Button 
                     variant="ghost"
                     size="sm"
                     onClick={handleDelete}
                     leftIcon={<Trash2 size={16} />}
                     className="text-rose-500 hover:bg-rose-50"
                   >
                     Eliminar Definitivamente
                   </Button>
                 )}
               </>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* LEFT: Payment Form & Summary */}
         <div className="lg:col-span-4 space-y-8">
            
            {/* Payment Panel - Hide if cancelled/completed */}
            {loan.status === 'active' ? (
              <Card className="!p-10 !rounded-[48px] border-4 border-slate shadow-2xl space-y-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pear rounded-2xl flex items-center justify-center text-slate shadow-inner"><PlusCircle size={24} /></div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate">Nuevo Abono</h3>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate uppercase tracking-[0.4em] ml-2 italic opacity-40">Total Pendiente Actual</p>
                    <div className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-slate leading-none">
                    {loan.currency === 'USD' ? <span className="text-xl mr-0.5 text-gray-300">$</span> : <span className="text-xl mr-0.5 text-gray-300">Bs.</span>}
                    {totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                    {loan.currency === 'VES' && loan.rateAtCreation && (
                        <div className="flex flex-col gap-1 mt-2 text-[10px] font-bold text-gray-400">
                           <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                              <span>Equivalente Original:</span>
                              <span className="text-slate font-black">~{(totalPending / loan.rateAtCreation).toFixed(2)} USD</span>
                           </div>
                           {exchangeRate?.rate && (
                              <div className="flex items-center justify-between pt-1">
                                 <span>Equivalente Hoy (BCV: {exchangeRate.rate.toFixed(2)}):</span>
                                 <span className="text-pear font-black italic text-xs">~{(totalPending / exchangeRate.rate).toFixed(2)} USD</span>
                              </div>
                           )}
                        </div>
                    )}
                </div>

                <form onSubmit={handleGlobalPayment} className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2 opacity-50 italic">Moneda a Recibir</label>
                      <div className="flex gap-3 bg-gray-50/50 p-2.5 rounded-[32px] border border-slate/5">
                        {['USD', 'VES'].map((curr) => (
                           <button
                             key={curr}
                             type="button"
                             onClick={() => {
                                setPaymentCurrency(curr as any);
                                setPaymentMethod(curr === 'USD' ? 'Efectivo USD' : 'Pago Móvil');
                             }}
                             className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-500 transform ${paymentCurrency === curr ? 'bg-slate text-pear shadow-2xl scale-[1.02] shadow-slate/20' : 'text-gray-400 hover:text-slate hover:bg-white border border-transparent'}`}
                           >
                             {curr}
                           </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                       <Input
                         label="Monto Recibido"
                         type="number"
                         step="0.01"
                         required
                         min="0.01"
                         value={paymentAmount}
                         onChange={(e) => setPaymentAmount(e.target.value)}
                         className="font-black text-3xl italic tracking-tighter"
                         icon={<span className="font-black text-xl italic text-gray-300">{paymentCurrency === 'USD' ? '$' : 'Bs.'}</span>}
                       />

                       {/* Mostrar conversión cruzada si pagan en moneda distinta al préstamo */}
                       {paymentCurrency !== loan.currency && paymentAmount && exchangeRate?.rate && parseFloat(paymentAmount) > 0 && (
                          <div className="px-6 py-4 mt-2 bg-emerald-50 rounded-[24px] border border-emerald-100 flex items-center justify-between text-emerald-700 animate-in fade-in slide-in-from-top-2">
                             <div className="flex flex-col">
                               <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Equivalente Real</span>
                               <span className="text-[10px] font-bold italic tracking-widest">Amortizará a capital deudor</span>
                             </div>
                             <span className="font-[900] italic text-2xl tracking-tighter">
                               {loan.currency === 'USD' ? '$' : 'Bs.'}
                               {paymentCurrency === 'VES' 
                                 ? (parseFloat(paymentAmount) / exchangeRate.rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})
                                 : (parseFloat(paymentAmount) * exchangeRate.rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})
                               }
                             </span>
                          </div>
                       )}
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2 opacity-50 italic">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-3 bg-gray-50/50 p-2.5 rounded-[32px] border border-slate/5">
                          {(paymentCurrency === 'USD' 
                            ? [
                                { id: 'Efectivo USD', icon: Banknote, label: 'Efectivo' },
                                { id: 'Zelle', icon: Zap, label: 'Zelle' },
                                { id: 'Binance', icon: SendHorizontal, label: 'Binance' }
                              ]
                            : [
                                { id: 'Pago Móvil', icon: Zap, label: 'Pago Móv' },
                                { id: 'Transferencia', icon: SendHorizontal, label: 'Transf' },
                                { id: 'Efectivo VES', icon: Banknote, label: 'Efectivo' }
                              ]
                          ).map(m => (
                            <button
                                key={m.id}
                                type="button"
                                title={m.id}
                                onClick={() => setPaymentMethod(m.id)}
                                className={`py-4 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300 transform ${paymentMethod === m.id ? 'bg-slate text-pear shadow-xl scale-105 shadow-slate/20' : 'text-gray-400 hover:text-slate hover:bg-white hover:shadow-md'}`}
                            >
                                <m.icon size={22} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate ml-2">Notas del Cobro</label>
                      <div className="relative">
                          <FileText className="absolute left-6 top-6 text-gray-200" size={20} />
                          <textarea 
                            className="w-full bg-[#F5F5F3]/50 border-2 border-transparent focus:border-slate focus:bg-white p-6 pl-16 rounded-[32px] font-bold text-sm outline-none transition-all min-h-[140px]"
                            placeholder="Ej: Pago adelantado..."
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                          />
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      isLoading={submittingPayment}
                      disabled={!paymentAmount}
                      variant="primary"
                      size="lg"
                      className="w-full !rounded-[32px]"
                      rightIcon={<TrendingUp size={20} />}
                    >
                      REGISTRAR COBRO
                    </Button>
                </form>
              </Card>
            ) : loan.status === 'cancelled' ? (
              <div className="bg-rose-50 p-10 rounded-[48px] border-2 border-rose-100 space-y-6 shadow-sm">
                 <div className="flex items-center gap-4 text-rose-500">
                    <div className="p-3 bg-white rounded-2xl shadow-inner"><AlertTriangle size={24} /></div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">Préstamo Cancelado</h3>
                 </div>
                 <p className="text-xs font-bold text-rose-400 uppercase tracking-widest leading-relaxed">Este préstamo fue anulado el <span className="text-rose-600 underline underline-offset-4 decoration-2">{formatDate(loan.cancelledAt)}</span></p>
                 {loan.cancellationReason && (
                    <div className="p-6 bg-white rounded-[32px] italic text-xs text-slate/70 font-medium shadow-sm border border-rose-100/50">
                       "{loan.cancellationReason}"
                    </div>
                 )}
                 <Button variant="ghost" className="w-full text-rose-500 hover:bg-white/50" onClick={() => navigate('/prestamos')}>
                    Explorar otros créditos
                 </Button>
              </div>
            ) : (
              <div className="bg-emerald-50 p-10 rounded-[48px] border-2 border-emerald-100 space-y-6 shadow-sm">
                 <div className="flex items-center gap-4 text-emerald-600">
                    <div className="p-3 bg-white rounded-2xl shadow-inner"><CheckCircle2 size={24} /></div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">Crédito Finalizado</h3>
                 </div>
                 <p className="text-[11px] font-black text-emerald-500/80 uppercase tracking-[0.1em] leading-relaxed">El capital y los intereses han sido pagados en su totalidad. No hay deuda pendiente.</p>
                 <Button variant="ghost" className="w-full text-emerald-600 hover:bg-white/50" onClick={() => navigate('/prestamos')}>
                    Ver historial completo
                 </Button>
              </div>
            )}

            {/* Quick Stat Card */}
            <div className="bg-pear p-10 rounded-[48px] shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
                  <CreditCard size={180} />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate/40 mb-3 ml-1">Cuotas Liquidadas</p>
               <div className="flex items-baseline gap-3">
                  <h4 className="text-7xl font-[900] italic tracking-tighter text-slate">{loan.paidInstallmentsCount}</h4>
                  <span className="text-2xl font-black text-slate/30">/ {loan.numberOfInstallments}</span>
               </div>
               <div className="mt-8 pt-6 border-t border-slate/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate/60 italic flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-slate animate-pulse"></div>
                     Progreso del contrato
                  </div>
               </div>
            </div>
         </div>

         {/* RIGHT: Table & Details */}
         <div className="lg:col-span-8 space-y-8">
            
            {/* Installments List */}
            <div className="bg-white rounded-[56px] border border-slate/5 shadow-2xl overflow-hidden p-3">
               <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <div className="w-2 h-8 bg-pear rounded-full shadow-inner"></div>
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate">Cronograma de Pagos</h3>
                  </div>
                  <div className="hidden md:block text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">
                     Sincronizado via Melo Engine
                  </div>
               </div>

               {/* Table Desktop */}
               <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-gray-50">
                           <th className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">№</th>
                           <th className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">Vencimiento</th>
                           <th className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                           <th className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">Cuota</th>
                           <th className="px-8 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400">Pagado</th>
                           <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Balance</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {installments.map((inst, index) => {
                           const rate = (loan.isIndexed && loan.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
                           const realAmount = (loan.isIndexed && loan.currency === 'VES' && inst.amountUSD) 
                             ? (inst.amountUSD * rate) 
                             : inst.amount;
                           const remainingInst = realAmount - (inst.paidAmount || 0);
                           
                           return (
                             <tr key={inst.id} className="hover:bg-gray-50/50 transition-all group">
                                <td className="px-8 py-6">
                                   <span className="text-xs font-black text-gray-300 group-hover:text-slate italic transition-colors">#{(index + 1).toString().padStart(2, '0')}</span>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-3">
                                      <Clock size={14} className="text-gray-200 group-hover:text-slate transition-colors" />
                                      <span className="font-black text-sm text-slate tracking-tight uppercase">{formatDate(inst.dueDate)}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                      inst.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                      inst.status === 'partial' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                      'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                      {inst.status === 'paid' ? <CheckCircle2 size={12} /> : inst.status === 'partial' ? <TrendingUp size={12} /> : <Clock size={12} />}
                                      {inst.status === 'paid' ? 'PAGADO' : inst.status === 'partial' ? 'PARCIAL' : 'PENDIENTE'}
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex flex-col">
                                      <span className="font-bold text-gray-400 text-sm italic tracking-tighter">
                                        {loan.currency === 'USD' ? '$' : 'Bs.'}{realAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                      {loan.isIndexed && loan.currency === 'VES' && (
                                         <span className="text-[8px] font-black text-gray-300 uppercase">Original: Bs.{inst.amount.toFixed(2)}</span>
                                      )}
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <span className="font-black text-slate text-sm italic tracking-tighter">
                                      {loan.currency === 'USD' ? '$' : 'Bs.'}{(inst.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <span className={`font-black text-base italic tracking-tighter ${remainingInst > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                      {loan.currency === 'USD' ? '$' : 'Bs.'}{remainingInst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                   </span>
                                </td>
                             </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>

               {/* Mobile List View */}
               <div className="md:hidden divide-y divide-gray-50 bg-[#F5F5F3]/30">
                  {installments.map((inst, index) => {
                      const rate = (loan.isIndexed && loan.currency === 'VES') ? (exchangeRate?.rate || 1) : 1;
                      const realAmount = (loan.isIndexed && loan.currency === 'VES' && inst.amountUSD) 
                         ? (inst.amountUSD * rate) 
                         : inst.amount;
                      const remainingInst = realAmount - (inst.paidAmount || 0);
                      
                      return (
                         <div key={inst.id} className="p-8 space-y-6 hover:bg-white transition-colors">
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] italic">Cuota #{(index+1).toString().padStart(2, '0')}</span>
                               <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                  inst.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                  inst.status === 'partial' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                  'bg-white text-gray-400 border-gray-100'}`}>
                                  {inst.status === 'paid' ? 'PAGADO' : inst.status === 'partial' ? 'ABONADO' : 'PENDIENTE'}
                               </div>
                            </div>
                            <div className="flex justify-between items-end">
                               <div className="space-y-1">
                                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Vencimiento</p>
                                  <p className="font-black text-slate uppercase text-sm">{formatDate(inst.dueDate)}</p>
                               </div>
                               <div className="text-right space-y-1">
                                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Saldo Pendiente</p>
                                  <p className={`text-2xl font-black italic tracking-tighter leading-none ${remainingInst > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                     {loan.currency === 'USD' ? '$' : 'Bs.'}{remainingInst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </p>
                               </div>
                            </div>
                         </div>
                      );
                   })}
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
                  className="w-full bg-[#F5F5F3]/50 p-6 rounded-[32px] font-bold text-sm outline-none focus:bg-white border-2 border-transparent focus:border-rose-500 transition-all min-h-[120px]"
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
