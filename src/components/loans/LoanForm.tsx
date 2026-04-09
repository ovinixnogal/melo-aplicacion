import React, { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Search, 
  Plus, 
  Calendar, 
  DollarSign, 
  Percent, 
  Info,
  Check,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import type { Client } from '../../hooks/useClients';
import { useLoans } from '../../hooks/useLoans';
import { useAuth } from '../../contexts/AuthContext';
import ClientModal from '../clients/ClientModal';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useExchangeRate } from '../../hooks/useExchangeRate';

const loanSchema = z.object({
  clientId: z.string().min(1, "Debes seleccionar un cliente"),
  clientName: z.string().min(1, "Nombre del cliente es requerido"),
  currency: z.enum(['USD', 'VES']),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  interestRate: z.number().min(0, "El interés no puede ser negativo"),
  startDate: z.string().min(1, "Requerido"),
  endDate: z.string().min(1, "Requerido"),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  isIndexed: z.boolean(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  return end >= start;
}, {
  message: "La fecha de fin debe ser posterior o igual a la de inicio",
  path: ["endDate"],
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { clients, addClient } = useClients();
  const { createLoan } = useLoans(user?.uid);
  const { exchangeRate } = useExchangeRate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors }
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      currency: 'USD',
      amount: 0,
      interestRate: 10,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      frequency: 'weekly',
      isIndexed: false,
    }
  });

  const watchedValues = useWatch({ control });

  // FILTRADO DE CLIENTES
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients.slice(0, 5);
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone?.includes(searchTerm)
    ).slice(0, 5);
  }, [clients, searchTerm]);

  const selectClient = (client: Client) => {
    setValue('clientId', client.id);
    setValue('clientName', client.name);
    setSearchTerm(client.name);
    setShowDropdown(false);
  };

  // CÁLCULOS EN TIEMPO REAL
  const calculations = useMemo(() => {
    const amount = watchedValues.amount || 0;
    const rate = watchedValues.interestRate || 0;
    const start = watchedValues.startDate ? new Date(watchedValues.startDate) : new Date();
    const end = watchedValues.endDate ? new Date(watchedValues.endDate) : new Date();
    const freq = watchedValues.frequency || 'weekly';

    const totalInterest = (amount * rate / 100);
    const totalToPay = amount + totalInterest;
    
    let numInstallments = 0;
    const isYearly = freq === 'yearly';
    const isMonthly = freq === 'monthly';

    if (isMonthly) {
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      numInstallments = yearDiff * 12 + monthDiff;
    } else if (isYearly) {
      numInstallments = end.getFullYear() - start.getFullYear();
    } else {
      const diffTime = end.getTime() - start.getTime();
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const freqDaysMap: Record<string, number> = { daily: 1, weekly: 7 };
      const freqDays = freqDaysMap[freq] || 7;
      numInstallments = Math.round(diffDays / freqDays);
    }

    if (numInstallments <= 0) numInstallments = 1;

    const installmentAmount = totalToPay / numInstallments;
    
    // Proyección de fechas (Primera y Última)
    const firstDueDate = new Date(start);
    if (isMonthly) firstDueDate.setMonth(firstDueDate.getMonth() + 1);
    else if (isYearly) firstDueDate.setFullYear(firstDueDate.getFullYear() + 1);
    else {
      const freqDaysMap: Record<string, number> = { daily: 1, weekly: 7 };
      firstDueDate.setDate(firstDueDate.getDate() + (freqDaysMap[freq] || 7));
    }
    
    // Cálculo simplificado de la última fecha para el resumen
    const lastDueDate = new Date(start);
    if (isMonthly) lastDueDate.setMonth(lastDueDate.getMonth() + numInstallments);
    else if (isYearly) lastDueDate.setFullYear(lastDueDate.getFullYear() + numInstallments);
    else {
      const freqDaysMap: Record<string, number> = { daily: 1, weekly: 7 };
      lastDueDate.setDate(lastDueDate.getDate() + (numInstallments * (freqDaysMap[freq] || 7)));
    }
    const actualLastDate = lastDueDate > end ? end : lastDueDate;

    return {
      totalToPay,
      totalInterest,
      numInstallments,
      installmentAmount,
      firstDueDate,
      lastDueDate: actualLastDate,
      freqLabel: freq === 'daily' ? 'día' : freq === 'weekly' ? 'semana' : freq === 'monthly' ? 'mes' : 'año'
    };
  }, [watchedValues]);

  const onSubmit = async (data: LoanFormData) => {
    setLoading(true);
    try {
      const isVES = data.currency === 'VES';
      const bcvRate = exchangeRate?.rate;
      const bcvPayload = isVES && bcvRate ? {
        amountVES: data.amount,
        rateAtCreation: bcvRate,
        amountUSDEquivalent: parseFloat((data.amount / bcvRate).toFixed(2)),
        isIndexed: data.isIndexed
      } : {
        isIndexed: false
      };

      await createLoan({
        ...data,
        ...bcvPayload,
        startDate: new Date(data.startDate + 'T00:00:00'),
        endDate: new Date(data.endDate + 'T00:00:00'),
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Préstamo"
      subtitle="Financiamiento"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pt-4">
         
         {/* 1. SELECCIÓN DE CLIENTE */}
         <div className="space-y-3 relative">
            <Input
              label="Seleccionar Cliente"
              placeholder="Escribe el nombre del cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              icon={<Search size={18} />}
              error={errors.clientId?.message}
            />

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-white border border-gray-100 rounded-[28px] shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
                 <div className="p-2 space-y-1">
                    {filteredClients.map(c => (
                      <button 
                        key={c.id} 
                        type="button"
                        onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all text-left group"
                      >
                         <div className="w-10 h-10 bg-slate text-pear rounded-xl flex items-center justify-center font-black text-xs overflow-hidden min-w-[40px]">
                            {(c as any).avatarUrl ? (
                               <img src={(c as any).avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                               c.name[0].toUpperCase()
                            )}
                         </div>
                         <div className="flex-1">
                            <p className="font-bold text-slate group-hover:italic transition-all">{c.name}</p>
                            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">{c.phone || 'Sin teléfono'}</p>
                         </div>
                         <Check size={16} className={`text-emerald-500 transition-opacity ${watchedValues.clientId === c.id ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    ))}
                    <button 
                       type="button"
                       onClick={() => setIsClientModalOpen(true)}
                       className="w-full flex items-center justify-center gap-2 p-4 text-slate font-black text-[10px] uppercase tracking-widest border-t border-gray-50 hover:bg-emerald-50 hover:text-emerald-700 transition-all opacity-60 hover:opacity-100"
                    >
                       <Plus size={14} /> Nuevo Cliente
                    </button>
                 </div>
              </div>
            )}
         </div>

         {/* 2. MONEDA Y MONTO */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Moneda</label>
               <div className="flex gap-3 bg-white p-2 border-2 border-slate/5 rounded-[24px]">
                  {['USD', 'VES'].map((curr) => (
                    <button 
                      key={curr}
                      type="button" 
                      onClick={() => {
                        setValue('currency', curr as any);
                        if (curr === 'USD') setValue('isIndexed', false);
                      }}
                      className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${watchedValues.currency === curr ? 'bg-slate text-pear shadow-xl' : 'text-gray-300 hover:text-gray-400'}`}
                    >
                      {curr}
                    </button>
                  ))}
               </div>
               
               {/* BCV Indexing Toggle */}
               {watchedValues.currency === 'VES' && (
                  <div className="p-4 bg-emerald-50 rounded-[28px] border border-emerald-100 transition-all space-y-3">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                              <TrendingUp size={14} />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Indexación al Dólar</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                           <input 
                              type="checkbox" 
                              className="sr-only peer"
                              {...register('isIndexed')}
                           />
                           <div className="w-11 h-6 bg-emerald-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                     </div>
                     
                     <p className="text-[9px] font-bold text-emerald-800/60 uppercase tracking-tight leading-relaxed">
                        {watchedValues.isIndexed 
                          ? "Activado: El cobro se ajustará automáticamente a la tasa BCV del día del pago."
                          : "Desactivado: El préstamo se cobrará en montos fijos de Bolívares."}
                     </p>

                     {exchangeRate?.rate && (
                        <div className="pt-2 border-t border-emerald-200/50 flex justify-between items-center">
                           <span className="text-[8px] font-black uppercase text-emerald-600/40 tracking-widest">Tasa BCV de Hoy</span>
                           <span className="text-[11px] font-black italic text-emerald-700">1 USD = {exchangeRate.rate.toFixed(2)} VES</span>
                        </div>
                     )}
                  </div>
               )}
            </div>

            <div className="space-y-3">
              <Input
                label="Monto Préstamo"
                type="number"
                step="0.01"
                icon={<DollarSign size={24} className="text-slate/20" />}
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
                className="font-black text-xl italic tracking-tighter"
              />
              
              {watchedValues.currency === 'VES' && exchangeRate?.rate && (watchedValues.amount || 0) > 0 && (
                <div className="mx-2 text-right">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Equivalente: <span className="text-slate">~{((watchedValues.amount || 0) / exchangeRate.rate).toFixed(2)} USD</span>
                  </span>
                </div>
              )}
            </div>
         </div>

         {/* 3. INTERÉS Y FRECUENCIA */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Interés (%)"
              type="number"
              icon={<Percent size={20} className="text-gray-300" />}
              error={errors.interestRate?.message}
              {...register('interestRate', { valueAsNumber: true })}
              className="font-black text-xl italic tracking-tighter"
            />

            <div className="space-y-3 w-full">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Frecuencia Pago</label>
               <div className="relative">
                  <select 
                    {...register('frequency')}
                    className="w-full p-5 pr-12 bg-[#F5F5F3]/50 border-2 border-transparent focus:border-pear rounded-[24px] font-black text-xs uppercase tracking-[0.2em] focus:outline-none focus:bg-white transition-all appearance-none cursor-pointer text-slate"
                  >
                     <option value="daily">Diario</option>
                     <option value="weekly">Semanal</option>
                     <option value="monthly">Mensual</option>
                     <option value="yearly">Anual</option>
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
               </div>
            </div>
         </div>

         {/* 4. FECHAS — Balanceado para evitar scroll horizontal */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3 min-w-0">
               <Input
                 label="Fecha Inicio"
                 type="date"
                 icon={<Calendar size={18} className="text-gray-300" />}
                 error={errors.startDate?.message}
                 {...register('startDate')}
               />
            </div>

            <div className="space-y-3 min-w-0">
               <Input
                 label="Fecha Vencimiento"
                 type="date"
                 icon={<Calendar size={18} className="text-gray-300" />}
                 error={errors.endDate?.message}
                 {...register('endDate')}
               />
               <div className="flex items-center gap-2 mt-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wider overflow-hidden">
                  <TrendingUp size={12} className="shrink-0" /> <span className="truncate">Resultará en {calculations.numInstallments} cuotas</span>
               </div>
            </div>
         </div>

         {/* 5. RESUMEN */}
         <div className="bg-slate rounded-[40px] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pear opacity-5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-pear text-slate rounded-xl"><Info size={16} strokeWidth={3} /></div>
               <h4 className="text-[11px] font-[900] uppercase tracking-widest text-pear">Resumen del Préstamo</h4>
            </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                <div className="space-y-1">
                   <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Total a Pagar</p>
                   <p className="text-2xl md:text-3xl font-[900] italic tracking-tighter text-pear">{watchedValues.currency === 'USD' ? '$' : 'Bs.'}{calculations.totalToPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Monto por Cuota</p>
                   <p className="text-2xl md:text-3xl font-[900] italic tracking-tighter text-white">{watchedValues.currency === 'USD' ? '$' : 'Bs.'}{calculations.installmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Total Intereses</p>
                   <p className="text-2xl md:text-3xl font-[900] italic tracking-tighter text-white/60">{watchedValues.currency === 'USD' ? '$' : 'Bs.'}{calculations.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
             </div>

             <div className="space-y-3 pt-6 border-t border-white/5 mt-6">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/60">
                    <span>Frecuencia</span>
                   <span className="text-white">
                     {({
                        daily: 'Diario',
                        weekly: 'Semanal',
                        biweekly: 'Quincenal',
                        monthly: 'Mensual',
                        yearly: 'Anual'
                     } as Record<string, string>)[watchedValues.frequency || ''] || watchedValues.frequency}
                   </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/60">
                   <span>Número de Cuotas</span>
                   <span className="text-white">{calculations.numInstallments} {calculations.numInstallments === 1 ? 'pago' : 'pagos'}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/60">
                   <span>Primer Vencimiento</span>
                   <span className="text-white">{calculations.firstDueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/60">
                   <span>Último Vencimiento</span>
                   <span className="text-white">{calculations.lastDueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
             </div>
         </div>

         <div className="pt-4 flex flex-col gap-3">
            <Button
              type="submit"
              isLoading={loading}
              disabled={Object.keys(errors).length > 0}
              variant="secondary"
              size="lg"
              className="w-full !rounded-[32px]"
            >
              Confirmar y Crear Préstamo
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full !rounded-[32px]"
            >
              Cancelar
            </Button>
         </div>
      </form>

      <ClientModal 
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        mode="add"
        onSubmit={async (clientData) => {
           const newId = await addClient(clientData);
           setValue('clientId', newId);
           setValue('clientName', clientData.name);
           setSearchTerm(clientData.name);
           setIsClientModalOpen(false);
        }}
      />
    </Modal>
  );
};

export default LoanForm;
