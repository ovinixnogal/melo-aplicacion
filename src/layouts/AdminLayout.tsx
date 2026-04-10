import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  ShieldCheck,
  CreditCard,
  BarChart,
  Home,
  Menu,
  Cpu
} from 'lucide-react';

const adminMenuItems = [
  { name: 'Dashboard', path: '/admin', icon: BarChart },
  { name: 'Usuarios', path: '/admin/users', icon: Users },
  { name: 'Suscripciones', path: '/admin/subscriptions', icon: ShieldCheck },
  { name: 'Pagos', path: '/admin/payments', icon: CreditCard },
  { name: 'Sistema', path: '/admin/system', icon: Cpu },
];

interface SidebarContentProps {
  location: any;
  setMobileMenuOpen: (open: boolean) => void;
  navigate: (path: string) => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  location,
  setMobileMenuOpen,
  navigate
}) => (
  <div className="flex flex-col h-full bg-slate text-white selection:bg-pear selection:text-slate">
    <div className="px-8 py-10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-pear text-slate rounded-[18px] flex items-center justify-center font-black text-2xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform cursor-pointer shadow-pear/20">
           A
        </div>
        <div className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-pear/80 border-b border-pear/30 pb-0.5 mb-0.5 inline-block w-max">
            Admin Portal
          </span>
          <span className="text-xl font-black italic tracking-tighter leading-none">
            Melo<span className="text-pear">.</span>
          </span>
        </div>
      </div>
    </div>

    <nav className="flex-1 px-4 py-8 space-y-3">
      {adminMenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-4 px-6 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all duration-300
              ${isActive
                ? 'bg-pear text-slate shadow-xl shadow-pear/10 scale-100'
                : 'text-white/40 hover:bg-white/5 hover:text-white scale-95 hover:scale-100'}`}
          >
            <Icon size={18} strokeWidth={isActive ? 3 : 2} className={isActive ? "text-slate" : ""} />
            {item.name}
          </NavLink>
        );
      })}
    </nav>

    <div className="px-6 py-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center justify-center gap-3 px-6 py-4 w-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-colors mb-4"
      >
        <Home size={16} /> Volver a la App
      </button>
    </div>
  </div>
);

const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getSectionName = () => {
    if (location.pathname === '/admin') return 'Stats';
    const current = adminMenuItems.find(i => i.path === location.pathname);
    return current ? current.name : 'Administración';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans selection:bg-pear selection:text-slate">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:block w-[300px] shadow-2xl z-20 h-full">
        <SidebarContent
          location={location}
          setMobileMenuOpen={setMobileMenuOpen}
          navigate={navigate}
        />
      </aside>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in transition-all"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MOBILE SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 left-0 w-[280px] bg-slate shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          location={location}
          setMobileMenuOpen={setMobileMenuOpen}
          navigate={navigate}
        />
      </aside>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-[90px] bg-white border-b border-slate/5 flex items-center justify-between px-6 lg:px-12 backdrop-blur-xl bg-white/80 sticky top-0 z-30 shadow-sm">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-3 bg-gray-50 hover:bg-pear text-slate rounded-2xl transition-colors active:scale-95"
              >
                <Menu size={20} className="stroke-[3]" />
              </button>
              
              <div className="relative">
                 <h1 className="text-xl lg:text-2xl font-black text-slate uppercase italic tracking-tighter">
                    {getSectionName()}
                 </h1>
                 <div className="absolute -bottom-2 lg:-bottom-3 left-0 w-1/2 h-1 bg-pear rounded-full"></div>
              </div>
           </div>
           
           <div className="flex items-center gap-3 lg:gap-6">
              <div className="hidden md:flex flex-col items-end">
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Super Admin</span>
                 <span className="text-xs font-bold text-slate truncate max-w-[150px]">{user?.email}</span>
              </div>
              <div className="w-12 h-12 rounded-[20px] bg-slate text-pear flex items-center justify-center text-[10px] font-black shadow-lg">
                ADM
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
          <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12 max-w-7xl animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>

    </div>
  );
};

export default AdminLayout;
