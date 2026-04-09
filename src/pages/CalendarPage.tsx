import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Search
} from 'lucide-react';
import { useLoans } from '../hooks/useLoans';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import * as DateFns from "date-fns";
import { es } from "date-fns/locale/es";

const { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  parseISO 
} = DateFns;

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const { loans, installments } = useLoans(user?.uid);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Agrupar cuotas por fecha para facilitar la búsqueda en el calendario
  const installmentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    installments.forEach((inst: any) => {
      // Manejar tanto Timestamp de Firebase como string ISO
      const date = (inst.dueDate as any).toDate ? (inst.dueDate as any).toDate() : parseISO(inst.dueDate as string);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      const loan = loans.find(l => l.id === inst.loanId);
      if (loan) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push({ ...inst, clientName: loan.clientName, currency: loan.currency });
      }
    });
    return map;
  }, [installments, loans]);

  const renderHeader = () => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate text-pear rounded-2xl shadow-xl transform -rotate-3"><CalendarIcon size={24} /></div>
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate leading-none">Calendario</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mt-1">Próximos cobros programados</p>
        </div>
      </div>

      <div className="flex items-center bg-white p-2 rounded-3xl border border-slate/5 shadow-sm">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-slate"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="px-6 font-black uppercase italic tracking-tighter text-slate min-w-[160px] text-center">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-slate"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderDays = () => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map(dayName => (
          <div key={dayName} className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 py-2">
            {dayName}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const dateKey = format(day, "yyyy-MM-dd");
        const dayInstallments = installmentsByDate[dateKey] || [];

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[100px] md:min-h-[140px] p-2 border border-gray-50 bg-white transition-all relative group
              ${!isSameMonth(day, monthStart) ? "bg-gray-50/30 opacity-30" : ""}
              ${isSameDay(day, new Date()) ? "ring-2 ring-pear ring-inset" : ""}
            `}
          >
            <span className={`text-xs font-black italic mb-2 block ${isSameDay(day, new Date()) ? 'text-slate' : 'text-gray-300'}`}>
              {formattedDate}
            </span>
            
            <div className="space-y-1">
              {dayInstallments.slice(0, 3).map((inst, idx) => (
                <Link
                  key={`${inst.id}-${idx}`}
                  to={`/prestamos/${inst.loanId}`}
                  className={`block px-2 py-1.5 rounded-lg text-[8px] font-black uppercase truncate tracking-tighter transition-all hover:scale-105 shadow-sm
                    ${inst.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate text-pear'}
                  `}
                >
                  {inst.clientName.split(' ')[0]}
                </Link>
              ))}
              {dayInstallments.length > 3 && (
                <div className="text-[7px] font-black text-gray-300 text-center uppercase tracking-widest mt-1">
                  +{dayInstallments.length - 3} más
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="rounded-[40px] overflow-hidden border border-gray-100 shadow-2xl">{rows}</div>;
  };

  return (
    <div className="animate-in fade-in duration-700">
      {renderHeader()}
      
      <div className="bg-white rounded-[40px] p-6 sm:p-8 border-2 border-slate/5 shadow-inner">
        {renderDays()}
        {renderCells()}
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate p-8 rounded-[40px] text-white flex items-center justify-between group">
           <div>
              <h3 className="text-lg font-black italic uppercase tracking-tighter mb-1">Resumen Mensual</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Total de cobros para este mes</p>
           </div>
           <p className="text-4xl font-black italic text-pear tracking-tighter">
              {Object.values(installmentsByDate).flat().filter((inst: any) => {
                const date = (inst.dueDate as any).toDate ? (inst.dueDate as any).toDate() : parseISO(inst.dueDate as string);
                return isSameMonth(date, currentMonth);
              }).length}
           </p>
        </div>

        <div className="bg-vanilla p-8 rounded-[40px] border-2 border-slate/5 flex items-center gap-6">
           <div className="p-4 bg-white rounded-2xl shadow-inner"><Search size={24} className="text-slate" /></div>
           <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate/30 mb-1">Tip de Gestión</p>
              <p className="font-black text-slate text-xs tracking-tighter italic uppercase">Haz clic en cualquier nombre para ir directo al cobro.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
