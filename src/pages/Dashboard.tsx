import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  TrendingUp, 
  CreditCard, 
  ArrowUpRight,
  HandCoins,
  ArrowRight,
  Briefcase,
  DollarSign,
  Wallet,
  Users,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useStats } from '../hooks/useStats';
import { useCapital } from '../hooks/useCapital';
import { useExchangeRate } from '../hooks/useExchangeRate';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { stats, loading, error } = useStats(user?.uid);
  const { balances, loading: capLoading } = useCapital(user?.uid);
  const { exchangeRate } = useExchangeRate();
  const navigate = useNavigate();

  const isCapitalZero = !capLoading && balances.USD === 0 && balances.VES === 0;

  if (loading || capLoading) {
    return (
      <div className="p-4 sm:p-8 lg:p-10 space-y-8 animate-in fade-in duration-500 pb-20">
         <div className="flex justify-between items-end">
            <Skeleton className="h-10 w-48 sm:w-64" />
            <Skeleton className="h-10 w-32 hidden sm:block" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Skeleton className="h-32 rounded-3xl" count={4} />
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80 rounded-[40px]" />
            <Skeleton className="h-80 rounded-[40px]" />
         </div>
      </div>
    );
  }

  const mainStats = [
    { name: 'Total Prestado ($)', value: stats.totalLentUSD, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', symbol: '$' },
    { name: 'Total Recuperado ($)', value: stats.totalReceivedUSD - stats.totalEarnedUSD, icon: HandCoins, color: 'text-emerald-600', bg: 'bg-emerald-50', symbol: '$' },
    { name: 'Ganancias ($)', value: stats.totalEarnedUSD, icon: TrendingUp, color: 'text-pear', bg: 'bg-slate', symbol: '$' },
    { name: 'Préstamos Activos', value: stats.activeLoansCount, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50', symbol: '' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-700 pb-24 sm:pb-10 max-w-[1600px] mx-auto">
      
      {/* Mini Welcome & Capital Bar */}
      <div className="flex flex-col md:flex-row flex-wrap gap-6 md:items-end justify-between">
        <div className="space-y-1 min-w-[200px]">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate tracking-tight italic uppercase leading-[0.9]">
                Resumen <span className="text-pear">General</span>
            </h1>
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest leading-none">Visión general de tu portafolio</p>
        </div>

        {/* Dynamic Capital Summary */}
        <div className="flex items-center gap-3 shrink-0 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0">
            <div 
              onClick={() => navigate('/capital')}
              className="flex-shrink-0 min-w-[130px] p-3.5 sm:p-4 bg-slate text-white rounded-[24px] border border-slate shadow-xl hover:scale-105 transition-all cursor-pointer group"
            >
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-pear text-slate rounded-xl"><DollarSign size={14} strokeWidth={3} /></div>
                  <div>
                    <p className="text-[7px] font-black uppercase text-white/40 tracking-widest leading-none mb-1">Disponible $</p>
                    <p className="text-base sm:text-lg font-black tracking-tighter leading-none">${balances.USD.toLocaleString()}</p>
                  </div>
               </div>
            </div>
            <div 
              onClick={() => navigate('/capital')}
              className="flex-shrink-0 min-w-[150px] p-3.5 sm:p-4 bg-pear text-slate rounded-[24px] border border-slate/5 shadow-xl hover:scale-105 transition-all cursor-pointer group"
            >
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate text-pear rounded-xl"><Wallet size={14} strokeWidth={3} /></div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[7px] font-black uppercase text-slate/40 tracking-widest leading-none">Disponible Bs.</p>
                        {exchangeRate && <span className="text-[7px] font-black bg-slate/10 px-1 rounded">≈ ${((balances.VES || 0) / (exchangeRate.rate || 1)).toFixed(1)}</span>}
                    </div>
                    <p className="text-base sm:text-lg font-black tracking-tighter leading-none">Bs. {balances.VES.toLocaleString()}</p>
                  </div>
               </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {mainStats.map((stat) => (
          <div key={stat.name} className="bg-white p-3.5 sm:p-6 rounded-[24px] sm:rounded-[28px] border-2 border-slate/5 hover:border-slate transition-all group overflow-hidden relative flex flex-col justify-between min-h-[120px] sm:min-h-[160px]">
             <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl ${stat.bg} ${stat.color} w-fit mb-2 sm:mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                <stat.icon size={16} className="sm:w-5 sm:h-5" />
             </div>
             <div className="relative z-10">
                <p className="text-[7px] sm:text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] sm:tracking-widest mb-0.5 sm:mb-1 truncate">{stat.name}</p>
                <div className="flex items-baseline gap-0.5 sm:gap-1 overflow-hidden">
                   <span className="text-[10px] sm:text-sm font-black text-slate/40 shrink-0">{stat.symbol}</span>
                   <p className="text-base sm:text-2xl xl:text-3xl font-black text-slate tracking-tighter leading-none italic truncate w-full" title={stat.value.toLocaleString()}>
                      {stat.value.toLocaleString()}
                   </p>
                </div>
             </div>
             <ArrowUpRight size={24} className="absolute -bottom-1 -right-1 text-slate/5 group-hover:text-slate/10 transition-colors sm:w-8 sm:h-8" />
          </div>
        ))}
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Simplified Chart (More vertical space efficient) */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[40px] border-2 border-slate/5 shadow-sm hover:shadow-md transition-all h-[380px] sm:h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-vanilla rounded-xl"><TrendingUp size={18} className="text-slate/40" /></div>
                   <h3 className="text-lg font-black text-slate italic uppercase tracking-tighter">Actividad Comercial</h3>
                </div>
                <div className="text-[8px] font-black uppercase text-slate/30 tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">Últimos 7 días activos</div>
            </div>

            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" opacity={0.5} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 900, fill: '#1A1A1A', opacity: 0.3 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 900, fill: '#1A1A1A', opacity: 0.3 }}
                        />
                        <Tooltip 
                           cursor={{ fill: '#F9FAFB', radius: 8 }}
                           contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                        />
                        <Bar dataKey="amount" radius={[8, 8, 8, 8]} barSize={28}>
                           {stats.chartData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === stats.chartData.length - 1 ? '#E2FF3B' : '#1A1A1A'} />
                           ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Debtors & Status Column */}
        <div className="space-y-6">
            <div 
              onClick={() => navigate('/clientes')}
              className="bg-slate p-8 rounded-[40px] text-white shadow-xl hover:shadow-pear/10 hover:scale-[1.02] transition-all cursor-pointer group min-h-[200px] flex flex-col justify-between"
            >
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <Users size={20} className="text-pear" />
                        <ArrowRight size={16} className="text-white/20 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h3 className="text-lg font-black tracking-tight italic uppercase leading-none mb-1">Deudores Activos</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Clientes con saldo pendiente</p>
                </div>
                
                <div className="flex items-end justify-between">
                    <p className="text-6xl font-[900] tracking-tighter text-pear italic leading-none">
                       {stats.clientsInDebt.toString().padStart(2, '0')}
                    </p>
                    <div className="flex -space-x-2">
                       {[...Array(Math.min(stats.clientsInDebt, 3))].map((_, i) => (
                         <div key={i} className="w-8 h-8 rounded-lg bg-gray-800 border-2 border-slate flex items-center justify-center text-[8px] font-black text-white/20">U{i}</div>
                       ))}
                       {stats.clientsInDebt > 3 && <div className="w-8 h-8 rounded-lg bg-pear border-2 border-slate flex items-center justify-center text-[8px] font-black text-slate">+{stats.clientsInDebt - 3}</div>}
                    </div>
                </div>
            </div>

            <div 
              onClick={() => navigate('/calendario')}
              className="bg-vanilla p-8 rounded-[40px] border-2 border-slate/5 group hover:bg-white hover:border-pear transition-all flex items-center gap-6 cursor-pointer"
            >
                <div className="p-4 bg-white rounded-2xl shadow-inner group-hover:scale-110 transition-transform">
                   <Calendar size={24} className="text-slate" />
                </div>
                <div>
                   <h4 className="text-[9px] font-black uppercase tracking-widest text-slate/30 mb-1">Próximos Cobros</h4>
                   <p className="font-black text-slate text-sm tracking-tighter italic uppercase">Revisa tu cronograma de cuotas esta semana.</p>
                </div>
            </div>
        </div>
      </div>

      {/* Setup Guide (Smaller, better suited for dashboard) */}
      {isCapitalZero && (
        <div className="bg-pear border-2 border-slate rounded-[32px] p-6 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-5 duration-500">
           <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="p-4 bg-slate text-pear rounded-2xl shrink-0">
                 <Briefcase size={28} />
              </div>
              <div className="flex-1 text-center sm:text-left">
                 <h2 className="text-xl font-black text-slate italic uppercase tracking-tighter mb-1">
                    Inicializa tu Sistema
                 </h2>
                 <p className="text-slate/60 font-bold text-[10px] uppercase tracking-widest">
                    Inyecta capital para poder entregar préstamos.
                 </p>
              </div>
              <Button 
                onClick={() => navigate('/capital')}
                size="sm"
                variant="primary"
                className="w-full sm:w-auto !rounded-2xl"
              >
                 Configurar Capital
              </Button>
           </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center">
            ⚠️ Error: {error}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
