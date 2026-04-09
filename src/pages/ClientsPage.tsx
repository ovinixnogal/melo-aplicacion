import React, { useState, useEffect } from 'react';
import { 
  UserSearch, 
  Search, 
  Loader2, 
  PlusCircle, 
  Filter,
  RefreshCcw,
  MoreVertical,
  MessageCircle
} from 'lucide-react';
import { useClients } from '../hooks/useClients';
import type { Client } from '../hooks/useClients';
import ClientModal from '../components/clients/ClientModal';
import ClientActionSheet from '../components/clients/ClientActionSheet';
import ClientDetailsModal from '../components/clients/ClientDetailsModal';
import { useLoans } from '../hooks/useLoans';
import { useAuth } from '../contexts/AuthContext';

const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    clients, 
    loading, 
    isFetchingNextPage, 
    error, 
    hasMore, 
    addClient, 
    updateClient, 
    deleteClient, 
    fetchNextPage,
    refresh
  } = useClients();

  const { fetchAllUserLoans } = useLoans(user?.uid);
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user?.uid) {
      fetchAllUserLoans().then(loans => {
        const balanceMap: Record<string, number> = {};
        loans.forEach(loan => {
          if (loan.status === 'cancelled') return;
          const paid = (loan.totalToPay / loan.numberOfInstallments) * loan.paidInstallmentsCount;
          const pending = loan.totalToPay - paid;
          balanceMap[loan.clientId] = (balanceMap[loan.clientId] || 0) + pending;
        });
        setBalances(balanceMap);
      });
    }
  }, [user?.uid, fetchAllUserLoans, clients]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'recent'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filtrado local optimizado
  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm);
    
    if (!matchesSearch) return false;

    const balance = balances[client.id] || 0;
    
    if (activeFilter === 'active') return balance > 0;
    if (activeFilter === 'inactive') return balance === 0;
    if (activeFilter === 'recent') {
      if (!client.createdAt) return true;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const created = client.createdAt.toDate ? client.createdAt.toDate() : new Date(client.createdAt);
      return created > thirtyDaysAgo;
    }

    return true;
  });


  const getBalance = (client: Client) => {
    return balances[client.id] || 0;
  };

  const handleOpenActionSheet = (client: Client) => {
    setSelectedClient(client);
    setIsActionSheetOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setModalMode('edit');
    setIsActionSheetOpen(false);
    setIsDetailsOpen(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${client.name}?`)) {
      await deleteClient(client.id);
      setIsActionSheetOpen(false);
      setIsDetailsOpen(false);
    }
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-pulse">
        <div className="w-16 h-16 bg-[#1A1A1A] rounded-[24px] flex items-center justify-center mb-6">
           <Loader2 className="w-8 h-8 text-[#E2FF3B] animate-spin" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-300">Sincronizando Cartera</h4>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-black text-slate tracking-tighter italic leading-none">
            {searchTerm ? 'Resultados' : 'Mis Clientes'}
            <span className="text-pear italic">.</span>
          </h1>
          <p className="text-gray-400 font-bold text-xs tracking-tight">Tienes <span className="text-slate">{clients.length}</span> clientes registrados</p>
        </div>

        <div className="flex gap-3">
            <button 
              onClick={refresh}
              className="p-4 bg-white border border-gray-100 text-gray-400 hover:text-[#1A1A1A] rounded-2xl transition-all active:rotate-180 duration-500"
              title="Refrescar"
            >
               <RefreshCcw size={18} />
            </button>
            <button 
              onClick={() => { setModalMode('add'); setSelectedClient(null); setIsModalOpen(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-4 px-8 py-5 bg-slate text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-gray-800 transition-all hover:-translate-y-1 active:scale-95 group"
            >
               Nuevo Cliente <PlusCircle size={18} className="text-pear group-hover:scale-110 transition-transform" />
            </button>
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#1A1A1A] transition-colors" size={22} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate/5 focus:border-pear rounded-[30px] text-sm font-bold text-slate focus:outline-none focus:shadow-xl transition-all placeholder:text-gray-300"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as any)}
            className="flex items-center justify-center gap-3 px-4 py-3 md:px-6 md:py-4 bg-white border-2 border-slate/5 rounded-[20px] md:rounded-[30px] font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate hover:bg-gray-50 transition-all focus:outline-none focus:border-pear cursor-pointer appearance-none min-w-[140px] text-center"
          >
            <option value="all">Todos</option>
            <option value="active">Con Préstamos</option>
            <option value="inactive">Sin Préstamos</option>
            <option value="recent">Recientes</option>
          </select>
          <button className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-white border-2 border-slate/5 rounded-[20px] md:rounded-[30px] font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate hover:bg-gray-50 transition-all active:scale-95">
             <Filter size={14} className="text-pear" /> <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>
      </div>

      {/* 3. Error Feedback */}
      {error && (
         <div className="p-6 bg-rose-50 border border-rose-100 rounded-[28px] text-rose-600 text-[11px] font-black uppercase tracking-widest text-center animate-bounce-subtle flex items-center justify-center gap-3">
           ⚠️ {error.includes('index') ? 'Se requiere crear el índice de Firestore' : error}
         </div>
      )}

      {/* 4. Main List Content */}
      {filteredClients.length > 0 ? (
        <div className="space-y-12">
          
          <div className="bg-white rounded-[40px] border border-slate/5 shadow-3xl shadow-slate/5 overflow-hidden">
            
            {/* MOBILE LIST VIEW: Improved for density */}
            <div className="md:hidden divide-y divide-gray-50 px-2">
               {filteredClients.map((client) => {
                 const balance = getBalance(client);
                 return (
                   <div 
                     key={client.id} 
                     onClick={() => handleOpenActionSheet(client)}
                     className="flex items-center justify-between py-6 px-4 active:bg-gray-50 transition-colors cursor-pointer group"
                   >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate text-pear rounded-2xl flex items-center justify-center font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-[14px] text-slate tracking-tight uppercase italic leading-tight truncate max-w-[150px]">{client.name}</span>
                          <span className="text-[10px] font-black text-gray-300 tracking-widest uppercase truncate">{client.phone || 'Sin WhatsApp'}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className={`text-base font-[900] italic tracking-tighter ${balance > 0 ? 'text-rose-500' : 'text-gray-200'}`}>
                          ${balance.toLocaleString()}
                        </p>
                        <span className="text-[8px] font-black uppercase text-gray-300 tracking-widest">Saldo Deudor</span>
                     </div>
                   </div>
                 );
               })}
            </div>

            {/* DESKTOP TABLE VIEW: Premium List Layout */}
            <div className="hidden md:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-vanilla/50 border-b border-slate/5">
                        <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.3em] text-gray-300">Cliente</th>
                        <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.3em] text-gray-300 text-center">Estado</th>
                        <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.3em] text-gray-300 text-nowrap">Capital Deudor</th>
                        <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.3em] text-gray-300 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {filteredClients.map((client) => {
                       const balance = getBalance(client);
                       return (
                         <tr key={client.id} className="hover:bg-vanilla/30 transition-all group">
                            <td className="px-6 py-6">
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-slate text-pear rounded-2xl flex items-center justify-center font-black text-base shadow-xl group-hover:rotate-6 transition-transform">
                                     {client.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                     <span className="font-black text-[14px] uppercase italic tracking-tighter text-slate group-hover:text-pear transition-colors truncate max-w-[140px]">{client.name}</span>
                                     <span className="text-[9px] font-bold text-gray-300 uppercase mt-0.5 truncate max-w-[140px]">{client.email || 'No registrado@mail.com'}</span>
                                  </div>
                               </div>
                            </td>

                            <td className="px-6 py-6 text-center">
                               <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 
                                  ${balance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {balance > 0 ? 'Deudor' : 'Limpio'}
                               </span>
                            </td>
                            <td className="px-6 py-6">
                               <p className={`text-xl font-[1000] italic tracking-tighter leading-none ${balance > 0 ? 'text-rose-600' : 'text-slate/10'}`}>
                                  ${balance.toLocaleString()}
                               </p>
                            </td>
                            <td className="px-6 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  <a 
                                    href={`https://wa.me/${client.phone?.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3.5 bg-emerald-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                    title="WhatsApp"
                                  >
                                     <MessageCircle size={18} strokeWidth={3} />
                                  </a>
                                  <button 
                                     onClick={() => handleOpenActionSheet(client)}
                                     className="p-3.5 bg-vanilla text-slate border border-slate/5 rounded-xl hover:bg-slate hover:text-white transition-all active:scale-90"
                                  >
                                     <MoreVertical size={18} strokeWidth={3} />
                                  </button>
                               </div>
                            </td>
                         </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
          </div>

          {/* 5. Pagination & Load More */}
          {hasMore && (
            <div className="flex justify-center pt-8">
              <button 
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
                className="group relative px-12 py-5 bg-slate text-white rounded-[30px] font-black text-[11px] uppercase tracking-[0.4em] shadow-3xl hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center gap-3"
              >
                 {isFetchingNextPage ? <Loader2 className="animate-spin" size={18} /> : (
                   <>
                      Cargar más clientes 
                      <RefreshCcw size={16} className="text-pear group-hover:rotate-180 transition-transform duration-700" />
                   </>
                 )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="py-24 text-center bg-white rounded-[56px] border border-[#1A1A1A]/5 shadow-inner">
           <div className="w-24 h-24 bg-gray-50 rounded-[34px] flex items-center justify-center mx-auto mb-8 border border-gray-100">
              <UserSearch className="text-gray-200" size={56} />
           </div>
           <h3 className="text-2xl font-black text-[#1A1A1A] tracking-tighter italic">Tu lista está vacía</h3>
           <p className="text-gray-400 text-sm mt-4 max-w-xs mx-auto font-medium">Registra tu primer cliente hoy mismo para empezar a gestionar préstamos y cobros.</p>
           <button 
              onClick={() => { setModalMode('add'); setSelectedClient(null); setIsModalOpen(true); }}
              className="mt-10 px-10 py-5 bg-[#E2FF3B] text-[#1A1A1A] rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
           >
              Añadir Cliente
           </button>
        </div>
      )}

      {/* 7. Modals Integration */}
      <ClientActionSheet 
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        client={selectedClient}
        onView={() => setIsDetailsOpen(true)}
        onEdit={() => selectedClient && handleEdit(selectedClient)}
        onDelete={() => selectedClient && handleDelete(selectedClient)}
      />

      <ClientDetailsModal 
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        client={selectedClient}
        onEdit={() => selectedClient && handleEdit(selectedClient)}
      />

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialData={selectedClient}
        onSubmit={async (data) => {
          if (modalMode === 'add') {
            await addClient(data);
          } else if (selectedClient) {
            await updateClient(selectedClient.id, data);
          }
        }}
      />

    </div>
  );
};

export default ClientsPage;
