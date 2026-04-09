import React, { useEffect } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { Users, ShieldCheck, DollarSign, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => (
  <div className={`bg-white rounded-[32px] border border-slate/5 shadow-xl p-8 flex items-center gap-6`}>
    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      <p className="text-3xl font-[900] italic tracking-tighter text-slate leading-none mt-1">{value}</p>
      {subtitle && <p className="text-xs font-bold text-gray-400 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const AdminStats: React.FC = () => {
  const { users, payments, loadingUsers, loadingPayments, fetchUsers, fetchPayments } = useAdmin();

  useEffect(() => {
    fetchUsers();
    fetchPayments();
  }, []);

  if (loadingUsers || loadingPayments) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-12 h-12 border-4 border-pear border-t-slate rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.subscription?.status === 'active').length;
  const trialUsers = users.filter(u => u.subscription?.status === 'trial').length;
  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);

  const now = new Date();
  const monthRevenue = payments.filter(p => {
    if (p.status !== 'paid') return false;
    const d = p.date?.toDate?.();
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((acc, p) => acc + p.amount, 0);

  // Build last 6 months data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth();
    const y = d.getFullYear();
    const total = payments
      .filter(p => {
        if (p.status !== 'paid') return false;
        const pd = p.date?.toDate?.();
        return pd && pd.getMonth() === m && pd.getFullYear() === y;
      })
      .reduce((acc, p) => acc + p.amount, 0);
    return {
      label: d.toLocaleDateString('es-VE', { month: 'short' }),
      total,
    };
  });

  const maxRevenue = Math.max(...monthlyData.map(m => m.total), 1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black italic tracking-tighter text-slate">Estadísticas<span className="text-pear">.</span></h2>
        <p className="text-gray-400 font-bold text-xs mt-1">Vista general de la plataforma</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Usuarios Totales"
          value={totalUsers}
          subtitle="Desde el inicio"
          icon={<Users size={24} className="text-slate" />}
          color="bg-gray-100"
        />
        <StatCard
          title="Suscripciones Activas"
          value={activeUsers}
          subtitle={`${trialUsers} en periodo de prueba`}
          icon={<ShieldCheck size={24} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          title="Ingresos Totales"
          value={`$${totalRevenue.toFixed(2)}`}
          subtitle="Pagos confirmados"
          icon={<DollarSign size={24} className="text-pear" />}
          color="bg-slate"
        />
        <StatCard
          title="Ingresos del Mes"
          value={`$${monthRevenue.toFixed(2)}`}
          subtitle={now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
          icon={<TrendingUp size={24} className="text-sky-600" />}
          color="bg-sky-50"
        />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl p-8">
        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-8">Ingresos Últimos 6 Meses</h3>
        <div className="flex items-end gap-4 h-48">
          {monthlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-3">
              <span className="text-xs font-black text-slate">${m.total.toFixed(0)}</span>
              <div className="w-full relative" style={{ height: `${(m.total / maxRevenue) * 140 + 4}px` }}>
                <div
                  className={`w-full rounded-t-[10px] transition-all duration-700 ${
                    i === monthlyData.length - 1 ? 'bg-pear' : 'bg-slate/20'
                  }`}
                  style={{ height: '100%' }}
                />
              </div>
              <span className="text-[10px] font-black uppercase text-gray-400 capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick user breakdown */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate/5">
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Distribución de Usuarios</h3>
        </div>
        <div className="divide-y divide-slate/5">
          {[
            { label: 'Activos', count: activeUsers, color: 'bg-emerald-500' },
            { label: 'En Prueba', count: trialUsers, color: 'bg-sky-500' },
            { label: 'Inactivos', count: totalUsers - activeUsers - trialUsers, color: 'bg-gray-300' },
          ].map(row => (
            <div key={row.label} className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${row.color}`}></div>
                <span className="font-black text-sm text-slate">{row.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${row.color} rounded-full`}
                    style={{ width: `${totalUsers ? (row.count / totalUsers) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-black text-gray-500 w-8 text-right">{row.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
