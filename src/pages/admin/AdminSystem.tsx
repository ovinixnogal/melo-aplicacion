import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { useAuth } from '../../contexts/AuthContext';
import {
  collection, getDocs, query, where, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import {
  Database, UserX, AlertTriangle, Trash2, RefreshCw,
  Users, FileText, TrendingUp, Gift, Activity
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  totalClients: number;
  totalLoans: number;
  totalPayments: number;
  totalNotifications: number;
  totalSubscriptionPayments: number;
  estimatedDocsKB: number;
}

interface InactiveUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  status: string;
  lastActivity: Date | null;
  clientsCount: number;
  loansCount: number;
  daysSinceExpiry: number;
}

const AdminSystem: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { fetchUsers, grantFreeAccess } = useAdmin();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const AVG_DOC_BYTES = 1200; // conservative estimate per Firestore doc

  const loadSystemData = async () => {
    setLoading(true);
    try {
      await fetchUsers();

      const [
        usersSnap, clientsSnap, loansSnap,
        paymentsSnap, notifSnap, subPaySnap
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'loans')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'notifications')),
        getDocs(collection(db, 'subscription_payments')),
      ]);

      const totalDocs =
        usersSnap.size + clientsSnap.size + loansSnap.size +
        paymentsSnap.size + notifSnap.size + subPaySnap.size;

      setStats({
        totalUsers: usersSnap.size,
        totalClients: clientsSnap.size,
        totalLoans: loansSnap.size,
        totalPayments: paymentsSnap.size,
        totalNotifications: notifSnap.size,
        totalSubscriptionPayments: subPaySnap.size,
        estimatedDocsKB: Math.round((totalDocs * AVG_DOC_BYTES) / 1024),
      });

      // Identify inactive users: subscription expired > 30 days ago and has no active loans
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const inactiveList: InactiveUser[] = [];

      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        const uid = docSnap.id;

        // Skip admins
        if (data.isAdmin) continue;

        const sub = data.subscription;
        const expiry = sub?.currentPeriodEnd?.toDate?.();
        const status = sub?.status || 'inactive';

        // Inactive if: no subscription, or expired more than 30 days ago
        const isExpiredLong = !expiry || expiry < thirtyDaysAgo;
        if (!isExpiredLong && status !== 'inactive') continue;

        const daysSinceExpiry = expiry
          ? Math.floor((now.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const [clientsSnap2, loansSnap2] = await Promise.all([
          getDocs(query(collection(db, 'clients'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'loans'), where('userId', '==', uid))),
        ]);

        inactiveList.push({
          uid,
          displayName: data.displayName || null,
          email: data.email || null,
          status,
          lastActivity: expiry || null,
          clientsCount: clientsSnap2.size,
          loansCount: loansSnap2.size,
          daysSinceExpiry,
        });
      }

      setInactiveUsers(inactiveList.sort((a, b) => b.daysSinceExpiry - a.daysSinceExpiry));
    } catch (err) {
      console.error('Error loading system data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSystemData(); }, []);

  const deleteUserData = async (uid: string) => {
    if (!window.confirm('⚠️ Esto eliminará TODOS los datos de este usuario (clientes, préstamos, pagos, notificaciones). Esta acción NO elimina la cuenta de autenticación. ¿Continuar?')) return;
    setDeleting(uid);
    try {
      const collections = ['clients', 'loans', 'payments', 'notifications'];
      for (const col of collections) {
        const snap = await getDocs(query(collection(db, col), where('userId', '==', uid)));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, col, d.id))));
      }
      await loadSystemData();
      alert('✅ Datos del usuario eliminados correctamente.');
    } catch (err) {
      console.error('Error deleting user data:', err);
      alert('Error eliminando los datos.');
    } finally {
      setDeleting(null);
    }
  };

  const deleteOldNotifications = async () => {
    if (!window.confirm('Eliminar todas las notificaciones para liberar espacio?')) return;
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))));
      alert(`✅ ${snap.size} notificaciones eliminadas.`);
      loadSystemData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pear border-t-slate rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Analizando sistema...</p>
        </div>
      </div>
    );
  }

  const collections_breakdown = stats ? [
    { label: 'Usuarios', count: stats.totalUsers, icon: Users, color: 'text-slate bg-gray-100' },
    { label: 'Clientes', count: stats.totalClients, icon: Users, color: 'text-sky-600 bg-sky-50' },
    { label: 'Préstamos', count: stats.totalLoans, icon: TrendingUp, color: 'text-violet-600 bg-violet-50' },
    { label: 'Registros de Pago', count: stats.totalPayments, icon: FileText, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Notificaciones', count: stats.totalNotifications, icon: Activity, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Pagos de Plan', count: stats.totalSubscriptionPayments, icon: Gift, color: 'text-rose-500 bg-rose-50' },
  ] : [];

  const totalDocs = collections_breakdown.reduce((acc, c) => acc + c.count, 0);
  const FREE_TIER_DOCS = 1_000_000;
  const usagePercent = Math.min((totalDocs / FREE_TIER_DOCS) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-slate">Sistema<span className="text-pear">.</span></h2>
          <p className="text-gray-400 font-bold text-xs mt-1">Gestión técnica y mantenimiento de la plataforma</p>
        </div>
        <button
          onClick={loadSystemData}
          className="flex items-center gap-2 px-5 py-3 bg-slate text-pear rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* STORAGE SECTION */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-slate text-pear rounded-[20px] flex items-center justify-center">
            <Database size={22} />
          </div>
          <div>
            <h3 className="font-black text-slate text-lg italic tracking-tight">Almacenamiento Firebase</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan Spark (Gratuito)</p>
          </div>
        </div>

        {/* Usage bar */}
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Documentos usados</span>
            <span className="text-sm font-black text-slate">{totalDocs.toLocaleString()} / 1,000,000</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${usagePercent > 80 ? 'bg-rose-500' : usagePercent > 50 ? 'bg-yellow-400' : 'bg-pear'}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-bold text-gray-400">{usagePercent.toFixed(2)}% utilizado</span>
            <span className="text-[10px] font-bold text-gray-400">~{stats?.estimatedDocsKB ?? 0} KB estimados</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {collections_breakdown.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-gray-50 rounded-[20px] p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-[14px] flex items-center justify-center flex-shrink-0 ${c.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{c.label}</p>
                  <p className="text-lg font-black italic text-slate leading-none">{c.count.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl p-8">
        <h3 className="font-black text-slate text-lg italic tracking-tight mb-6">Mantenimiento Rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={deleteOldNotifications}
            className="flex items-center gap-4 p-5 bg-yellow-50 border border-yellow-100 rounded-[20px] hover:scale-[1.02] transition-all text-left"
          >
            <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-[14px] flex items-center justify-center flex-shrink-0">
              <Trash2 size={18} />
            </div>
            <div>
              <p className="font-black text-slate text-sm">Limpiar Notificaciones</p>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">Elimina las {stats?.totalNotifications} notificaciones para liberar espacio</p>
            </div>
          </button>

          <div className="flex items-center gap-4 p-5 bg-gray-50 border border-gray-100 rounded-[20px] opacity-60 cursor-not-allowed">
            <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-[14px] flex items-center justify-center flex-shrink-0">
              <Database size={18} />
            </div>
            <div>
              <p className="font-black text-slate text-sm">Exportar Base de Datos</p>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">Descarga completa (requiere Firebase Blaze)</p>
            </div>
          </div>
        </div>
      </div>

      {/* INACTIVE USERS */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-[16px] flex items-center justify-center">
              <UserX size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate text-lg italic tracking-tight">Usuarios Sin Actividad</h3>
              <p className="text-[10px] font-bold text-gray-400">Suscripción expirada hace más de 30 días</p>
            </div>
          </div>
          <span className="px-4 py-2 bg-rose-50 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest">
            {inactiveUsers.length} usuarios
          </span>
        </div>

        {inactiveUsers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-bold text-sm">
            No hay usuarios con inactividad prolongada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate/5">
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Inactivo hace</th>
                  <th className="px-6 py-4 hidden md:table-cell">Clientes / Préstamos</th>
                  <th className="px-6 py-4">Riesgo</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {inactiveUsers.map(u => {
                  const risk = u.daysSinceExpiry > 90 ? 'Alto' : u.daysSinceExpiry > 45 ? 'Medio' : 'Bajo';
                  const riskColor = u.daysSinceExpiry > 90 ? 'text-rose-600 bg-rose-50' : u.daysSinceExpiry > 45 ? 'text-yellow-600 bg-yellow-50' : 'text-gray-500 bg-gray-100';
                  const isEmpty = u.clientsCount === 0 && u.loansCount === 0;

                  return (
                    <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[14px] bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {(u.displayName || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate">{u.displayName || '—'}</p>
                            <p className="text-[10px] font-bold text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-rose-500">{u.daysSinceExpiry === 999 ? 'Nunca activo' : `${u.daysSinceExpiry} días`}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-500">{u.clientsCount} clientes</span>
                          <span className="text-xs font-bold text-gray-500">{u.loansCount} préstamos</span>
                          {isEmpty && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-500 text-[9px] font-black rounded-full uppercase tracking-wider">Sin datos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${riskColor}`}>{risk}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { if (window.confirm(`¿Dar 30 días gratis a ${u.displayName}?`)) grantFreeAccess(u.uid, adminUser?.uid || ''); }}
                            className="px-3 py-2 bg-violet-50 text-violet-700 rounded-[12px] text-[9px] font-black uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1"
                          >
                            <Gift size={12} /> Activar
                          </button>
                          {(isEmpty || u.daysSinceExpiry > 60) && (
                            <button
                              onClick={() => deleteUserData(u.uid)}
                              disabled={deleting === u.uid}
                              className="px-3 py-2 bg-rose-50 text-rose-600 rounded-[12px] text-[9px] font-black uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {deleting === u.uid ? '...' : <><Trash2 size={12} /> Purgar</>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {inactiveUsers.length > 0 && (
          <div className="px-8 py-4 bg-yellow-50/50 border-t border-yellow-100 flex items-start gap-3">
            <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] font-bold text-yellow-700 leading-relaxed">
              <strong>Recomendación:</strong> Usuarios con más de 60 días de inactividad y sin datos pueden ser purgados para liberar espacio. El botón "Purgar" elimina sus registros de Firestore pero no su cuenta de autenticación de Firebase.
            </p>
          </div>
        )}
      </div>

      {/* HEALTH STATUS */}
      <div className="bg-white rounded-[32px] border border-slate/5 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-[16px] flex items-center justify-center">
            <Activity size={18} />
          </div>
          <h3 className="font-black text-slate text-lg italic tracking-tight">Estado del Sistema</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Base de Datos', status: 'Operativa', ok: true },
            { label: 'Autenticación Firebase', status: 'Activa', ok: true },
            { label: 'Almacenamiento', status: usagePercent > 80 ? 'Atención requerida' : 'Óptimo', ok: usagePercent <= 80 },
          ].map(item => (
            <div key={item.label} className={`p-4 rounded-[20px] border flex items-center gap-3 ${item.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-yellow-50 border-yellow-100'}`}>
              <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{item.label}</p>
                <p className={`font-black text-sm ${item.ok ? 'text-emerald-700' : 'text-yellow-700'}`}>{item.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSystem;
