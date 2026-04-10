import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  UserSearch,
  History,
  AlertTriangle,
  Briefcase,
  Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../api/firebase';
import { signOut } from 'firebase/auth';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { DollarSign } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

import NotificationsPopover from '../components/ui/NotificationsPopover';
import OnboardingModal from '../components/ui/OnboardingModal';

const menuItems = [
  { name: 'Inicio', path: '/dashboard', icon: Home },
  { name: 'Capital', path: '/capital', icon: Briefcase },
  { name: 'Clientes', path: '/clientes', icon: UserSearch },
  { name: 'Préstamos', path: '/prestamos', icon: Wallet },
  { name: 'Calendario', path: '/calendario', icon: Calendar },
  { name: 'Historial', path: '/historial', icon: History },
  { name: 'Mi Cuenta', path: '/perfil', icon: UserSearch },
  { name: 'Ajustes', path: '/ajustes', icon: Settings },
];

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

interface SidebarContentProps {
  user: any;
  location: any;
  setMobileMenuOpen: (open: boolean) => void;
  handleLogout: () => Promise<void>;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  user,
  location,
  setMobileMenuOpen,
  handleLogout
}) => (
  <div className="flex flex-col h-full bg-slate text-white selection:bg-pear selection:text-slate overflow-hidden">
    <div className="px-8 py-8 md:py-10 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-pear text-slate rounded-[18px] flex items-center justify-center font-black text-2xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform cursor-pointer shadow-pear/20">
           M
        </div>
        <span className="text-xl font-black tracking-tighter uppercase italic text-white">MELO</span>
      </div>
      <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-2.5 bg-white/5 text-white/40 hover:text-white rounded-xl transition-colors">
        <X size={24} />
      </button>
    </div>

    <nav className="flex-1 px-5 py-2 space-y-2 overflow-y-auto custom-scrollbar">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) => `
            flex items-center gap-5 px-6 py-4 rounded-[22px] transition-all duration-500 group
            ${isActive
              ? 'bg-pear text-slate font-black shadow-2xl shadow-pear/10 translate-x-2'
              : 'text-white/40 hover:text-white hover:bg-white/5'}
          `}
        >
          <item.icon size={22} className={`transition-transform duration-500 ${location.pathname === item.path ? 'scale-110' : 'group-hover:scale-110'}`} />
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">{item.name}</span>
        </NavLink>
      ))}
    </nav>

    <div className="p-6 md:p-8 border-t border-white/5 space-y-6 md:space-y-8 shrink-0">
      <div className="bg-white/5 p-4 rounded-[28px] border border-white/5 shadow-inner">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-pear font-black text-sm shadow-xl border border-white/5">
               {getInitials(user?.displayName)}
            </div>
            <div className="min-w-0">
               <p className="text-[11px] font-black text-white truncate uppercase tracking-wider">{user?.displayName?.split(' ')[0] || 'Usuario'}</p>
               <p className="text-[9px] text-white/30 font-black tracking-[0.2em] uppercase mt-1 italic">Cuenta Verificada</p>
            </div>
         </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-4 px-6 py-3.5 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-500 rounded-[24px] group"
      >
        <LogOut size={20} className="group-hover:translate-x-1 group-hover:rotate-6 transition-all" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-left">Desconectar</span>
      </button>
    </div>
  </div>
);

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { exchangeRate } = useExchangeRate();
  const { daysRemaining, isActive } = useSubscription();

  useEffect(() => {
    // Show tutorial to new users after a small delay
    if (user && !user.hasSeenTutorial && !user.isAdmin) {
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getSectionName = () => {
    const current = menuItems.find(i => i.path === location.pathname);
    return current ? current.name : 'MELO';
  };

  return (
    <div className="min-h-screen bg-vanilla font-sans selection:bg-pear selection:text-slate overflow-x-hidden">
      
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col fixed left-4 top-4 bottom-4 w-72 z-50 rounded-[48px] overflow-hidden shadow-2xl shadow-slate/20 border border-slate/5">
        <SidebarContent
          user={user}
          location={location}
          setMobileMenuOpen={setMobileMenuOpen}
          handleLogout={handleLogout}
        />
      </aside>

      {/* 2. DRAWER SIDEBAR MOBILE */}
      <div className={`md:hidden fixed inset-0 z-[100] transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate/80 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)}></div>
        
        <div className={`absolute top-0 left-0 h-full w-[85%] max-w-sm transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent
            user={user}
            location={location}
            setMobileMenuOpen={setMobileMenuOpen}
            handleLogout={handleLogout}
          />
        </div>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col md:ml-[300px] min-h-screen transition-all duration-500 overflow-x-hidden">
        
        {/* TOPBAR */}
        <header className="sticky top-1 h-16 md:h-20 bg-vanilla/80 backdrop-blur-lg md:bg-transparent border-b border-slate/5 md:border-0 flex items-center justify-between px-6 md:px-10 z-40">
           <div className="flex items-center gap-6">
              <button 
                onClick={() => setMobileMenuOpen(true)} 
                className="md:hidden p-3 text-slate hover:bg-slate/5 rounded-2xl transition-all"
              >
                <Menu size={26} />
              </button>
 
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-5 md:hidden">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-pear animate-pulse shadow-[0_0_10px_var(--pear)]"></div>
                   <h2 className="text-slate/20 font-black uppercase text-[9px] tracking-[0.3em] leading-none">Melo | Préstamos</h2>
                </div>
                <div className="w-3 h-[1px] bg-slate/10 hidden md:block"></div>
                <h1 className="font-black text-[14px] md:text-lg uppercase tracking-[0.2em] text-slate italic leading-tight">
                  {getSectionName()}
                </h1>
              </div>
           </div>

           <div className="flex items-center gap-4">
              {/* BCV Ticker — Dark Branding (Matching Landing) */}
              <div 
                className="flex items-center gap-1.5 md:gap-3 px-3 py-1.5 md:px-5 md:py-2.5 bg-[#1A1A1A] rounded-xl md:rounded-[22px] border border-white/5 shadow-2xl cursor-help transition-transform hover:scale-105" 
                title={exchangeRate?.date ? `Última actualización: ${new Date(exchangeRate.date.seconds * 1000).toLocaleString()}` : 'Esperando datos del BCV...'}
              >
                 <div className="p-1.5 bg-pear text-slate rounded-lg hidden sm:flex items-center justify-center">
                   <DollarSign size={14} strokeWidth={4} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] md:tracking-[0.25em] text-white/30 leading-none">BCV Oficial</span>
                    <span className="text-xs md:text-[14px] font-[1000] italic tracking-tighter text-pear leading-none mt-1 whitespace-nowrap">
                      {exchangeRate?.rate ? `Bs. ${exchangeRate.rate.toFixed(2)}` : '...'}
                    </span>
                 </div>
              </div>

              <NotificationsPopover />
              <div className="hidden md:flex h-12 w-[1px] bg-slate/10 mx-4"></div>
              <div 
                onClick={() => navigate('/perfil')}
                className="hidden md:flex w-14 h-14 rounded-[22px] bg-white text-slate items-center justify-center text-[11px] font-black shadow-2xl border border-slate/5 group cursor-pointer hover:border-pear transition-all"
                title="Configuración de Cuenta"
              >
                <span className="group-hover:scale-110 transition-transform">{getInitials(user?.displayName)}</span>
              </div>
           </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
           {/* SUBSCRIPTION WARNING BANNER */}
           {isActive && daysRemaining > 0 && daysRemaining <= 7 && (
             <div className="mx-4 md:mx-8 lg:mx-10 mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-[24px] flex items-center gap-3 shadow-sm">
               <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
               <p className="text-xs font-bold">
                 Tu suscripción vence en <strong>{daysRemaining} día{daysRemaining !== 1 ? 's' : ''}</strong>. Renueva para seguir usando la app sin interrupciones.
               </p>
             </div>
           )}
            <div className="p-2 sm:p-3 md:p-4 lg:p-5">
              <div className="min-h-full bg-white rounded-[32px] sm:rounded-[48px] md:rounded-[64px] border border-slate/5 shadow-3xl shadow-slate/5 overflow-hidden transition-all duration-700 p-4 sm:p-6 md:p-8 lg:p-8">
                <Outlet />
              </div>
            </div>
        </main>

        {/* 4. MOBILE BOTTOM NAV */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(6rem+env(safe-area-inset-bottom))] pb-[calc(env(safe-area-inset-bottom)+1.2rem)] bg-slate flex items-center justify-around z-50 shadow-[0_-5px_30px_rgba(0,0,0,0.3)] border-t border-white/5">
          {menuItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex flex-col items-center justify-center gap-2 w-full h-full transition-all duration-300
                ${isActive ? 'text-pear' : 'text-white/30'}
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={28} strokeWidth={isActive ? 3 : 2} className="transition-transform duration-300" />
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ONBOARDING TUTORIAL */}
        {user && showTutorial && (
          <OnboardingModal 
            userId={user.uid} 
            userName={user.displayName || 'Usuario'} 
            onClose={() => setShowTutorial(false)} 
          />
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;

